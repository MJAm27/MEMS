import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { Bar } from "react-chartjs-2";
import { FaHandHolding, FaReply, FaUsers, FaChartLine, FaCalendarDay, FaUser } from "react-icons/fa";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";

import "./ManagerDashboard.css"; 

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

function ManagerDashboard({ viewDate }) {
    const [todayData, setTodayData] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchActivityByDate = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            // ตรวจสอบว่ามี viewDate หรือไม่ ถ้าไม่มีให้ใช้เครื่องหมายปัจจุบัน
            const targetDate = viewDate || new Date().toISOString().split('T')[0];

            const res = await axios.get(`${API_BASE_URL}/api/history/full`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { startDate: targetDate, endDate: targetDate }
            });

            const sortedData = res.data.sort((a, b) => b.time.localeCompare(a.time));
            setTodayData(sortedData);
        } catch (err) { 
            console.error("Fetch dashboard error:", err); 
        } finally { 
            setLoading(false); 
        }
    }, [viewDate]); 

    useEffect(() => { 
        fetchActivityByDate(); 
    }, [fetchActivityByDate]);

    const stats = useMemo(() => ({
        withdraws: todayData.filter(d => d.transaction_type_id === 'T-WTH').length,
        returns: todayData.filter(d => d.transaction_type_id === 'T-RTN').length,
        userCount: [...new Set(todayData.map(d => d.fullname))].length
    }), [todayData]);

    const chartData = useMemo(() => {
        const labels = [...new Set(todayData.map(d => d.fullname))];
        return {
            labels,
            datasets: [
                { 
                    label: 'เบิก', 
                    data: labels.map(n => todayData.filter(d => d.fullname === n && d.transaction_type_id === 'T-WTH').length), 
                    backgroundColor: '#3498db' 
                },
                { 
                    label: 'คืน', 
                    data: labels.map(n => todayData.filter(d => d.fullname === n && d.transaction_type_id === 'T-RTN').length), 
                    backgroundColor: '#2ecc71' 
                }
            ]
        };
    }, [todayData]);

    if (loading) return <div className="loading-container">กำลังดึงข้อมูลสรุป...</div>;

    return (
        <div className="dashboard-container fade-in">
            <div className="dashboard-header-day">
                {/* แสดงวันที่ที่เลือกในหัวข้อ */}
                <h2>
                    <FaCalendarDay /> สรุปกิจกรรมคลังประจำวันที่ {viewDate ? new Date(viewDate).toLocaleDateString('th-TH') : "ไม่ระบุวัน"}
                </h2>
            </div>

            <div className="report-summary-grid">
                <div className="summary-card info">
                    <FaHandHolding className="card-icon" />
                    <div className="card-text"><span>เบิกวันนี้</span><strong>{stats.withdraws} ครั้ง</strong></div>
                </div>
                <div className="summary-card success">
                    <FaReply className="card-icon" />
                    <div className="card-text"><span>คืนวันนี้</span><strong>{stats.returns} ครั้ง</strong></div>
                </div>
                <div className="summary-card">
                    <FaUsers className="card-icon" style={{color: '#9b59b6'}} />
                    <div className="card-text"><span>ผู้ใช้งานวันนี้</span><strong>{stats.userCount} คน</strong></div>
                </div>
            </div>

            <div className="dashboard-chart-section">
                <h3><FaChartLine /> กราฟสรุปการเบิก-คืน รายบุคคล</h3>
                
                <div style={{ height: '300px' }}>
                    <Bar 
                        data={chartData} 
                        options={{ 
                            responsive: true, 
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { labels: { font: { family: 'Prompt' } } }
                            }
                        }} 
                    />
                </div>
            </div>

            <div className="report-table-section">
                <h3>รายละเอียดการทำรายการล่าสุด</h3>
                <div className="table-wrapper">
                    <table className="report-table">
                        <thead><tr><th>เวลา</th><th>ผู้ทำรายการ</th><th>ประเภท</th><th>รายการ</th></tr></thead>
                        <tbody>
                            {todayData.length > 0 ? todayData.map((row, idx) => {
                                let items = [];
                                try { items = typeof row.items_json === 'string' ? JSON.parse(row.items_json) : (row.items_json || []); } catch(e) { items = []; }
                                return (
                                    <tr key={idx}>
                                        <td>{row.time}</td>
                                        <td><div className="td-user"><FaUser size={10} /> {row.fullname || "ไม่ระบุชื่อ"}</div></td>
                                        <td><span className={`badge-type ${row.transaction_type_id}`}>{row.type_name}</span></td>
                                        <td>{items.map((it, i) => <div key={i} className="item-row">{it.name} <b>x{it.qty}</b></div>)}</td>
                                    </tr>
                                );
                            }) : <tr><td colSpan="4" style={{textAlign:'center', padding:'20px'}}>ยังไม่มีการทำรายการในวันที่เลือก</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default ManagerDashboard;