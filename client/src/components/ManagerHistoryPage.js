import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { 
    FaBoxOpen, FaReply, FaHandHolding, FaClock, FaUsers
} from 'react-icons/fa';
import './ManagerHistoryPage.css'; 

const API_BASE = process.env.REACT_APP_API_URL;

function ManagerHistoryPage({ viewDate }) {
    const [history, setHistory] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // --- Filter States ---
    const [filter, setFilter] = useState('ALL');
    const [selectedUser, setSelectedUser] = useState('ALL');
    const [repairFilter, setRepairFilter] = useState('ALL');
    const [machineFilter, setMachineFilter] = useState('ALL');
    const [buildingFilter, setBuildingFilter] = useState('ALL');
    const [deptFilter, setDeptFilter] = useState('ALL');
    
    // ตั้งวันที่เริ่มต้นตามที่ส่งมาหรือวันที่ปัจจุบัน
    const [startDate, setStartDate] = useState(viewDate || new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(viewDate || new Date().toISOString().split('T')[0]);

    // --- Master Data for Filters ---
    const [repairTypes, setRepairTypes] = useState([]);
    const [machines, setMachines] = useState([]);
    const [departments, setDepartments] = useState([]);

    const fetchData = useCallback(async () => {
        if (!startDate || !endDate) return;
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [historyRes, usersRes, rep, mac, dep] = await Promise.all([
                axios.get(`${API_BASE}/api/history/manager/full`, {
                    headers,
                    params: { startDate, endDate }
                }),
                axios.get(`${API_BASE}/api/users`, { headers }),
                axios.get(`${API_BASE}/api/repair-types`, { headers }),
                axios.get(`${API_BASE}/api/machine`, { headers }),
                axios.get(`${API_BASE}/api/departments`, { headers })
            ]);
            
            setHistory(historyRes.data || []);
            setUsers(usersRes.data || []);
            setRepairTypes(rep.data || []);
            setMachines(mac.data || []);
            setDepartments(dep.data || []);
        } catch (err) {
            console.error("Fetch data error:", err);
            setHistory([]);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredData = useMemo(() => {
        return history.filter(item => {
            const matchType = filter === 'ALL' 
                ? true 
                : filter === 'PENDING' 
                    ? (item.is_pending === 1 && item.transaction_type_id === 'T-WTH')
                    : (item.transaction_type_id === filter && item.is_pending === 0);
            
            const matchUser = selectedUser === 'ALL' ? true : String(item.user_id) === String(selectedUser);
            const matchRepair = repairFilter === 'ALL' ? true : item.repair_type_id === Number(repairFilter);
            const matchMachine = machineFilter === 'ALL' ? true : item.machine_id === String(machineFilter);
            const matchBuilding = buildingFilter === 'ALL' ? true : item.buildings === buildingFilter;
            const matchDept = deptFilter === 'ALL' ? true : String(item.department_id) === String(deptFilter);
            
            return matchType && matchUser && matchRepair && matchMachine && matchBuilding && matchDept;
        });
    }, [history, filter, selectedUser, repairFilter, machineFilter, buildingFilter, deptFilter]);

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
                
                {/* Filters Grid */}
                <div className="history-filters-grid-manager">
                    <div className="filter-item">
                        <label>คัดกรองพนักงาน</label>
                        <select className="modern-select highlight" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                            <option value="ALL">พนักงานทุกคน</option>
                            {users.map(u => <option key={u.user_id} value={u.user_id}>{u.fullname}</option>)}
                        </select>
                    </div>
                    <div className="filter-item">
                        <label>ตั้งแต่วันที่</label>
                        <input type="date" className="modern-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="filter-item">
                        <label>ถึงวันที่</label>
                        <input type="date" className="modern-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="filter-item">
                        <label>ประเภทรายการ</label>
                        <select className="modern-select" value={filter} onChange={e => setFilter(e.target.value)}>
                            <option value="ALL">ทั้งหมด</option>
                            <option value="T-WTH">เบิกปกติ</option>
                            <option value="PENDING">เบิกล่วงหน้า</option>
                            <option value="T-RTN">คืนอะไหล่</option>
                        </select>
                    </div>
                    <div className="filter-item">
                        <label>ประเภทงาน</label>
                        <select className="modern-select" value={repairFilter} onChange={e => setRepairFilter(e.target.value)}>
                            <option value="ALL">ทุกประเภทงาน</option>
                            {repairTypes.map(t => <option key={t.repair_type_id} value={t.repair_type_id}>{t.repair_type_name}</option>)}
                        </select>
                    </div>
                    <div className="filter-item">
                        <label>เครื่องที่นำไปใช้</label>
                        <select className="modern-select" value={machineFilter} onChange={e => setMachineFilter(e.target.value)}>
                            <option value="ALL">ทุกเครื่องมือ</option>
                            {machines.map(m => (
                                <option key={m.machine_id} value={m.machine_id}>
                                    {m.machine_type_name} - {m.machine_supplier} - {m.machine_model}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="filter-item">
                        <label>ตึก</label>
                        <select className="modern-select" value={buildingFilter} onChange={e => {setBuildingFilter(e.target.value); setDeptFilter('ALL');}}>
                            <option value="ALL">ทุกตึก</option>
                            {[...new Set(departments.map(d => d.buildings))].filter(b => b).map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div className="filter-item">
                        <label>แผนก</label>
                        <select className="modern-select" value={deptFilter} onChange={e => setDeptFilter(e.target.value)} disabled={buildingFilter === 'ALL'}>
                            <option value="ALL">ทุกแผนก</option>
                            {departments
                                .filter(d => buildingFilter === 'ALL' || d.buildings === buildingFilter)
                                .map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)
                            }
                        </select>
                    </div>
                </div>
            </header>

            <section className="history-card">
                <div className="desktop-only">
                    {/* ส่วนจัดการสไลด์ตาราง */}
                    <div className="table-responsive-wrapper">
                        <table className="report-table manager-table">
                            <thead>
                                <tr>
                                    <th className="sticky-col">วันที่/เวลา</th>
                                    <th>รหัสอ้างอิง</th>
                                    <th>ผู้ทำรายการ</th>
                                    <th>ประเภท</th>
                                    <th>ประเภทงาน</th>
                                    <th>ตึก / แผนก</th>
                                    <th>เครื่องที่นำไปใช้</th>
                                    <th>รายการอะไหล่</th>
                                    <th>จำนวน</th>
                                    <th>เวลาเปิด-ปิดตู้</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.length > 0 ? filteredData.map((row, idx) => {
                                    const items = typeof row.items_json === 'string' ? JSON.parse(row.items_json) : (row.items_json || []);
                                    return (
                                        <tr key={idx} className={row.parent_transaction_id ? "row-sub-activity" : ""}>
                                            {/* 1. วันที่/เวลา (ตรึง) */}
                                            <td className="sticky-col">
                                                <div className="date-text">{new Date(row.date).toLocaleDateString('th-TH')}</div>
                                                <span className="time-tag"><FaClock size={10} style={{marginRight: '4px'}} />{row.time}</span>
                                            </td>

                                            {/* 2. รหัสอ้างอิง */}
                                            <td>
                                                <div className="tx-id-container">
                                                    <span className="tx-id-badge-main">{row.transaction_id}</span>
                                                    {row.parent_transaction_id && (
                                                        <div className="ref-link-text"><small>Ref: {row.parent_transaction_id}</small></div>
                                                    )}
                                                </div>
                                            </td>
                                            
                                            {/* 3. ผู้ทำรายการ */}
                                            <td>
                                                <div className="td-user">
                                                    {row.profile_img ? (
                                                        <img src={`${API_BASE}/profile-img/${row.profile_img}`} alt="avatar" className="user-avatar-mini" />
                                                    ) : (
                                                        <div className="avatar-placeholder-mini">{row.fullname?.charAt(0).toUpperCase()}</div>
                                                    )}
                                                    <span className="user-name-text">{row.fullname}</span>
                                                </div>
                                            </td>

                                            {/* 4-7. ประเภท รายงาน สถานที่ เครื่องมือ */}
                                            <td>{renderTypeBadge(row)}</td>
                                            <td>
                                                <div className={`repair-tag ${row.repair_type_id === 1 ? 'repair-job' : 'pm-job'}`}>
                                                    {row.repair_type_name || "-"}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="location-stack">
                                                    <div className="building-name">{row.buildings || "-"}</div>
                                                    <div className="dept-name">{row.department_name || "-"}</div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="machine-info-box">
                                                    <div className="text-sm font-bold">{row.machine_name || "-"}</div>
                                                    <div className="text-xs text-gray-500">SN: {row.machine_SN || "-"}</div>
                                                </div>
                                            </td>

                                            {/* 8-9. อะไหล่ และ จำนวน (แยกคอลัมน์ + เอากรอบออก) */}
                                            <td className="items-list-cell">
                                                {items.map((it, i) => (
                                                    <div key={i} className="item-name-row">{it.name}</div>
                                                ))}
                                            </td>
                                            <td className="qty-list-cell">
                                                {items.map((it, i) => (
                                                    <div key={i} className="item-qty-row">x{it.qty}</div>
                                                ))}
                                            </td>

                                            {/* 10. เวลาเปิด-ปิด */}
                                            <td>
                                                <div className="access-logs-badges">
                                                    <div className="log-badge-item"><span className="badge-open">เปิด</span><span className="log-time">{row.open_time || '--:--'}</span></div>
                                                    <div className="log-badge-item"><span className="badge-close">ปิด</span><span className="log-time">{row.close_time || '--:--'}</span></div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }) : <tr><td colSpan="10" className="empty-row">ไม่พบข้อมูลประวัติในช่วงเวลาที่เลือก</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
                {/* Mobile View */}
                {/* ... ใส่ Mobile View เดิมของคุณตรงนี้ ... */}
            </section>
        </div>
    );
}

export default ManagerHistoryPage;