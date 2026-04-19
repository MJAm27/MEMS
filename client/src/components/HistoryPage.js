import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
    FaHistory, FaBoxOpen, FaReply,
    FaHandHolding, FaClock
} from 'react-icons/fa';
import './HistoryPage.css';

const API_BASE = process.env.REACT_APP_API_URL;

function HistoryPage({ user }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [filter, setFilter] = useState('ALL');
    const [repairFilter, setRepairFilter] = useState('ALL');
    const [machineFilter, setMachineFilter] = useState('ALL');
    const [buildingFilter, setBuildingFilter] = useState('ALL');
    const [deptFilter, setDeptFilter] = useState('ALL');
    
    const [startDate, setStartDate] = useState(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    );
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const [repairTypes, setRepairTypes] = useState([]);
    const [machines, setMachines] = useState([]);
    const [departments, setDepartments] = useState([]);

    const fetchMasterData = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const [rep, mac, dep] = await Promise.all([
                axios.get(`${API_BASE}/api/repair-types`, { headers }),
                axios.get(`${API_BASE}/api/machine`, { headers }),
                axios.get(`${API_BASE}/api/departments`, { headers })
            ]);
            setRepairTypes(rep.data);
            setMachines(mac.data);
            setDepartments(dep.data);
        } catch (err) {
            console.error("Fetch master data error:", err);
        }
    }, []);

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
        fetchMasterData();
        fetchHistory();
    }, [fetchHistory, fetchMasterData]);

    const parseItems = (jsonStr) => {
        try {
            return typeof jsonStr === 'string' ? JSON.parse(jsonStr) : (jsonStr || []);
        } catch (e) { return []; }
    };


    const renderTypeBadge = (row) => {
        const isSubActivity = !!row.parent_transaction_id;
        if (row.transaction_type_id === 'T-RTN') {
            return <span className="type-badge type-return"><FaReply /> คืนอะไหล่</span>;
        }
        if (row.is_pending === 1) {
            return <span className="type-badge type-pending"><FaHandHolding /> เบิกล่วงหน้า</span>;
        }
        return (
            <span className="type-badge type-withdraw">
                <FaBoxOpen /> {isSubActivity ? 'สรุปใช้จริง' : 'เบิกปกติ'}
            </span>
        );
    };


    const filteredData = history.filter(item => {
        const matchType = filter === 'ALL' || (filter === 'PENDING' ? item.is_pending === 1 : item.transaction_type_id === filter);
        const matchRepair = repairFilter === 'ALL' || String(item.repair_type_id) === repairFilter;
        const matchMachine = machineFilter === 'ALL' || String(item.machine_id) === machineFilter;
        const matchBuilding = buildingFilter === 'ALL' || item.buildings === buildingFilter;
        const matchDept = deptFilter === 'ALL' || String(item.department_id) === deptFilter;
        return matchType && matchRepair && matchMachine && matchBuilding && matchDept;
    });

    if (loading) return <div className="loading-state">กำลังโหลดประวัติ...</div>;

    return (
        <div className="history-container fade-in">
            <header className="history-header">
                <div className="title-section">
                    <FaHistory size={24} />
                    <h2>ประวัติการทำรายการ</h2>
                </div>
                
                <div className="history-filters-grid">
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
                            <option value="T-WTH">เบิกปกติ/สรุปผล</option>
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
                                    {`${m.machine_type_name} - ${m.machine_supplier} - ${m.machine_model}`}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="filter-item">
                        <label>ตึก</label>
                        <select className="modern-select" value={buildingFilter} onChange={e => {setBuildingFilter(e.target.value); setDeptFilter('ALL');}}>
                            <option value="ALL">ทุกตึก</option>
                            {[...new Set(departments.map(d => d.buildings))].map(b => <option key={b} value={b}>{b}</option>)}
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
                <div className="desktop-only ">
                    <div className="table-responsive-wrapper">
                        <table className="history-table">
                            <thead>
                                <tr>
                                    <th className="sticky-col">วัน/เวลา</th>
                                    <th>รหัสอ้างอิง</th>
                                    <th>ประเภทรายการ</th>
                                    <th>ประเภทงาน</th>
                                    <th>ตึก/แผนก</th>
                                    <th>เครื่องที่นำไปใช้</th>
                                    <th>เลขครุภัณฑ์ (รพ.)</th>
                                    <th>SN (โรงงาน)</th>
                                    <th>รายการอะไหล่</th>
                                    <th>จำนวน</th>
                                    <th>เวลาเปิด-ปิด</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map((row, index) => (
                                    <tr key={index} className={row.parent_transaction_id ? "row-sub-activity" : ""}>
                                        <td className="sticky-col">
                                            <div className="date-text">{new Date(row.date).toLocaleDateString('th-TH')}</div>
                                            <div className="time-sub-text"><FaClock size={10} /> {row.time}</div>
                                        </td>
                                        <td>
                                            <div className="tx-id-badge">{row.transaction_id}</div>
                                            {row.parent_transaction_id && <div className="ref-link-badge">Ref: {row.parent_transaction_id}</div>}
                                        </td>
                                        <td>{renderTypeBadge(row)}</td>
                                        <td className="font-semibold text-blue-600">
                                            {row.repair_type_name || (row.is_pending === 1 ? "-" : "-")}
                                        </td>
                                        <td>
                                            <div className="location-info">
                                                <b>{row.buildings || (row.is_pending === 1 ? "-" : "-")}</b>
                                            </div>
                                            <div className="dept-info">{row.department_name || (row.is_pending === 1 ? "รอระบุแผนก" : "-")}</div>
                                        </td>
                                        <td>{row.machine_name || (row.is_pending === 1 ? "รอระบุเครื่อง" : "-")}</td>
                                        <td className="font-bold">{row.machine_number || "-"}</td>
                                        <td>{row.machine_SN || "-"}</td>
                                        <td>
                                            {parseItems(row.items_json).map((item, i) => (
                                                <div key={i} className="item-name-text">{item.name}</div>
                                            ))}
                                        </td>
                                        <td>
                                            {parseItems(row.items_json).map((item, i) => (
                                                <div key={i} className="font-bold text-pink-600">x{item.qty}</div>
                                            ))}
                                        </td>
                                        <td>
                                            <div className="access-log-summary">
                                                <div className="time-line">
                                                    <span className="badge-open">เปิด</span>
                                                    <span className="time-value">{row.open_time || '--:--'}</span>
                                                </div>
                                                <div className="time-line">
                                                    <span className="badge-close">ปิด</span>
                                                    <span className="time-value">{row.close_time || '--:--'}</span>
                                                </div>
                                                
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mobile-only">
                    {filteredData.map((row, index) => (
                        <div key={index} className="history-mobile-card">
                            <div className="m-card-header">
                                <div className="m-time-info">{new Date(row.date).toLocaleDateString('th-TH')} | {row.time}</div>
                                {renderTypeBadge(row)}
                            </div>
                            <div className="m-repair-tag">{row.repair_type_name || "ไม่ระบุประเภทงาน"}</div>
                            <div className="m-items-section">
                                {parseItems(row.items_json).map((item, i) => (
                                    <div key={i} className="m-item"><span>{item.name}</span> <b>x{item.qty}</b></div>
                                ))}
                            </div>
                            <div className="m-details-grid">
                                <div><small>เครื่อง:</small> {row.machine_name || '-'}</div>
                                <div><small>ครุภัณฑ์:</small> {row.machine_number || '-'}</div>
                                <div><small>ตึก:</small> {row.buildings || '-'}</div>
                                <div><small>แผนก:</small> {row.department_name || '-'}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

export default HistoryPage;