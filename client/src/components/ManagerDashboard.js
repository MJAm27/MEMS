import React, { useState,useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { Bar, Doughnut } from "react-chartjs-2";
import { 
    FaHandHolding, FaReply, FaUsers, FaChartLine, FaTimes, FaBoxOpen,
    FaCalendarDay, FaUser, FaTools, FaBuilding, FaExclamationCircle, FaBox, FaClock
} from "react-icons/fa";
import { 
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, 
    Title, Tooltip, Legend, ArcElement, PointElement, LineElement
} from "chart.js";

import "./ManagerDashboard.css"; 

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

const API_BASE_URL = process.env.REACT_APP_API_URL;

function ManagerDashboard() {
    const [todayData, setTodayData] = useState([]);
    const [pendingSummary, setPendingSummary] = useState({ total_pending: 0 }); 
    const [pendingDetails, setPendingDetails] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("usage");
    const [selectedBuilding, setSelectedBuilding] = useState("ALL");
    const [showPendingTable, setShowPendingTable] = useState(false);

    const fetchDashboardData = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            const [historyRes, pendingRes, detailsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/history/manager/full`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { startDate: today, endDate: today } 
                }),
                axios.get(`${API_BASE_URL}/api/borrow/all-pending`, { 
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_BASE_URL}/api/borrow/pending-details-all`, { 
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            setTodayData(historyRes.data || []);
            setPendingSummary(pendingRes.data || { total_pending: 0 }); 
            setPendingDetails(detailsRes.data || []);
        } catch (err) {
            console.error("Dashboard error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { 
        fetchDashboardData(); 
    }, [fetchDashboardData]);

    const renderTypeBadge = (row) => {
        const isSubActivity = !!row.parent_transaction_id; 
        if (row.transaction_type_id === 'T-RTN') {
            return (
                <span className="type-badge type-return">
                    <FaReply /> {isSubActivity ? 'คืน (จากล่วงหน้า)' : 'คืนคลังปกติ'}
                </span>
            );
        }
        
        if (row.transaction_type_id === 'T-WTH') {
            if (row.is_pending === 1) {
                return <span className="type-badge type-pending"><FaHandHolding /> เบิกล่วงหน้า</span>;
            }

            return (
                <span className="type-badge type-withdraw">
                    <FaBoxOpen /> {isSubActivity ? 'สรุปใช้จริง' : 'เบิกปกติ'}
                </span>
            );
        }
        return <span className="type-badge">{row.type_name}</span>;
    };
    
    const usageChartData = useMemo(() => {
        const actualActivities = todayData.filter(d => d.is_pending !== 1);
        const withdrawCount = actualActivities.filter(d => d.transaction_type_id === 'T-WTH').length;
        const returnCount = actualActivities.filter(d => d.transaction_type_id === 'T-RTN').length;

        return {
            labels: ['สรุปกิจกรรมวันนี้'],
            datasets: [
                { 
                    label: 'เบิกไปใช้จริง (ครั้ง)', 
                    data: [withdrawCount], 
                    backgroundColor: '#3b82f6', 
                    borderRadius: 8 
                },
                { 
                    label: 'คืนเข้าคลังทั้งหมด (ครั้ง)', 
                    data: [returnCount], 
                    backgroundColor: '#10b981', 
                    borderRadius: 8 
                }
            ]
        };
    }, [todayData]);

    const topPartsData = useMemo(() => {
        const counts = {};
        todayData.forEach(row => {
            const items = typeof row.items_json === 'string' ? JSON.parse(row.items_json) : (row.items_json || []);
            items.forEach(it => { counts[it.name] = (counts[it.name] || 0) + Number(it.qty); });
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        return {
            labels: sorted.map(x => x[0]),
            datasets: [{ label: 'จำนวนที่ใช้ (ชิ้น)', data: sorted.map(x => x[1]), backgroundColor: '#ff4d94', borderRadius: 8 }]
        };
    }, [todayData]);

    const repairStats = useMemo(() => {
        const types = {};
        
        const validData = todayData.filter(d => d.is_pending !== 1);

        validData.forEach(d => {
            const name = d.repair_type_name || "งานทั่วไป/ไม่ระบุ";
            types[name] = (types[name] || 0) + 1;
        });

        return { 
            chartData: { 
                labels: Object.keys(types), 
                datasets: [{ 
                    data: Object.values(types), 

                    backgroundColor: ['#f43f5e', '#3b82f6', '#fbbf24', '#10b981', '#8b5cf6', '#94a3b8'],
                    hoverOffset: 4
                }] 
            } 
        };
    }, [todayData]);

    const locationChartData = useMemo(() => {
        const counts = {};
        const dataToProcess = selectedBuilding === "ALL" ? todayData : todayData.filter(d => d.buildings === selectedBuilding);
        dataToProcess.forEach(d => {
            const name = selectedBuilding === "ALL" ? (d.buildings || "ไม่ระบุ") : (d.department_name || "ไม่ระบุแผนก");
            counts[name] = (counts[name] || 0) + 1;
        });
        return {
            labels: Object.keys(counts),
            datasets: [{ label: 'จำนวนครั้งที่ใช้งาน', data: Object.values(counts), backgroundColor: '#8b5cf6', borderRadius: 8 }]
        };
    }, [todayData, selectedBuilding]);

    const buildingOptions = useMemo(() => {
        const bSet = new Set(todayData.map(d => d.buildings).filter(b => b && b.trim() !== ""));
        return Array.from(bSet).sort();
    }, [todayData]);

    if (loading) return <div className="loading-container">กำลังประมวลผลข้อมูล...</div>;

    return (
        <div className="dashboard-container fade-in">
            <div className="dashboard-header-day">
                <h2><FaCalendarDay /> ข้อมูลสรุปประจำวันที่: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</h2>
            </div>

            <div className="report-summary-grid">
                <div className="summary-card info">
                    <FaHandHolding className="card-icon" />
                    <div className="card-text">
                        <span>เบิกวันนี้</span>
                        <strong>{todayData.filter(d => d.transaction_type_id === 'T-WTH' && d.is_pending !== 1).length} ครั้ง</strong>
                    </div>
                </div>
                <div className="summary-card success">
                    <FaReply className="card-icon" />
                    <div className="card-text">
                        <span>คืนวันนี้</span>
                        <strong>{todayData.filter(d => d.transaction_type_id === 'T-RTN').length} ครั้ง</strong>
                    </div>
                </div>
                <div className={`summary-card warning clickable-card ${showPendingTable ? 'active' : ''}`} onClick={() => setShowPendingTable(!showPendingTable)}>
                    <FaExclamationCircle className="card-icon" />
                    <div className="card-text">
                        <span>ค้างเบิกยืมล่วงหน้า</span>
                        <strong>{pendingSummary.total_pending || 0} ชิ้น</strong>
                        <small className="click-hint">คลิกดูรายละเอียด {showPendingTable ? '▲' : '▼'}</small>
                    </div>
                </div>
                <div className="summary-card purple">
                    <FaUsers className="card-icon" />
                    <div className="card-text"><span>ผู้เข้าใช้งานวันนี้</span><strong>{[...new Set(todayData.map(d => d.user_id))].length} คน</strong></div>
                </div>
            </div>

            <div className="chart-navigation-wrapper">
                <button className={`tab-btn ${activeTab === 'usage' ? 'active' : ''}`} onClick={() => setActiveTab('usage')}><FaChartLine /> การเบิก-คืน</button>
                <button className={`tab-btn ${activeTab === 'top-parts' ? 'active' : ''}`} onClick={() => setActiveTab('top-parts')}><FaBox /> อะไหล่ยอดนิยม 5 อันดับ</button>
                <button className={`tab-btn ${activeTab === 'location' ? 'active' : ''}`} onClick={() => setActiveTab('location')}><FaBuilding /> การใช้งานรายตึก</button>
                <button className={`tab-btn ${activeTab === 'repair-type' ? 'active' : ''}`} onClick={() => setActiveTab('repair-type')}><FaTools /> ประเภทงาน</button>
            </div>

            <div className="dashboard-main-chart-card">
                <div className="chart-container-large">
                    {activeTab === 'location' && (
                        <div className="animate-fadeIn">
                            <div className="chart-header-actions">
                                <h3>สรุปการเบิกอะไหล่แยกตามอาคาร/แผนก</h3>
                                <select className="chart-dropdown" value={selectedBuilding} onChange={(e) => setSelectedBuilding(e.target.value)}>
                                    <option value="ALL">-- แสดงทุกตึก --</option>
                                    {buildingOptions.map(b => <option key={b} value={b}>ตึก {b}</option>)}
                                </select>
                            </div>
                            <div className="chart-box"><Bar data={locationChartData} options={{ maintainAspectRatio: false }} /></div>
                        </div>
                    )}
                    {activeTab === 'usage' && <div className="animate-fadeIn"><h3>สถิติการเบิกและคืนอะไหล่วันนี้</h3><div className="chart-box"><Bar data={usageChartData} options={{ maintainAspectRatio: false }} /></div></div>}
                    {activeTab === 'top-parts' && <div className="animate-fadeIn"><h3>5 อันดับอะไหล่ที่มีการใช้สูงสุดประจำวัน</h3><div className="chart-box"><Bar data={topPartsData} options={{ indexAxis: 'y', maintainAspectRatio: false }} /></div></div>}
                    {activeTab === 'repair-type' && <div className="animate-fadeIn"><h3>สัดส่วนประเภทงานวันนี้</h3><div className="chart-box-pie"><Doughnut data={repairStats.chartData} options={{ maintainAspectRatio: false }} /></div></div>}
                </div>
            </div>

            {showPendingTable && (
                <div className="pending-details-section animate-fadeIn">
                    <div className="section-header"><h3><FaBoxOpen /> รายละเอียดอะไหล่ที่ค้างเบิกในมือพนักงาน</h3><button className="close-btn" onClick={() => setShowPendingTable(false)}><FaTimes /></button></div>
                    <div className="table-wrapper">
                        <table className="report-table">
                            <thead><tr><th>พนักงาน</th><th>วันที่เบิก</th><th>รายการอะไหล่</th><th>จำนวนค้าง</th><th>สถานะ</th></tr></thead>
                            <tbody>
                                {pendingDetails.length > 0 ? pendingDetails.map((row, idx) => (
                                    <tr key={idx}>
                                        <td><div className="td-user"><FaUser /> {row.fullname}</div></td>
                                        <td>{new Date(row.borrow_date).toLocaleDateString('th-TH')}</td>
                                        <td><b className="text-blue-600">{row.equipment_name}</b></td>
                                        <td><span className="pending-qty">x{row.borrow_qty}</span></td>
                                        <td><span className="badge-type PENDING">ค้างสรุป</span></td>
                                    </tr>
                                )) : <tr><td colSpan="5" className="empty-row">ไม่มีรายการค้างเบิก</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="report-table-section">
                <h3>รายละเอียดกิจกรรมเชิงลึก (กิจกรรมทั้งหมดวันนี้)</h3>
                <div className="table-wrapper">
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>วันที่/เวลา</th>
                                <th>รหัสอ้างอิง</th>
                                <th>ผู้ทำรายการ</th>
                                <th>ประเภท</th>
                                <th>ประเภทงาน</th>
                                <th>ตึก / แผนก</th>
                                <th>เครื่องที่นำไปใช้</th>
                                <th>รายการอะไหล่</th>
                                <th>จำนวน</th>
                            </tr>
                        </thead>
                        <tbody>
                            {todayData.length > 0 ? todayData.map((row, idx) => {
                                // แปลง JSON อะไหล่
                                const items = typeof row.items_json === 'string' 
                                    ? JSON.parse(row.items_json) 
                                    : (row.items_json || []);

                                return (
                                    <tr key={idx}>
                                        <td>
                                            <div className="date-text">
                                                {new Date(row.date).toLocaleDateString('th-TH')}
                                            </div>
                                            <span className="time-tag">
                                                <FaClock size={10} style={{marginRight: '4px'}} />
                                                {row.time}
                                            </span>
                                        </td>

                                        <td>
                                            <div className="tx-id-container">
                                                <span className="tx-id-main">{row.transaction_id}</span>
                                                {row.parent_transaction_id && (
                                                    <div className="ref-link-badge">
                                                        <small>Ref: {row.parent_transaction_id}</small>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        
                                        <td>
                                            <div className="td-user">
                                                {row.profile_img ? (
                                                    <img 
                                                        src={`${API_BASE_URL}/profile-img/${row.profile_img}`} 
                                                        alt="avatar" 
                                                        className="user-avatar-mini" 
                                                    />
                                                ) : (
                                                    <div className="avatar-placeholder-mini">
                                                        {row.fullname?.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="user-name-text">{row.fullname}</span>
                                            </div>
                                        </td>

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

                                        <td>
                                            {items.map((it, i) => (
                                                <div key={i} className="item-row-display">{it.name}</div>
                                            ))}
                                        </td>

                                        <td className="text-center">
                                            {items.map((it, i) => (
                                                <div key={i} className="qty-row-display">x{it.qty}</div>
                                            ))}
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="10" className="empty-row">ไม่มีกิจกรรมในช่วงวันนี้</td>
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