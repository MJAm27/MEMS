import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
     FaFilter, FaBoxOpen, FaReply, FaCalendarAlt, 
    FaHandHolding, FaLink, FaClock, FaUserCircle, FaUsers 
} from 'react-icons/fa';
import './ManagerHistoryPage.css'; 

const API_BASE = process.env.REACT_APP_API_URL;

function ManagerHistoryPage({ viewDate }) {
    const [history, setHistory] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [selectedUser, setSelectedUser] = useState('ALL');
    
    // ตั้งค่าเริ่มต้นของวันที่ให้ตรงกับ viewDate ที่ส่งมาจาก ManagerMainPage
    const [startDate, setStartDate] = useState(viewDate || new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(viewDate || new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (viewDate) {
            setStartDate(viewDate);
            setEndDate(viewDate);
        }
    }, [viewDate]);

    const fetchData = useCallback(async () => {
        if (!startDate || !endDate) return;

        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            const [historyRes, usersRes] = await Promise.all([
                axios.get(`${API_BASE}/api/history/manager/full`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { startDate, endDate } // ส่ง startDate และ endDate ไปกรองที่ Backend
                }),
                axios.get(`${API_BASE}/api/users`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            
            setHistory(historyRes.data);
            setUsers(usersRes.data);
        } catch (err) {
            console.error("Fetch data error:", err);
            setHistory([]); // ล้างข้อมูลเก่าถ้า Error เพื่อแสดง empty row
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]); // ให้ฟังก์ชันทำงานใหม่เมื่อวันที่เปลี่ยน

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredData = history.filter(item => {
        const matchType = filter === 'ALL' 
            ? true 
            : filter === 'PENDING' 
                ? (item.is_pending === 1 && item.transaction_type_id === 'T-WTH')
                : (item.transaction_type_id === filter && item.is_pending === 0);
        
        const matchUser = selectedUser === 'ALL' 
            ? true 
            : String(item.user_id) === String(selectedUser); 
        
        return matchType && matchUser;
    });

    const parseItems = (jsonStr) => {
        try { return typeof jsonStr === 'string' ? JSON.parse(jsonStr) : (jsonStr || []); } 
        catch (e) { return []; }
    };

    const calculateDuration = (open, close) => {
        if (!open || !close) return null;
        const start = new Date(`2000-01-01 ${open}`);
        const end = new Date(`2000-01-01 ${close}`);
        const diffSec = Math.floor((end - start) / 1000);
        if (diffSec < 0) return null;
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
            if (row.is_pending === 1) return <span className="type-badge type-pending"><FaHandHolding /> เบิกล่วงหน้า</span>;
            return <span className="type-badge type-withdraw"><FaBoxOpen /> {isSubActivity ? 'บันทึกใช้จริง' : 'เบิกอะไหล่'}</span>;
        }
        return <span className="type-badge">{row.type_name}</span>;
    };

    if (loading) return <div className="loading-state">กำลังโหลดข้อมูลประวัติ...</div>;

    return (
        <div className="history-container manager-version fade-in">
            <header className="history-header">
                <div className="title-section">
                    <FaUsers size={28} className="text-pink-600" />
                    <h2>รายงานประวัติการใช้งาน (Manager)</h2>
                </div>
                
                <div className="history-filters-wrapper">
                    <div className="filter-item">
                        <label>คัดกรองพนักงาน</label>
                        <div className="input-with-icon">
                            <FaUserCircle className="icon" />
                            <select className="modern-select highlight" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                                <option value="ALL">พนักงานทุกคน</option>
                                {users.map(u => <option key={u.user_id} value={u.user_id}>{u.fullname}</option>)}
                            </select>
                        </div>
                    </div>
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
                <div className="desktop-only">
                    <table className="history-table manager-table">
                        <thead>
                            <tr>
                                <th>ผู้ทำรายการ</th>
                                <th>วันที่/เวลา</th>
                                <th>รหัสอ้างอิง</th>
                                <th>ประเภท</th>
                                <th>รายการอะไหล่</th>
                                <th>ครุภัณฑ์</th>
                                <th>เวลาเปิด-ปิดตู้</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((row, index) => (
                                <tr key={index} className={row.parent_transaction_id ? "row-sub-activity" : ""}>
                                    <td className="user-column">
                                        <div className="user-info-cell">
                                            <div className="user-avatar-mini">
                                                {row.profile_img ? (
                                                    <img 
                                                        src={`${API_BASE}/profile-img/${row.profile_img}`} 
                                                        alt="profile" 
                                                        onError={(e) => { e.target.src = 'https://via.placeholder.com/40'; }} 
                                                    />
                                                ) : (
                                                    <div className="avatar-placeholder">
                                                        {row.fullname ? row.fullname.charAt(0).toUpperCase() : "?"}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="user-name-text">{row.fullname || "ไม่ระบุชื่อ"}</div>
                                        </div>
                                    </td>
                                    <td className="date-column">
                                        <div className="date-text">{new Date(row.date).toLocaleDateString('th-TH')}</div>
                                        <div className="time-sub-text"><FaClock size={10} /> {row.time}</div>
                                    </td>
                                    <td className="id-column">
                                        <div className="tx-id-badge">{row.transaction_id}</div>
                                        {row.parent_transaction_id && <div className="ref-link-badge"><FaLink size={10} /> {row.parent_transaction_id}</div>}
                                    </td>
                                    <td>{renderTypeBadge(row)}</td>
                                    <td className="items-cell">
                                        {parseItems(row.items_json).map((item, i) => (
                                            <div key={i} className="item-row"><span>{item.name}</span><span className="item-q">x{item.qty}</span></div>
                                        ))}
                                    </td>
                                    <td className="font-bold">{row.machine_id || "-"}</td>
                                    <td>
                                        <div className="access-log-container">
                                            <div className="time-row"><span className="time-label-open">เปิด</span> <b>{row.open_time || '--:--'}</b></div>
                                            <div className="time-row"><span className="time-label-close">ปิด</span> <b>{row.close_time || '--:--'}</b></div>
                                            {row.open_time && row.close_time && <div className="duration-tag">⏱ {calculateDuration(row.open_time, row.close_time)}</div>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mobile-only">
                    {filteredData.map((row, index) => (
                        <div key={index} className={`history-mobile-card ${row.parent_transaction_id ? 'sub-card' : ''}`}>
                            <div className="mobile-card-header">
                                <div className="user-info-mini">
                                    <div className="user-avatar-mini">
                                        {row.profile_img ? <img src={`${API_BASE}/profile-img/${row.profile_img}`} alt="p" /> : <FaUserCircle className="text-gray-300" />}
                                    </div>
                                    <span className="m-user-name">{row.fullname}</span>
                                </div>
                                {renderTypeBadge(row)}
                            </div>
                            <div className="mobile-card-body">
                                <div className="m-tx-info">
                                    <span className="m-tx-id">ID: {row.transaction_id}</span>
                                    <span className="m-date-time">{new Date(row.date).toLocaleDateString('th-TH')} | {row.time}</span>
                                </div>
                                <div className="m-items-box">
                                    {parseItems(row.items_json).map((item, i) => (
                                        <div key={i} className="m-item-row"><span>{item.name}</span><span className="m-qty">x{item.qty}</span></div>
                                    ))}
                                </div>
                                <div className="m-footer-info">
                                    <div>ครุภัณฑ์: <b>{row.machine_id || "-"}</b></div>
                                    <div className="m-access-logs">
                                        <span>🔓 {row.open_time || '--'}</span><span>🔒 {row.close_time || '--'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {filteredData.length === 0 && <div className="empty-row">ไม่พบข้อมูลประวัติในช่วงเวลาที่เลือก</div>}
            </section>
        </div>
    );
}

export default ManagerHistoryPage;