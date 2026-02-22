import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FaHistory, FaFilter, FaBoxOpen, FaReply, FaCalendarAlt } from 'react-icons/fa';
import './HistoryPage.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function HistoryPage({ user }) {
    const [history, setHistory] = useState([]);
    const [filter, setFilter] = useState('ALL'); 
    const [loading, setLoading] = useState(true);

    // 1. สร้าง State สำหรับช่วงวันที่
    // กำหนดค่าเริ่มต้นเป็นต้นเดือนถึงวันนี้
    const [startDate, setStartDate] = useState(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    );
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    // 2. ปรับฟังก์ชันดึงข้อมูลให้ส่ง Params วันที่ไปด้วย
    const fetchHistory = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE}/api/history/full`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { 
                    startDate: startDate, 
                    endDate: endDate 
                }
            });
            setHistory(res.data);
        } catch (err) {
            console.error("Fetch history error:", err);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);


    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const filteredData = filter === 'ALL' 
        ? history 
        : history.filter(item => item.transaction_type_id === filter);

    if (loading) return <div className="text-center p-10">กำลังโหลดประวัติการทำรายการ...</div>;

    return (
        <div className="history-container fade-in">
            <div className="history-header">
                <div className="title-section">
                    <FaHistory className="title-icon" />
                    <h2>ประวัติรายการ</h2>
                </div>

                {/* ส่วน Filters ที่จะปรับตามหน้าจออัตโนมัติ */}
                <div className="history-filters-wrapper">
                    <div className="history-date-picker-group">
                        <div className="date-input-wrapper">
                            <FaCalendarAlt className="input-icon" />
                            <input 
                                type="date" 
                                id="hist-start-date"
                                name="startDate"
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)} 
                                className="history-date-input"
                            />
                        </div>
                        <span className="date-separator">ถึง</span>
                        <div className="date-input-wrapper">
                            <FaCalendarAlt className="input-icon" />
                            <input 
                                type="date" 
                                id="hist-end-date"
                                name="endDate"
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)} 
                                className="history-date-input"
                            />
                        </div>
                    </div>
                    
                    <div className="filter-group">
                        <FaFilter className="filter-icon" />
                        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="history-select">
                            <option value="ALL">ทุกประเภท</option>
                            <option value="T-WTH">รายการเบิก</option>
                            <option value="T-RTN">รายการคืน</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* ส่วนแสดงตารางสำหรับ Laptop (พร้อม Horizontal Scroll ในมือถือ) */}
            <div className="history-card desktop-view">
                <div className="table-wrapper"> {/* เพิ่ม Wrapper ตรงนี้ */}
                    <table className="history-table">
                        <thead>
                            <tr>
                                <th>วัน/เวลา</th>
                                <th>ประเภท</th>
                                <th>รายการอะไหล่</th>
                                <th className="text-center">จำนวน</th>
                                <th>เลขครุภัณฑ์</th>
                                <th>เวลาเปิด-ปิด</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.length > 0 ? filteredData.map((row, index) => {
                                let items = [];
                                try {
                                    items = typeof row.items_json === 'string' 
                                        ? JSON.parse(row.items_json) 
                                        : (row.items_json || []);
                                } catch (e) { items = []; }

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
                                            <div className="item-names-column">
                                                {items.map((item, i) => (
                                                    <div key={i} className="item-row-detail">{item.name || "ไม่ทราบชื่อ"}</div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="text-center font-bold text-pink">
                                            <div className="item-qtys-column">
                                                {items.map((item, i) => (
                                                    <div key={i} className="item-row-detail">{item.qty || 0}</div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="font-bold">{row.machine_SN || "-"}</td>
                                        <td className="access-log-cell">
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
                                    <td colSpan="6" className="text-center p-10 text-gray-400">ไม่พบข้อมูลในช่วงวันที่เลือก</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- ส่วนแสดงผลแบบ Mobile (Card List) --- */}
            <div className="mobile-view">
                {filteredData.map((row, index) => {
                    let items = [];
                    try { items = typeof row.items_json === 'string' ? JSON.parse(row.items_json) : (row.items_json || []); } catch (e) { items = []; }
                    
                    return (
                        <div key={index} className={`history-mobile-card border-left-${row.transaction_type_id}`}>
                            <div className="card-mobile-header">
                                <span className="mobile-date">{new Date(row.date).toLocaleDateString('th-TH')} | {row.time}</span>
                                <span className={`type-badge ${row.transaction_type_id}`}>
                                    {row.transaction_type_id === 'T-WTH' ? 'เบิก' : 'คืน'}
                                </span>
                            </div>
                            
                            <div className="card-mobile-body">
                                <div className="mobile-item-list">
                                    {items.map((item, i) => (
                                        <div key={i} className="mobile-item-row">
                                            <span className="item-name">{item.name}</span>
                                            <span className="item-qty">x {item.qty}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mobile-meta">
                                    <strong>ครุภัณฑ์:</strong> {row.machine_SN || "-"}
                                </div>
                                <div className="mobile-access-logs">
                                    <span className="log-tag">เปิด: {row.open_time || '--:--'}</span>
                                    <span className="log-tag">ปิด: {row.close_time || '--:--'}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default HistoryPage;