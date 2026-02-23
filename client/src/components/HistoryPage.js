import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FaHistory, FaFilter, FaBoxOpen, FaReply, FaCalendarAlt } from 'react-icons/fa';
import './HistoryPage.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function HistoryPage({ user }) {
    const [history, setHistory] = useState([]);
    const [filter, setFilter] = useState('ALL'); 
    const [loading, setLoading] = useState(true);

    const [startDate, setStartDate] = useState(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    );
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchHistory = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE}/api/history/full`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { startDate, endDate }
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

    if (loading) return (
        <div className="history-container flex items-center justify-center">
            <div className="text-center p-10">กำลังโหลดประวัติการทำรายการ...</div>
        </div>
    );

    return (
        <div className="history-container fade-in">
            <div className="history-header">
                <div className="title-section">
                    <FaHistory size={24} />
                    <h2>ประวัติรายการ</h2>
                </div>

                <div className="history-filters-wrapper">
                    <div className="history-date-picker-group">
                        <div className="date-input-wrapper">
                            <FaCalendarAlt className="text-gray-400" />
                            <input 
                                type="date" 
                                id="hist-start-date"
                                name="startDate"
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)} 
                                className="history-date-input"
                            />
                        </div>
                        <span className="text-gray-400">ถึง</span>
                        <div className="date-input-wrapper">
                            <FaCalendarAlt className="text-gray-400" />
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
                        <FaFilter className="text-gray-400" />
                        <select 
                            value={filter} 
                            onChange={(e) => setFilter(e.target.value)} 
                            className="history-select"
                            name="typeFilter"
                        >
                            <option value="ALL">ทุกประเภท</option>
                            <option value="T-WTH">รายการเบิก</option>
                            <option value="T-RTN">รายการคืน</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Desktop View (ตาราง) */}
            <div className="history-card desktop-view">
                <div className="table-wrapper">
                    <table className="history-table">
                        <thead>
                            <tr>
                                <th>วัน/เวลา</th>
                                <th>ประเภท</th>
                                <th>รายการอะไหล่</th>
                                <th>จำนวน</th>
                                <th>เลขครุภัณฑ์</th>
                                <th>เวลาเปิด-ปิด</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.length > 0 ? filteredData.map((row, index) => {
                                const items = typeof row.items_json === 'string' 
                                    ? JSON.parse(row.items_json) 
                                    : (row.items_json || []);

                                return (
                                    <tr key={index}>
                                        <td>
                                            <span className="date-text">{new Date(row.date).toLocaleDateString('th-TH')}</span>
                                            <span className="time-text">{row.time}</span>
                                        </td>
                                        <td>
                                            <span className={`type-badge ${row.transaction_type_id}`}>
                                                {row.transaction_type_id === 'T-WTH' ? <FaBoxOpen /> : <FaReply />}
                                                {row.type_name}
                                            </span>
                                        </td>
                                        <td>
                                            {items.map((item, i) => (
                                                <div key={i} className="item-row-detail">{item.name || "ไม่ระบุ"}</div>
                                            ))}
                                        </td>
                                        <td>
                                            {items.map((item, i) => (
                                                <div key={i} className="item-row-detail font-bold text-pink-600">{item.qty}</div>
                                            ))}
                                        </td>
                                        <td className="font-bold">{row.machine_SN || "-"}</td>
                                        <td>
                                            <div className="status-timeline">
                                                <div className={`time-badge ${row.open_time ? 'active-open' : ''}`}>
                                                    <span>เปิด</span> <b>{row.open_time || '--:--'}</b>
                                                </div>
                                                <div className={`time-badge ${row.close_time ? 'active-close' : ''}`}>
                                                    <span>ปิด</span> <b>{row.close_time || '--:--'}</b>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="6" className="text-center py-20 text-gray-400">ไม่พบประวัติการทำรายการในช่วงวันที่เลือก</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile View (การ์ด) */}
            <div className="mobile-view">
                {filteredData.length > 0 ? filteredData.map((row, index) => {
                    const items = typeof row.items_json === 'string' ? JSON.parse(row.items_json) : (row.items_json || []);
                    
                    return (
                        <div key={index} className={`history-mobile-card border-left-${row.transaction_type_id}`}>
                            <div className="card-mobile-header">
                                <div className="mobile-date">
                                    {new Date(row.date).toLocaleDateString('th-TH')}
                                    <div className="time-text">{row.time}</div>
                                </div>
                                <span className={`type-badge ${row.transaction_type_id}`}>
                                    {row.transaction_type_id === 'T-WTH' ? 'เบิก' : 'คืน'}
                                </span>
                            </div>
                            
                            <div className="card-mobile-body">
                                <div className="mobile-item-list">
                                    {items.map((item, i) => (
                                        <div key={i} className="mobile-item-row">
                                            <span>{item.name}</span>
                                            <span className="font-bold">x{item.qty}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mobile-meta">
                                    <strong>ครุภัณฑ์:</strong> {row.machine_SN || "-"}
                                </div>
                                <div className="mobile-access-logs">
                                    <div className={`time-badge ${row.open_time ? 'active-open' : ''}`}>
                                        เปิด: {row.open_time || '--:--'}
                                    </div>
                                    <div className={`time-badge ${row.close_time ? 'active-close' : ''}`}>
                                        ปิด: {row.close_time || '--:--'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }) : <div className="text-center py-10 text-gray-400">ไม่มีข้อมูล</div>}
            </div>
        </div>
    );
}

export default HistoryPage;