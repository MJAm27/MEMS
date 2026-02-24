import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FaHistory, FaFilter, FaBoxOpen, FaReply, FaCalendarAlt, FaHandHolding, FaLink, FaClock } from 'react-icons/fa';
import './HistoryPage.css';

const API_BASE = process.env.REACT_APP_API_URL;

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
            
            const sortedData = res.data.sort((a, b) => {
                const dateA = new Date(`${a.date.split('T')[0]} ${a.time}`);
                const dateB = new Date(`${b.date.split('T')[0]} ${b.time}`);
                return dateB - dateA;
            });
            setHistory(sortedData);
        } catch (err) {
            console.error("Fetch history error:", err);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const parseItems = (jsonStr) => {
        try {
            return typeof jsonStr === 'string' ? JSON.parse(jsonStr) : (jsonStr || []);
        } catch (e) { return []; }
    };

    const calculateDuration = (open, close) => {
        if (!open || !close) return null;
        const start = new Date(`2026-01-01 ${open}`);
        const end = new Date(`2026-01-01 ${close}`);
        const diffSec = Math.floor((end - start) / 1000);
        return diffSec < 60 ? `${diffSec} วิ` : `${Math.floor(diffSec / 60)} นาที ${diffSec % 60} วิ`;
    };

    const renderTypeBadge = (row) => {
        const isSubActivity = !!row.parent_transaction_id;
        if (row.transaction_type_id === 'T-RTN') {
            return (
                <span className={`type-badge type-return ${isSubActivity ? 'linked' : ''}`}>
                    <FaReply /> {isSubActivity ? 'คืน (จากล่วงหน้า)' : 'คืนคลังปกติ'}
                </span>
            );
        }
        if (row.transaction_type_id === 'T-WTH') {
            if (row.is_pending === 1) {
                return <span className="type-badge type-pending"><FaHandHolding /> เบิกล่วงหน้า</span>;
            }
            return <span className="type-badge type-withdraw"><FaBoxOpen /> {isSubActivity ? 'บันทึกใช้จริง' : 'เบิกอะไหล่'}</span>;
        }
        return <span className="type-badge">{row.type_name}</span>;
    };

    const filteredData = filter === 'ALL'
        ? history
        : history.filter(item => {
            if (filter === 'PENDING') return item.is_pending === 1 && item.transaction_type_id === 'T-WTH';
            if (filter === 'T-WTH') return item.is_pending === 0 && item.transaction_type_id === 'T-WTH';
            return item.transaction_type_id === filter;
        });

    if (loading) return <div className="loading-state">กำลังโหลดประวัติ...</div>;

    return (
        <div className="history-container fade-in">
            <header className="history-header">
                <div className="title-section">
                    <FaHistory size={24} />
                    <h2>ประวัติการทำรายการ</h2>
                </div>
                
                <div className="history-filters-wrapper">
                    <div className="filter-item">
                        <label>ตั้งแต่วันที่</label>
                        <div className="input-with-icon">
                            <FaCalendarAlt className="icon" />
                            <input type="date" className="modern-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="filter-item">
                        <label>ถึงวันที่</label>
                        <div className="input-with-icon">
                            <FaCalendarAlt className="icon" />
                            <input type="date" className="modern-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="filter-item">
                        <label>ประเภท</label>
                        <div className="input-with-icon">
                            <FaFilter className="icon" />
                            <select className="modern-select" value={filter} onChange={e => setFilter(e.target.value)}>
                                <option value="ALL">ทั้งหมด</option>
                                <option value="T-WTH">เบิกปกติ</option>
                                <option value="PENDING">เบิกล่วงหน้า</option>
                                <option value="T-RTN">คืนอะไหล่</option>
                            </select>
                        </div>
                    </div>
                </div>
            </header>

            <section className="history-card">
                {/* Desktop Table View (Hidden on Mobile) */}
                <div className="desktop-only">
                    <table className="history-table">
                        <thead>
                            <tr>
                                <th>วันที่</th>
                                <th>รหัสอ้างอิง (ID)</th>
                                <th>ประเภท</th>
                                <th>รายการ</th>
                                <th>จำนวน</th>
                                <th>ครุภัณฑ์</th>
                                <th>เวลาเปิด-ปิดตู้</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((row, index) => (
                                <tr key={index} className={row.parent_transaction_id ? "row-sub-activity" : ""}>
                                    <td className="date-column">
                                        <div className="date-text">{new Date(row.date).toLocaleDateString('th-TH')}</div>
                                        <div className="time-sub-text"><FaClock size={10} /> {row.time}</div>
                                    </td>
                                    <td className="id-column">
                                        <div className="tx-id-badge">{row.transaction_id}</div>
                                        {row.parent_transaction_id && (
                                            <div className="ref-link-badge"><FaLink size={10} /> {row.parent_transaction_id}</div>
                                        )}
                                    </td>
                                    <td>{renderTypeBadge(row)}</td>
                                    <td>{parseItems(row.items_json).map((item, i) => <div key={i}>{item.name}</div>)}</td>
                                    <td>{parseItems(row.items_json).map((item, i) => <div key={i} className="font-bold text-pink-600">x{item.qty}</div>)}</td>
                                    <td className="font-bold">{row.machine_SN || "-"}</td>
                                    <td>
                                        <div className="access-log-container">
                                            <div className="time-row"><span className="time-label-open">เปิด</span> <b>{row.open_time || '--:--'}</b></div>
                                            <div className="time-row"><span className="time-label-close">ปิด</span> <b>{row.close_time || '--:--'}</b></div>
                                            {row.open_time && row.close_time && (
                                                <div className="duration-row">⏱ {calculateDuration(row.open_time, row.close_time)}</div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View (Hidden on Laptop) */}
                <div className="mobile-only">
                    {filteredData.map((row, index) => (
                        <div key={index} className={`history-mobile-card ${row.parent_transaction_id ? 'sub-card' : ''}`}>
                            <div className="mobile-card-header">
                                <div className="mobile-date-info">
                                    <span className="m-date">{new Date(row.date).toLocaleDateString('th-TH')}</span>
                                    <span className="m-time">{row.time}</span>
                                </div>
                                {renderTypeBadge(row)}
                            </div>
                            <div className="mobile-card-body">
                                <div className="m-id-badge">ID: {row.transaction_id}</div>
                                {row.parent_transaction_id && <div className="m-ref-link">🔗 อ้างอิง: {row.parent_transaction_id}</div>}
                                <div className="m-items-list">
                                    {parseItems(row.items_json).map((item, i) => (
                                        <div key={i} className="m-item-row">
                                            <span>{item.name}</span>
                                            <span className="m-qty">x{item.qty}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="m-footer">
                                    <span>ครุภัณฑ์: {row.machine_SN || "-"}</span>
                                    <div className="m-access-logs">
                                        <span>🔓 {row.open_time || '--'}</span>
                                        <span>🔒 {row.close_time || '--'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {filteredData.length === 0 && <div className="empty-row">ไม่พบประวัติการทำรายการ</div>}
            </section>
        </div>
    );
}

export default HistoryPage;