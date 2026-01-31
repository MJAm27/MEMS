import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHistory, FaFilter, FaBoxOpen, FaReply, FaClock } from 'react-icons/fa';
import './HistoryPage.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function HistoryPage({ user }) {
    const [history, setHistory] = useState([]);
    const [filter, setFilter] = useState('ALL'); // ALL, T-WTH (เบิก), T-RTN (คืน)
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE}/api/history/full`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHistory(res.data);
        } catch (err) {
            console.error("Fetch history error:", err);
        } finally {
            setLoading(false);
        }
    };

    // ระบบกรองข้อมูลตามประเภทรายการ
    const filteredData = filter === 'ALL' 
        ? history 
        : history.filter(item => item.transaction_type_id === filter);

    if (loading) return <div className="text-center p-10">กำลังโหลดประวัติการทำรายการ...</div>;

    return (
        <div className="history-container">
            <div className="history-header">
                <div className="title-section">
                    <FaHistory className="title-icon" />
                    <h2>ประวัติการทำรายการ</h2>
                </div>
                
                <div className="filter-group">
                    <FaFilter className="filter-icon" />
                    <select value={filter} onChange={(e) => setFilter(e.target.value)} className="history-select">
                        <option value="ALL">ทั้งหมด</option>
                        <option value="T-WTH">รายการเบิกอะไหล่</option>
                        <option value="T-RTN">รายการคืนอะไหล่</option>
                    </select>
                </div>
            </div>

            <div className="history-card">
                <div className="table-responsive">
                    <table className="history-table">
                        <thead>
                            <tr>
                                <th>วัน/เวลา รายการ</th>
                                <th>ประเภท</th>
                                <th>รายการอะไหล่</th>
                                <th className="text-center">จำนวน</th>
                                <th>เลขครุภัณฑ์</th>
                                <th><FaClock /> เวลาเปิด-ปิดตู้</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.length > 0 ? filteredData.map((row, index) => {
                                // --- ส่วนสำคัญ: แปลงข้อมูลรายการอะไหล่จาก JSON ---
                                let items = [];
                                try {
                                    // ตรวจสอบว่า Backend ส่งมาเป็น String หรือ Object
                                    items = typeof row.items_json === 'string' 
                                        ? JSON.parse(row.items_json) 
                                        : (row.items_json || []);
                                } catch (e) {
                                    console.error("Parse items error:", e);
                                    items = [];
                                }

                                return (
                                    <tr key={index}>
                                        <td className="time-cell">
                                            <div className="date-text">{new Date(row.date).toLocaleDateString('th-TH')}</div>
                                            <div className="time-text">{row.time}</div>
                                        </td>
                                        <td>
                                            <span className={`type-badge ${row.transaction_type_id}`}>
                                                {row.transaction_type_id === 'T-WTH' ? <FaBoxOpen /> : <FaReply />}
                                                {row.type_name}
                                            </span>
                                        </td>
                                        <td>
                                            {/* แสดงรายการชื่ออะไหล่แยกบรรทัด */}
                                            <div className="item-names-column">
                                                {items.map((item, i) => (
                                                    <div key={i} className="item-row-detail">
                                                        {item.name || "ไม่ทราบชื่ออะไหล่"}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="text-center font-bold text-pink">
                                            {/* แสดงจำนวนแยกบรรทัดให้ตรงกับชื่อ */}
                                            <div className="item-qtys-column">
                                                {items.map((item, i) => (
                                                    <div key={i} className="item-row-detail">
                                                        {item.qty || 0}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="font-bold">{row.machine_SN || "-"}</td>
                                        <td className="access-log-cell">
                                            {/* ดึงเวลาจาก accesslogs ตาม action_type_id */}
                                            <div className="status-timeline">
                                                <div className={`time-badge ${row.open_time ? 'active-open' : ''}`}>
                                                    <small>เปิด:</small> {row.open_time || '--:--'}
                                                </div>
                                                <div className={`time-badge ${row.close_time ? 'active-close' : ''}`}>
                                                    <small>ปิด:</small> {row.close_time || '--:--'}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="6" className="text-center p-10 text-gray-400">ไม่พบข้อมูลประวัติในช่วงนี้</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default HistoryPage;