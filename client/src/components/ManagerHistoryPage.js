import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { 
    FaBoxOpen, FaReply, FaHandHolding, FaClock, FaUserCircle, FaUsers
} from 'react-icons/fa';
import './ManagerHistoryPage.css'; 

const API_BASE = process.env.REACT_APP_API_URL;

function ManagerHistoryPage({ viewDate }) {
    const [history, setHistory] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // --- Filter States (รวมจากทั้ง 2 หน้า) ---
    const [filter, setFilter] = useState('ALL');
    const [selectedUser, setSelectedUser] = useState('ALL');
    const [repairFilter, setRepairFilter] = useState('ALL');
    const [machineFilter, setMachineFilter] = useState('ALL');
    const [buildingFilter, setBuildingFilter] = useState('ALL');
    const [deptFilter, setDeptFilter] = useState('ALL');
    
    const [startDate, setStartDate] = useState(viewDate || new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(viewDate || new Date().toISOString().split('T')[0]);

    // --- Master Data for Filters ---
    const [repairTypes, setRepairTypes] = useState([]);
    const [machines, setMachines] = useState([]);
    const [departments, setDepartments] = useState([]);

    // รวมการดึงข้อมูล Master Data และ History เข้าด้วยกัน
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
            
            setHistory(historyRes.data);
            setUsers(usersRes.data);
            setRepairTypes(rep.data);
            setMachines(mac.data);
            setDepartments(dep.data);
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

    // --- Logic การกรองข้อมูลแบบละเอียด ---
    const filteredData = useMemo(() => {
        return history.filter(item => {
            // กรองประเภทรายการ
            const matchType = filter === 'ALL' 
                ? true 
                : filter === 'PENDING' 
                    ? (item.is_pending === 1 && item.transaction_type_id === 'T-WTH')
                    : (item.transaction_type_id === filter && item.is_pending === 0);
            
            // กรองพนักงาน
            const matchUser = selectedUser === 'ALL' ? true : String(item.user_id) === String(selectedUser);
            
            // กรองประเภทงาน
            const matchRepair = repairFilter === 'ALL' ? true : item.repair_type_id === Number(repairFilter);
            
            // กรองเครื่องมือ
            const matchMachine = machineFilter === 'ALL' ? true : item.machine_id === Number(machineFilter);
            
            // กรองตึก
            const matchBuilding = buildingFilter === 'ALL' ? true : item.buildings === buildingFilter;
            
            // กรองแผนก
            const matchDept = deptFilter === 'ALL' ? true : item.department_id === Number(deptFilter);
            
            return matchType && matchUser && matchRepair && matchMachine && matchBuilding && matchDept;
        });
    }, [history, filter, selectedUser, repairFilter, machineFilter, buildingFilter, deptFilter]);

    const parseItems = (jsonStr) => {
        try { return typeof jsonStr === 'string' ? JSON.parse(jsonStr) : (jsonStr || []); } 
        catch (e) { return []; }
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
                                    {m.machine_name}
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
                    <table className="history-table manager-table">
                        <thead>
                            <tr>
                                <th>วันที่/เวลา</th>
                                <th>ผู้ทำรายการ</th>
                                <th>ประเภท</th>
                                <th>ประเภทงาน</th>
                                <th>ตึก/แผนก</th>
                                <th>เครื่องที่ใช้</th>           {/* แยกออกมา */}
                                <th>เลขครุภัณฑ์ (รพ.)</th>      {/* แยกออกมา */}
                                <th>SN (โรงงาน)</th>           {/* แยกออกมา */}
                                <th>รายการอะไหล่</th>
                                <th>เวลาเปิด-ปิดตู้</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((row, index) => {
                                const items = parseItems(row.items_json);
                                return (
                                    <tr key={index} className={row.parent_transaction_id ? "row-sub-activity" : ""}>
                                        <td className="date-column">
                                            <div className="date-text">{new Date(row.date).toLocaleDateString('th-TH')}</div>
                                            <div className="time-sub-text"><FaClock size={10} /> {row.time}</div>
                                        </td>

                                        <td className="user-column">
                                            <div className="user-info-cell">
                                                <div className="user-avatar-mini">
                                                    {row.profile_img ? (
                                                        <img src={`${API_BASE}/profile-img/${row.profile_img}`} alt="profile" />
                                                    ) : (
                                                        <div className="avatar-placeholder">{row.fullname?.charAt(0).toUpperCase()}</div>
                                                    )}
                                                </div>
                                                <div className="user-name-text">{row.fullname || "ไม่ระบุชื่อ"}</div>
                                            </div>
                                            <small className="tx-id-sub">Ref: {row.transaction_id}</small>
                                        </td>

                                        <td>{renderTypeBadge(row)}</td>

                                        <td className="font-semibold text-blue-600">{row.repair_type_name || "-"}</td>

                                        <td>
                                            <div className="text-xs"><b>{row.buildings || "-"}</b></div>
                                            <div className="text-xs text-gray-500">{row.department_name || "-"}</div>
                                        </td>

                                        {/* 1. คอลัมน์เครื่องที่ใช้ */}
                                        <td>{row.machine_name || "-"}</td>

                                        {/* 2. คอลัมน์เลขครุภัณฑ์ (รพ.) */}
                                        <td className="font-medium text-slate-700">{row.machine_number || "-"}</td>

                                        {/* 3. คอลัมน์ SN (โรงงาน) */}
                                        <td className="text-slate-500">{row.machine_SN || "-"}</td>

                                        <td className="items-cell">
                                            <div className="items-column-wrapper">
                                                {items.map((it, i) => (
                                                    <div key={i} className="item-pill-vertical">
                                                        <span className="item-name">{it.name}</span>
                                                        <span className="item-qty">x{it.qty}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>

                                        <td>
                                            <div className="access-log-container">
                                                <div className="time-row"><span className="time-label-open">เปิด</span> <b>{row.open_time || '--:--'}</b></div>
                                                <div className="time-row"><span className="time-label-close">ปิด</span> <b>{row.close_time || '--:--'}</b></div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View */}
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
                                    <div>ประเภทงาน: <b>{row.repair_type_name || "-"}</b></div>
                                    <div>ครุภัณฑ์/SN: <b>{row.machine_number || row.machine_SN || "-"}</b></div>
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