import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Bar, Doughnut } from "react-chartjs-2";
import { 
    FaBox, FaExclamationTriangle, FaFilter, FaChartBar, 
    FaChartLine, FaBoxOpen, FaBuilding, FaTools 
} from "react-icons/fa";
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement
} from "chart.js";

import "./ManagerReportPage.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

function ManagerReportPage() {
    const navigate = useNavigate();
    
    const [activeTab, setActiveTab] = useState("usage-stats"); 
    
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [stockStatusFilter, setStockStatusFilter] = useState("all");

    const [summary, setSummary] = useState({ total: 0, nearExpire: 0, nearOutOfStock: 0 });
    const [rawInventory, setRawInventory] = useState([]);
    const [rawUsage, setRawUsage] = useState([]);
    const [todayActivity, setTodayActivity] = useState([]); // ข้อมูลกิจกรรมเบิก-คืนเพื่อทำกราฟวิเคราะห์
    const [loading, setLoading] = useState(true);

    const fetchAllData = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const config = {
                headers: { Authorization: `Bearer ${token}` },
                params: { startDate, endDate } 
            };

            const [summaryRes, invRes, useRes, activityRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/report/summary`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_BASE_URL}/api/inventoryBalanceReportChart`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_BASE_URL}/api/reports/equipment-usage`, config),
                axios.get(`${API_BASE_URL}/api/history/manager/full`, config) 
            ]);

            setSummary(summaryRes.data);
            setRawInventory(invRes.data);
            setRawUsage(useRes.data);
            setTodayActivity(activityRes.data || []);

        } catch (err) { 
            console.error("Error fetching report data:", err); 
            if (err.response && err.response.status === 401) {
            }
        } finally { 
            setLoading(false); 
        }
    }, [startDate, endDate]);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    const getChartData = () => {
        // 1. การเบิก-คืน
        if (activeTab === "usage-stats") {
            return {
                labels: ['สถิติการทำรายการ'],
                datasets: [
                    { label: 'เบิก (ครั้ง)', data: [todayActivity.filter(d => d.transaction_type_id === 'T-WTH').length], backgroundColor: '#ff4d94', borderRadius: 8 },
                    { label: 'คืน (ครั้ง)', data: [todayActivity.filter(d => d.transaction_type_id === 'T-RTN').length], backgroundColor: '#3b82f6', borderRadius: 8 }
                ]
            };
        } 
        // 2. อะไหล่ยอดนิยม 5 อันดับ
        else if (activeTab === "top-5") {
            const sorted = [...rawUsage].sort((a, b) => (b.total_usage || 0) - (a.total_usage || 0)).slice(0, 5);
            return {
                labels: sorted.map(item => item.equipment_name),
                datasets: [{ label: "จำนวนที่ถูกเบิกใช้ (ชิ้น)", data: sorted.map(item => item.total_usage || 0), backgroundColor: '#8b5cf6', borderRadius: 8 }]
            };
        }
        // 3. การใช้งานรายตึก
        else if (activeTab === "building") {
            const bCounts = {};
            todayActivity.forEach(d => { bCounts[d.buildings || 'ไม่ระบุ'] = (bCounts[d.buildings || 'ไม่ระบุ'] || 0) + 1; });
            return {
                labels: Object.keys(bCounts),
                datasets: [{ label: 'จำนวนครั้งที่ใช้งาน', data: Object.values(bCounts), backgroundColor: '#10b981', borderRadius: 8 }]
            };
        }
        // 4. ประเภทงาน (Doughnut)
        else if (activeTab === "repair-type") {
            const rCounts = {};
            todayActivity.forEach(d => { rCounts[d.repair_type_name || 'ไม่ระบุ'] = (rCounts[d.repair_type_name || 'ไม่ระบุ'] || 0) + 1; });
            return {
                labels: Object.keys(rCounts),
                datasets: [{ data: Object.values(rCounts), backgroundColor: ['#f43f5e', '#3b82f6', '#fbbf24', '#10b981'] }]
            };
        }
        // 5. วิเคราะห์สต็อก (Stacked Bar เดิม)
        else if (activeTab === "inventory") {
            const sorted = [...rawInventory].sort((a, b) => (b.quantity || 0) - (a.quantity || 0)).slice(0, 10);
            return {
                labels: sorted.map(item => item.equipment_name),
                datasets: [
                    { label: "คงเหลือ (Stock)", data: sorted.map(item => item.quantity || 0), backgroundColor: "#22c55e", stack: 'Stack 0' },
                    { label: "ใช้ไป (Used)", data: sorted.map(item => item.used_quantity || 0), backgroundColor: "#e2e8f0", stack: 'Stack 0' }
                ]
            };
        }
    };

    const filteredInventory = useMemo(() => {
        return rawInventory.filter(item => {
            const isLow = (item.quantity || 0) <= (item.alert_quantity || 0);
            if (stockStatusFilter === "low") return isLow;
            if (stockStatusFilter === "ok") return !isLow;
            return true;
        });
    }, [rawInventory, stockStatusFilter]);

    if (loading) return <div className="loading-container">กำลังเตรียมข้อมูลรายงาน...</div>;

    return (
        <div className="report-page fade-in">
            <header className="report-header">
                <h1 className="page-title">ระบบรายงานบริหารจัดการคลัง</h1>
                <div className="date-filter-bar">
                    <span className="filter-label"><FaFilter /> ช่วงเวลาประมวลผล:</span>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <span className="separator">ถึง</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
            </header>

            <div className="report-summary-grid">
                <div className="summary-card info" onClick={() => navigate("/dashboard/manager/equipment")}>
                    <FaBox className="card-icon" />
                    <div className="card-text"><span>อะไหล่ในคลัง</span><strong>{summary.total}</strong></div>
                </div>
                <div className="summary-card warning" onClick={() => navigate("/dashboard/manager/alerts")}>
                    <FaExclamationTriangle className="card-icon" />
                    <div className="card-text"><span>ใกล้หมดอายุ</span><strong>{summary.nearExpire}</strong></div>
                </div>
                <div className="summary-card danger" onClick={() => navigate("/dashboard/manager/alerts")}>
                    <FaExclamationTriangle className="card-icon" />
                    <div className="card-text"><span>สต็อกต่ำกว่าเกณฑ์</span><strong>{summary.nearOutOfStock}</strong></div>
                </div>
            </div>

            <div className="report-main-section">
                <div className="tab-navigation-wrapper">
                    <button className={`tab-btn ${activeTab === "usage-stats" ? "active" : ""}`} onClick={() => setActiveTab("usage-stats")}>
                        <FaChartLine /> การเบิก-คืน
                    </button>
                    <button className={`tab-btn ${activeTab === "top-5" ? "active" : ""}`} onClick={() => setActiveTab("top-5")}>
                        <FaBoxOpen /> อะไหล่ยอดนิยม 5 อันดับ
                    </button>
                    <button className={`tab-btn ${activeTab === "building" ? "active" : ""}`} onClick={() => setActiveTab("building")}>
                        <FaBuilding /> การใช้งานรายตึก
                    </button>
                    <button className={`tab-btn ${activeTab === "repair-type" ? "active" : ""}`} onClick={() => setActiveTab("repair-type")}>
                        <FaTools /> ประเภทงาน
                    </button>
                    <button className={`tab-btn ${activeTab === "inventory" ? "active" : ""}`} onClick={() => setActiveTab("inventory")}>
                        <FaChartBar /> วิเคราะห์สต็อก
                    </button>
                </div>
                
                <div className="chart-card-container">
                    <div className="chart-container" style={{ height: '400px' }}>
                        {activeTab === "repair-type" ? (
                            <Doughnut 
                                data={getChartData()} 
                                options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { family: 'Prompt' } } } } }} 
                            />
                        ) : (
                            <Bar 
                                data={getChartData()} 
                                options={{ 
                                    indexAxis: (activeTab === "inventory" || activeTab === "top-5") ? 'y' : 'x', 
                                    responsive: true, 
                                    maintainAspectRatio: false,
                                    plugins: { legend: { position: 'top', labels: { font: { family: 'Prompt' } } } },
                                    scales: (activeTab === "usage-stats" || activeTab === "repair-type") ? {} : { 
                                        x: { stacked: true }, 
                                        y: { stacked: true } 
                                    }
                                }} 
                            />
                        )}
                    </div>
                </div>
            </div>

            <div className="report-table-section mb-10">
                <div className="section-header-with-filter">
                    <div className="title-group">
                        <h3 className="table-title"><FaBoxOpen className="inline-block mr-2 text-pink-500" /> ตารางตรวจสอบปริมาณอะไหล่คงคลัง</h3>
                        <p className="text-sm text-gray-500">แสดงสถานะปัจจุบันและระดับการแจ้งเตือนพัสดุ</p>
                    </div>
                    <select value={stockStatusFilter} onChange={(e) => setStockStatusFilter(e.target.value)} className="status-select">
                        <option value="all">สถานะ: ทั้งหมด</option>
                        <option value="low">เฉพาะสต็อกต่ำ</option>
                        <option value="ok">เฉพาะสถานะปกติ</option>
                    </select>
                </div>
                <div className="table-wrapper">
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>ชื่ออะไหล่ / อุปกรณ์</th>
                                <th className="text-center">ระดับแจ้งเตือน</th>
                                <th>คงเหลือ / ทั้งหมด (ชิ้น)</th>
                                <th className="text-center">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInventory.length > 0 ? (
                                filteredInventory.map((item, i) => {
                                    const current = Number(item.quantity) || 0; 
                                    const total = Number(item.total_quantity) || current;
                                    const alertQty = Number(item.alert_quantity) || 0;
                                    
                                    const percent = total > 0 ? Math.min((current / total) * 100, 100) : 0;
                                    const isLow = current <= alertQty;

                                    return (
                                        <tr key={i} className={isLow ? "row-warning" : ""}>
                                            <td>
                                                <div className="font-semibold text-slate-700">{item.equipment_name}</div>
                                                <small className="text-gray-400">ID: {item.equipment_id}</small>
                                            </td>
                                            <td className="text-center">
                                                <span className="alert-threshold-badge">ต่ำกว่า {alertQty} {item.unit}</span>
                                            </td>
                                            <td>
                                                <div className="qty-progress-cell">
                                                    <div className="flex justify-between mb-1">
                                                        <strong className={isLow ? "text-red-600" : "text-green-600"}>
                                                            {current.toLocaleString()} / {total.toLocaleString()}
                                                        </strong>
                                                        
                                                    </div>
                                                    <div className="mini-bar">
                                                        <div 
                                                            className="fill" 
                                                            style={{ 
                                                                width: `${percent}%`, 
                                                                backgroundColor: isLow ? '#ef4444' : '#22c55e' 
                                                            }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="text-center">
                                                <span className={`status-badge ${isLow ? 'low' : 'ok'}`}>
                                                    {isLow ? 'ต้องสั่งซื้อด่วน' : 'ปกติ'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="4" className="text-center py-10 text-gray-400">
                                        ไม่พบข้อมูลตามเงื่อนไขที่เลือก
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default ManagerReportPage;