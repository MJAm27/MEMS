import React, { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import { Bar } from "react-chartjs-2";
import { 
    FaBox, FaExclamationTriangle, FaHistory, FaCalendarAlt, 
    FaUser, FaChartBar, FaFilter, FaExchangeAlt
} from "react-icons/fa";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from "chart.js";

import "./ManagerReportPage.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

function ManagerReportPage() {
    const [activeTab, setActiveTab] = useState("inventory"); 
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [stockStatusFilter, setStockStatusFilter] = useState("all");

    const [histStartDate, setHistStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
    const [histEndDate, setHistEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [histType, setHistType] = useState("all"); 
    const [histUser, setHistUser] = useState("all");

    const [summary, setSummary] = useState({ total: 0, nearExpire: 0, nearOutOfStock: 0 });
    const [rawInventory, setRawInventory] = useState([]);
    const [rawUsage, setRawUsage] = useState([]);
    const [historyData, setHistoryData] = useState([]);
    const [loading, setLoading] = useState(true);

    // แก้ไข Warning: ใช้ useCallback เพื่อ Memoize ฟังก์ชัน
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
        } catch (err) { console.error("Error fetching data:", err); } 
        finally { setLoading(false); }
    }, [startDate, endDate]);

    const fetchDetailedHistory = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/history/full`, { 
                headers: { Authorization: `Bearer ${token}` },
                params: { startDate: histStartDate, endDate: histEndDate } 
            });
            setHistoryData(res.data);
        } catch (err) { console.error("Error fetching history:", err); }
    }, [histStartDate, histEndDate]);

    // Warning แก้ไขแล้ว: ใส่ Dependency ให้ครบถ้วน
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    useEffect(() => {
        fetchDetailedHistory();
    }, [fetchDetailedHistory]);

    // --- Logic การกรองข้อมูล ---
    const filteredInventory = useMemo(() => {
        return rawInventory.filter(item => {
            const current = item.quantity || 0;
            const alert = item.alert_quantity || 0;
            const isLow = current <= alert;
            if (stockStatusFilter === "low") return isLow;
            if (stockStatusFilter === "ok") return !isLow;
            return true;
        });
    }, [rawInventory, stockStatusFilter]);

    const filteredHistory = useMemo(() => {
        return historyData.filter(row => {
            const matchType = histType === "all" || row.transaction_type_id === histType;
            const matchUser = histUser === "all" || row.fullname === histUser;
            return matchType && matchUser;
        });
    }, [historyData, histType, histUser]);

    const uniqueUsers = useMemo(() => {
        return [...new Set(historyData.map(h => h.fullname).filter(Boolean))];
    }, [historyData]);

    const getChartData = () => {
        if (activeTab === "inventory") {
            const sorted = [...rawInventory].sort((a, b) => (b.quantity || 0) - (a.quantity || 0)).slice(0, 10);
            return {
                labels: sorted.map(item => item.equipment_name),
                datasets: [
                    {
                        label: "จำนวนคงเหลือ",
                        data: sorted.map(item => item.quantity || 0),
                        backgroundColor: sorted.map(item => item.quantity <= (item.alert_quantity || 0) ? "#D32F2F" : "#2E7D32"),
                    },
                    {
                        label: "ส่วนที่เบิกออกไป",
                        data: sorted.map(item => {
                            const total = item.total_quantity || item.quantity || 0;
                            return Math.max(0, total - (item.quantity || 0));
                        }),
                        backgroundColor: "#E0E0E0",
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
                    backgroundColor: "#42A5F5",
                    borderRadius: 6
                }]
            };
        }
    };

    if (loading) return <div className="loading-container">กำลังดึงข้อมูลรายงาน...</div>;

    return (
        <div className="report-page fade-in">
            <header className="report-header">
                <h1 className="page-title">ระบบรายงานบริหารจัดการคลัง</h1>
                <div className="date-filter-bar">
                    <span className="filter-label"><FaFilter /> รายงานหลัก:</span>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <span className="separator">ถึง</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
            </header>

            <div className="report-summary-grid">
                <div className="summary-card info">
                    <FaBox className="card-icon" />
                    <div className="card-text"><span>อะไหล่ทั้งหมด</span><strong>{summary.total}</strong></div>
                </div>
                <div className="summary-card warning">
                    <FaExclamationTriangle className="card-icon" />
                    <div className="card-text"><span>ใกล้หมดอายุ</span><strong>{summary.nearExpire}</strong></div>
                </div>
                <div className="summary-card danger">
                    <FaExclamationTriangle className="card-icon" />
                    <div className="card-text"><span>สต็อกต่ำ</span><strong>{summary.nearOutOfStock}</strong></div>
                </div>
            </div>

            <div className="report-main-section">
                <div className="tab-navigation">
                    <button className={`tab-btn ${activeTab === "inventory" ? "active" : ""}`} onClick={() => setActiveTab("inventory")}><FaChartBar /> ปริมาณคงเหลือ</button>
                    <button className={`tab-btn ${activeTab === "usage" ? "active" : ""}`} onClick={() => setActiveTab("usage")}><FaChartBar /> การเบิกใช้สูงสุด</button>
                </div>
                <div className="chart-container" style={{ height: '350px' }}>
                    <Bar 
                        data={getChartData()} 
                        options={{ 
                            indexAxis: 'y', 
                            responsive: true, 
                            maintainAspectRatio: false,
                            scales: { x: { stacked: true }, y: { stacked: true } }
                        }} 
                    />
                </div>
            </div>

            {activeTab === "inventory" && (
                <div className="report-table-section mb-10">
                    <div className="section-header-with-filter">
                        <h3 className="table-title">ตารางตรวจสอบปริมาณอะไหล่คงคลัง</h3>
                        <div className="stock-filter-container">
                            <label className="filter-label"><FaFilter /> สถานะสต็อก:</label>
                            <select value={stockStatusFilter} onChange={(e) => setStockStatusFilter(e.target.value)} className="status-select">
                                <option value="all">ทั้งหมด</option>
                                <option value="low">ต้องสั่งซื้อด่วน</option>
                                <option value="ok">ปกติ</option>
                            </select>
                        </div>
                    </div>
                    <div className="table-wrapper">
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>ชื่ออะไหล่</th>
                                    <th>คงเหลือ / ทั้งหมด</th>
                                    <th>สถานะสต็อก</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInventory.length > 0 ? filteredInventory.map((item, i) => {
                                    const current = item.quantity || 0;
                                    const total = item.total_quantity || item.quantity || 0; 
                                    const percent = total > 0 ? (current / total) * 100 : 0;
                                    const isLow = current <= (item.alert_quantity || 0);
                                    return (
                                        <tr key={i}>
                                            <td>{item.equipment_name}</td>
                                            <td>
                                                <div className="qty-progress-cell">
                                                    <strong>{current} / {total}</strong>
                                                    <div className="mini-bar">
                                                        <div className="fill" style={{ width: `${percent}%`, backgroundColor: isLow ? '#d32f2f' : '#2e7d32' }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><span className={`status-badge ${isLow ? 'low' : 'ok'}`}>{isLow ? 'ต้องสั่งซื้อด่วน' : 'ปกติ'}</span></td>
                                        </tr>
                                    );
                                }) : (
                                    <tr><td colSpan="3" style={{textAlign: 'center', padding: '30px'}}>ไม่พบข้อมูลที่ตรงตามเงื่อนไข</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="report-table-section">
                <div className="section-header-with-filter">
                    <h3><FaHistory /> ประวัติการเบิก-คืนละเอียด</h3>
                    <div className="history-filter-grid">
                        <div className="filter-item">
                            <label><FaCalendarAlt /> ช่วงวันที่:</label>
                            <div className="date-inputs">
                                <input type="date" value={histStartDate} onChange={(e) => setHistStartDate(e.target.value)} />
                                <input type="date" value={histEndDate} onChange={(e) => setHistEndDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="filter-item">
                            <label><FaExchangeAlt /> ประเภท:</label>
                            <select value={histType} onChange={(e) => setHistType(e.target.value)}>
                                <option value="all">ทั้งหมด</option>
                                <option value="T-WTH">เบิก</option>
                                <option value="T-RTN">คืน</option>
                            </select>
                        </div>
                        <div className="filter-item">
                            <label><FaUser /> ผู้ทำรายการ:</label>
                            <select value={histUser} onChange={(e) => setHistUser(e.target.value)}>
                                <option value="all">พนักงานทุกคน</option>
                                {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="table-wrapper">
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>วัน/เวลา</th>
                                <th>ประเภท</th>
                                <th>ผู้ทำรายการ</th>
                                <th>รายการอะไหล่</th>
                                <th>เครื่องจักร (SN)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredHistory.map((row, idx) => {
                                let items = [];
                                try { items = typeof row.items_json === 'string' ? JSON.parse(row.items_json) : (row.items_json || []); } catch(e) { items = []; }
                                return (
                                    <tr key={idx}>
                                        <td><div className="td-time"><span>{new Date(row.date).toLocaleDateString('th-TH')}</span><small>{row.time}</small></div></td>
                                        <td><span className={`badge-type ${row.transaction_type_id}`}>{row.type_name}</span></td>
                                        <td><div className="td-user"><FaUser size={10} /> {row.fullname}</div></td>
                                        <td>{items.map((it, i) => <div key={i} className="item-row">{it.name} <b>x{it.qty}</b></div>)}</td>
                                        <td><code className="sn-text">{row.machine_SN || "-"}</code></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default ManagerReportPage;