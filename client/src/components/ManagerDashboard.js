import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { Bar } from "react-chartjs-2";
import { 
    FaHandHolding, FaReply, FaUsers, FaChartLine, 
    FaCalendarDay, FaUser
} from "react-icons/fa";
import { 
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, 
    Title, Tooltip, Legend, ArcElement 
} from "chart.js";

import "./ManagerDashboard.css"; 

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const API_BASE_URL = process.env.REACT_APP_API_URL ;

function ManagerDashboard({ viewDate }) {
    const [todayData, setTodayData] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchActivityByDate = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            // กำหนดวันที่เป้าหมาย ถ้าไม่มีให้ใช้วันที่ปัจจุบัน
            const targetDate = viewDate || new Date().toISOString().split('T')[0];

            const res = await axios.get(`${API_BASE_URL}/api/history/manager/daily`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { startDate: targetDate, endDate: targetDate }
            });

            if (res.data && Array.isArray(res.data)) {
                // กรองข้อมูลเฉพาะรายการที่มีอะไหล่จริง เพื่อความถูกต้องของสถิติ
                const validData = res.data.filter(row => {
                    try {
                        const items = typeof row.items_json === 'string' 
                            ? JSON.parse(row.items_json) 
                            : row.items_json;
                        return items && items.length > 0;
                    } catch (e) { return false; }
                });
                setTodayData(validData);
            } else {
                setTodayData([]);
            }
        } catch (err) {
            console.error("Dashboard error:", err);
            setTodayData([]);
        } finally {
            setLoading(false);
        }
    }, [viewDate]);

    useEffect(() => { 
        fetchActivityByDate(); 
    }, [fetchActivityByDate]);

    // คำนวณ Insight และสถิติต่างๆ
    const insightStats = useMemo(() => {
        const withdraws = todayData.filter(d => d.transaction_type_id === 'T-WTH');
        const returns = todayData.filter(d => d.transaction_type_id === 'T-RTN');
        
        // คำนวณเวลาเฉลี่ยที่ใช้ในการทำรายการ (เปิด-ปิดตู้)
        const durations = todayData.map(d => {
            if (d.open_time && d.close_time) {
                const start = new Date(`1970-01-01T${d.open_time}`);
                const end = new Date(`1970-01-01T${d.close_time}`);
                return (end - start) / 1000;
            }
            return null;
        }).filter(d => d !== null && d > 0);

        const avgDuration = durations.length > 0 
            ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1) 
            : 0;

        // ค้นหาเครื่องจักรที่ถูกเบิกอะไหล่มากที่สุด
        const machineUsage = todayData.reduce((acc, curr) => {
            if (curr.machine_SN) {
                acc[curr.machine_SN] = (acc[curr.machine_SN] || 0) + 1;
            }
            return acc;
        }, {});

        const sortedMachines = Object.entries(machineUsage).sort((a, b) => b[1] - a[1]);
        const topMachine = sortedMachines[0] || ["N/A", 0];

        return {
            withdrawCount: withdraws.length,
            returnCount: returns.length,
            userCount: [...new Set(todayData.map(d => d.fullname))].length,
            avgDuration: avgDuration,
            mostUsedMachine: topMachine[0],
            mostUsedCount: topMachine[1]
        };
    }, [todayData]);

    const chartData = useMemo(() => {
        const labels = [...new Set(todayData.map(d => d.fullname))];
        return {
            labels,
            datasets: [
                { 
                    label: 'เบิก (ครั้ง)', 
                    data: labels.map(n => todayData.filter(d => d.fullname === n && d.transaction_type_id === 'T-WTH').length), 
                    backgroundColor: 'rgba(52, 152, 219, 0.8)',
                    borderRadius: 5
                },
                { 
                    label: 'คืน (ครั้ง)', 
                    data: labels.map(n => todayData.filter(d => d.fullname === n && d.transaction_type_id === 'T-RTN').length), 
                    backgroundColor: 'rgba(46, 204, 113, 0.8)',
                    borderRadius: 5
                }
            ]
        };
    }, [todayData]);

    if (loading) return <div className="loading-container">กำลังประมวลผลข้อมูล...</div>;

    return (
        <div className="dashboard-container fade-in">
            <div className="dashboard-header-day">
                <h2>
                    <FaCalendarDay /> ข้อมูลสรุปรายวัน: {viewDate ? new Date(viewDate).toLocaleDateString('th-TH') : "วันนี้"}
                </h2>
            </div>

            {/* ส่วนที่ 1: การ์ดสรุปตัวเลขสำคัญ */}
            <div className="report-summary-grid">
                <div className="summary-card info">
                    <FaHandHolding className="card-icon" />
                    <div className="card-text"><span>เบิกวันนี้</span><strong>{insightStats.withdrawCount} ครั้ง</strong></div>
                </div>
                <div className="summary-card success">
                    <FaReply className="card-icon" />
                    <div className="card-text"><span>คืนวันนี้</span><strong>{insightStats.returnCount} ครั้ง</strong></div>
                </div>
                
                <div className="summary-card purple">
                    <FaUsers className="card-icon" />
                    <div className="card-text"><span>ผู้เข้าใช้งาน</span><strong>{insightStats.userCount} คน</strong></div>
                </div>
            </div>

            <div className="dashboard-main-grid">
                {/* ส่วนที่ 2: กราฟแท่งแสดงกิจกรรมรายบุคคล */}
                <div className="dashboard-chart-section">
                    <div className="section-header">
                        <h3><FaChartLine /> กิจกรรมรายบุคคล (ความเคลื่อนไหว)</h3>
                    </div>
                    <div style={{ height: '320px' }}>
                        <Bar 
                            data={chartData} 
                            options={{ 
                                responsive: true, 
                                maintainAspectRatio: false,
                                plugins: { legend: { position: 'bottom' } }
                            }} 
                        />
                    </div>
                </div>
            </div>

            {/* ส่วนที่ 4: ตารางรายละเอียดกิจกรรมเชิงลึก */}
            <div className="report-table-section">
                <h3>รายละเอียดกิจกรรมเชิงลึก</h3>
                <div className="table-wrapper">
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>วันที่</th>
                                <th>เวลา</th>
                                <th>ผู้รับผิดชอบ</th>
                                <th>ประเภท</th>
                                <th>รายการอุปกรณ์</th>
                                <th>ระยะเวลาเปิดคลัง</th>
                            </tr>
                        </thead>
                        <tbody>
                            {todayData.length > 0 ? todayData.map((row, idx) => {
                                let items = [];
                                try { 
                                    items = typeof row.items_json === 'string' 
                                        ? JSON.parse(row.items_json) 
                                        : (row.items_json || []); 
                                } catch(e) { items = []; }
                                
                                return (
                                    <tr key={idx}>
                                        <td>
                                            <span className="date-tag">
                                                {new Date(row.date).toLocaleDateString('th-TH')}
                                            </span>
                                        </td>
                                        <td><span className="time-tag">{row.time}</span></td>
                                        <td><div className="td-user"><FaUser /> {row.fullname}</div></td>
                                        <td>
                                            <span className={`badge-type ${row.transaction_type_id}`}>
                                                {row.type_name}
                                            </span>
                                        </td>
                                        <td>
                                            {items.map((it, i) => (
                                                <div key={i} className="item-pill">
                                                    {it.name} <span className="item-qty">x{it.qty}</span>
                                                </div>
                                            ))}
                                        </td>
                                        <td>
                                            {row.open_time && row.close_time ? (
                                                <span className="duration-tag">{row.open_time} - {row.close_time}</span>
                                            ) : <span className="text-muted">ไม่ระบุ</span>}
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="6" className="empty-row">ไม่มีกิจกรรมในช่วงเวลานี้</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default ManagerDashboard;