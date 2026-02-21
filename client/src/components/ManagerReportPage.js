import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Bar } from "react-chartjs-2";
import { 
    FaBox, FaExclamationTriangle, FaHistory, FaCalendarAlt, 
    FaUser, FaChartBar, FaFilter, FaExchangeAlt, FaClock
} from "react-icons/fa";
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from "chart.js";

import "./ManagerReportPage.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

function ManagerReportPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("inventory"); 
    
    // --- State สำหรับรายงานหลัก (ตัวเลขสรุปและกราฟ) ---
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [stockStatusFilter, setStockStatusFilter] = useState("all");

    // --- State สำหรับตัวกรองประวัติเบิก-คืนละเอียด ---
    const [histStartDate, setHistStartDate] = useState(new Date().toISOString().split('T')[0]); 
    const [histEndDate, setHistEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [histType, setHistType] = useState("all"); // 'all', 'T-WTH', 'T-RTN', 'pending'

    const [summary, setSummary] = useState({ total: 0, nearExpire: 0, nearOutOfStock: 0 });
    const [rawInventory, setRawInventory] = useState([]);
    const [rawUsage, setRawUsage] = useState([]);
    const [historyData, setHistoryData] = useState([]);
    const [loading, setLoading] = useState(true);

    // ดึงข้อมูลภาพรวมและกราฟ
    const fetchAllData = useCallback(async () => {
        try {
            setLoading(true);
            const params = { startDate, endDate };
            const [summaryRes, invRes, useRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/report/summary`),
                axios.get(`${API_BASE_URL}/api/inventoryBalanceReportChart`),
                axios.get(`${API_BASE_URL}/api/reports/equipment-usage`, { params }),
            ]);
            setSummary(summaryRes.data);
            setRawInventory(invRes.data);
            setRawUsage(useRes.data);
        } catch (err) { 
            console.error("Error fetching report data:", err); 
        } finally { 
            setLoading(false); 
        }
    }, [startDate, endDate]);

    // ดึงข้อมูลประวัติละเอียด
    const fetchDetailedHistory = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/history/full`, { 
                headers: { Authorization: `Bearer ${token}` },
                params: { 
                    startDate: histStartDate, 
                    endDate: histEndDate 
                } 
            });
            setHistoryData(res.data);
        } catch (err) { 
            console.error("Error fetching history:", err); 
        }
    }, [histStartDate, histEndDate]);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);
    useEffect(() => { fetchDetailedHistory(); }, [fetchDetailedHistory]);

    // --- กรองประวัติ (เบิกล่วงหน้าจะดูจาก is_pending) ---
    const filteredHistory = useMemo(() => {
        return historyData.filter(row => {
            if (histType === "pending") return row.is_pending === 1;
            if (histType === "T-WTH") return row.transaction_type_id === "T-WTH" && row.is_pending === 0;
            if (histType === "T-RTN") return row.transaction_type_id === "T-RTN";
            return true;
        });
    }, [historyData, histType]);

    // --- กราฟ Stacked Bar แนวนอน (คงเหลือ + ใช้ไป) ---
    const getChartData = () => {
        if (activeTab === "inventory") {
            const sorted = [...rawInventory].sort((a, b) => (b.quantity || 0) - (a.quantity || 0)).slice(0, 10);
            return {
                labels: sorted.map(item => item.equipment_name),
                datasets: [
                    {
                        label: "คงเหลือ (Stock)",
                        data: sorted.map(item => item.quantity || 0),
                        backgroundColor: sorted.map(item => (item.quantity || 0) <= (item.alert_quantity || 0) ? "#ef4444" : "#22c55e"),
                        stack: 'Stack 0', 
                    },
                    {
                        label: "ใช้ไป (Used)",
                        data: sorted.map(item => item.used_quantity || 0),
                        backgroundColor: "#e2e8f0", 
                        stack: 'Stack 0', 
                    }
                ]
            };
        } else {
            const sorted = [...rawUsage].sort((a, b) => (b.total_usage || 0) - (a.total_usage || 0)).slice(0, 10);
            return {
                labels: sorted.map(item => item.equipment_name),
                datasets: [{
                    label: "จำนวนที่ถูกเบิกใช้รวม",
                    data: sorted.map(item => item.total_usage || 0),
                    backgroundColor: "#3b82f6",
                    borderRadius: 8
                }]
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
                    <span className="filter-label"><FaFilter /> ช่วงเวลาหลัก:</span>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <span className="separator">ถึง</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
            </header>

            <div className="report-summary-grid">
                <div className="summary-card info" onClick={() => navigate("/dashboard/manager/home")} style={{ cursor: 'pointer' }}>
                    <FaBox className="card-icon" />
                    <div className="card-text"><span>อะไหล่ในคลัง</span><strong>{summary.total}</strong></div>
                </div>

                {/* ลิงก์ไปหน้าแจ้งเตือน (ManagerAlertPage) */}
                <div className="summary-card warning" onClick={() => navigate("/dashboard/manager/alerts")} style={{ cursor: 'pointer' }}>
                    <FaExclamationTriangle className="card-icon" />
                    <div className="card-text"><span>ใกล้หมดอายุ</span><strong>{summary.nearExpire}</strong></div>
                </div>

                {/* ลิงก์ไปหน้าแจ้งเตือน (ManagerAlertPage) */}
                <div className="summary-card danger" onClick={() => navigate("/dashboard/manager/alerts")} style={{ cursor: 'pointer' }}>
                    <FaExclamationTriangle className="card-icon" />
                    <div className="card-text"><span>สต็อกต่ำกว่าเกณฑ์</span><strong>{summary.nearOutOfStock}</strong></div>
                </div>
            </div>

            <div className="report-main-section">
                <div className="tab-navigation">
                    <button className={`tab-btn ${activeTab === "inventory" ? "active" : ""}`} onClick={() => setActiveTab("inventory")}><FaChartBar /> วิเคราะห์สต็อก</button>
                    <button className={`tab-btn ${activeTab === "usage" ? "active" : ""}`} onClick={() => setActiveTab("usage")}><FaChartBar /> สถิติการเบิกใช้</button>
                </div>
                
                <div className="chart-container" style={{ height: '450px' }}>
                    <Bar 
                        data={getChartData()} 
                        options={{ 
                            indexAxis: 'y', 
                            responsive: true, 
                            maintainAspectRatio: false,
                            plugins: { legend: { position: 'top', labels: { font: { family: 'Prompt' } } } },
                            scales: { 
                                x: { stacked: true, grid: { display: false } }, 
                                y: { stacked: true, ticks: { font: { family: 'Prompt' } } } 
                            }
                        }} 
                    />
                </div>
            </div>

            {/* --- ตารางตรวจสอบสต็อก พร้อมแถบสี Progress Bar ที่แก้ไขแล้ว --- */}
            {activeTab === "inventory" && (
                <div className="report-table-section mb-10">
                    <div className="section-header-with-filter">
                        <h3 className="table-title">ตารางตรวจสอบปริมาณอะไหล่คงคลัง</h3>
                        <select value={stockStatusFilter} onChange={(e) => setStockStatusFilter(e.target.value)} className="status-select">
                            <option value="all">สถานะ: ทั้งหมด</option>
                            <option value="low">เฉพาะสต็อกต่ำ</option>
                            <option value="ok">เฉพาะสถานะปกติ</option>
                        </select>
                    </div>
                    <div className="table-wrapper">
                        <table className="report-table">
                            <thead>
                                <tr><th>ชื่ออะไหล่</th><th>คงเหลือ / ทั้งหมด</th><th>สถานะสต็อก</th></tr>
                            </thead>
                            <tbody>
                                {filteredInventory.map((item, i) => {
                                    const current = item.quantity || 0;
                                    const total = item.total_quantity || 0;
                                    const percent = total > 0 ? (current / total) * 100 : 0;
                                    const isLow = current <= (item.alert_quantity || 0);
                                    
                                    return (
                                        <tr key={i}>
                                            <td>{item.equipment_name}</td>
                                            <td>
                                                <div className="qty-progress-cell">
                                                    <strong>{current} / {total}</strong>
                                                    <div className="mini-bar">
                                                        <div 
                                                            className="fill" 
                                                            style={{ 
                                                                width: `${percent}%`, 
                                                                backgroundColor: isLow ? '#ef4444' : '#22c55e',
                                                                opacity: percent > 0 ? 1 : 0
                                                            }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><span className={`status-badge ${isLow ? 'low' : 'ok'}`}>{isLow ? 'ต้องสั่งซื้อด่วน' : 'ปกติ'}</span></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- ส่วนฟิวเตอร์ประวัติเบิก-คืนละเอียด แบบ Inline ทันสมัย --- */}
            <div className="report-table-section">
                <div className="section-header-with-filter">
                    <h3><FaHistory /> ประวัติการทำรายการแบบละเอียด</h3>
                    <div className="history-filters-inline">
                        <div className="f-group">
                            <FaCalendarAlt />
                            <input type="date" value={histStartDate} onChange={(e) => setHistStartDate(e.target.value)} />
                            <span>-</span>
                            <input type="date" value={histEndDate} onChange={(e) => setHistEndDate(e.target.value)} />
                        </div>
                        <div className="f-group">
                            <FaExchangeAlt />
                            <select value={histType} onChange={(e) => setHistType(e.target.value)}>
                                <option value="all">ทุกประเภท</option>
                                <option value="T-WTH">รายการเบิก</option>
                                <option value="T-RTN">รายการคืน</option>
                                <option value="pending">รายการเบิกล่วงหน้า</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="table-wrapper">
                    <table className="report-table">
                        <thead>
                            <tr><th>วัน/เวลา</th><th>ประเภท</th><th>ผู้ทำรายการ</th><th>รายการอะไหล่</th><th>สถานะ</th></tr>
                        </thead>
                        <tbody>
                            {filteredHistory.length > 0 ? filteredHistory.map((row, idx) => {
                                let items = [];
                                try { items = typeof row.items_json === 'string' ? JSON.parse(row.items_json) : (row.items_json || []); } catch(e) { items = []; }
                                return (
                                    <tr key={idx}>
                                        <td><div className="td-time"><span>{new Date(row.date).toLocaleDateString('th-TH')}</span><small>{row.time}</small></div></td>
                                        <td>
                                            <span className={`badge-type ${row.transaction_type_id} ${row.is_pending ? 'pending' : ''}`}>
                                                {row.is_pending ? 'เบิกล่วงหน้า' : row.type_name}
                                            </span>
                                        </td>
                                        <td><div className="td-user"><FaUser size={10} /> {row.fullname || "ไม่ระบุชื่อ"}</div></td>
                                        <td>{items.map((it, i) => <div key={i} className="item-row">{it.name} <b>x{it.qty}</b></div>)}</td>
                                        <td>
                                            {row.is_pending ? 
                                                <span className="p-status"><FaClock /> ค้างสรุป</span> : 
                                                <span className="s-status">สำเร็จ</span>
                                            }
                                        </td>
                                    </tr>
                                );
                            }) : <tr><td colSpan="5" className="text-center p-10">ไม่พบประวัติในช่วงวันที่เลือก</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default ManagerReportPage;