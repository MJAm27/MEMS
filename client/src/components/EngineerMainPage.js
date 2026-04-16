import React, { useState, useLayoutEffect, useCallback, useEffect } from "react";
import { useNavigate, Routes, Route } from "react-router-dom"; 
import axios from "axios";
import {
    FaBars, FaHome, FaSearch, FaHistory, FaSignOutAlt,
    FaBoxOpen, FaReply, FaHandHolding, FaUserEdit, FaCheckCircle,
    FaExclamationTriangle 
} from "react-icons/fa";
import "./EngineerMainPage.css";

// Import Pages
import ProfileENG from './ProfileENG';
import ProfileEditENG from './ProfileEditENG';
import ReturnPartPage from './ReturnPartPage';
import WithdrawPage from './WithdrawPage';
import HistoryPage from "./HistoryPage";
import BorrowPage from "./BorrowPage";
import ChangePasswordENG from './ChangePasswordENG';
import SearchPartPageENG from './SearchPartPageENG';

const API_BASE = process.env.REACT_APP_API_URL;

function EngineerMainPage({ user, handleLogout, refreshUser }) {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [pendingItems, setPendingItems] = useState([]); 
    const [finalizeData, setFinalizeData] = useState({}); 
    const [machines, setMachines] = useState([]);
    const [repairTypes, setRepairTypes] = useState([]); 
    const [departments, setDepartments] = useState([]); 
    const [filteredDepsMap, setFilteredDepsMap] = useState({});

    const fetchMasterData = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const [repairRes, depRes] = await Promise.all([
                axios.get(`${API_BASE}/api/repair-types`, { headers }),
                axios.get(`${API_BASE}/api/departments`, { headers })
            ]);
            setRepairTypes(repairRes.data);
            setDepartments(depRes.data);
        } catch (err) {
            console.error("Fetch Master Data Error:", err);
        }
    }, []);

    // จัดการการเปิด-ปิด Sidebar ตามขนาดหน้าจอ
    useLayoutEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 768) {
                setSidebarOpen(true);
            } else {
                setSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ฟังก์ชันสำหรับเปลี่ยนหน้าและปิด Sidebar อัตโนมัติ (สำหรับมือถือ)
    const goTo = (path) => {
        navigate(path);
        if (window.innerWidth <= 768) {
            setSidebarOpen(false);
        }
    };

    const fetchMachines = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE}/api/machine`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMachines(res.data);
        } catch (err) {
            console.error("Fetch machines error:", err);
        }
    }, []);

    const fetchPendingBorrows = useCallback(async () => {
        if (!user?.user_id) return;
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE}/api/borrow/pending/${user.user_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPendingItems(res.data);
        } catch (err) {
            console.error("Fetch pending error:", err);
        }
    }, [user?.user_id]);

    useEffect(() => {
        fetchPendingBorrows();
        fetchMachines(); 
        fetchMasterData();
    }, [fetchPendingBorrows, fetchMachines, fetchMasterData]);

    const handleInputChange = (uniqueKey, field, value) => {
        setFinalizeData(prev => ({
            ...prev,
            [uniqueKey]: { 
                ...(prev[uniqueKey] || {}),
                [field]: value
            }
        }));
        if (field === 'selectedBuilding') {
            const filtered = departments.filter(d => d.buildings === value);
            setFilteredDepsMap(prev => ({ ...prev, [uniqueKey]: filtered }));
            setFinalizeData(prev => ({
                ...prev,
                [uniqueKey]: { ...prev[uniqueKey], departmentId: '' }
            }));
        }
    };

    const localHandleLogout = () => {
        if (window.confirm("ต้องการออกจากระบบใช่หรือไม่?")) {
            localStorage.removeItem("token");
            handleLogout();
        }
    };

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const handlespecificReturn = (item, uniqueKey) => {
        const input = finalizeData[uniqueKey] || {};
        const qtyToReturn = parseInt(input.usedQty) > 0 ? parseInt(input.usedQty) : item.borrow_qty;

        if (qtyToReturn > item.borrow_qty) {
            return alert("จำนวนที่คืนห้ามเกินจำนวนที่มีอยู่ในมือ");
        }

        if (window.confirm(`ต้องการคืนอะไหล่ ${item.equipment_name} จำนวน ${qtyToReturn} ชิ้น?`)) {
            navigate("/dashboard/engineer/return", { 
                state: { 
                    preloadedItem: {
                        partId: item.equipment_id,
                        partName: item.equipment_name,
                        lotId: item.lot_id,
                        quantity: qtyToReturn,
                        borrowId: item.borrow_id, 
                        isFixed: true 
                    }
                } 
            });
            if (window.innerWidth <= 768) setSidebarOpen(false);
        }
    };

    const handleProcessBorrow = async (item, actionType, uniqueKey) => {
        const input = finalizeData[uniqueKey] || {}; 
        const snInput = input.machineSN ? input.machineSN.trim() : "";
        const qtyInput = parseInt(input.usedQty || 0);
        const machineNumberInput = input.machineNumber ? input.machineNumber.trim() : "";
        const machineIdInput = input.machineId;
        const repairTypeIdInput = input.repairTypeId;
        const departmentIdInput = input.departmentId;

        try {
            const token = localStorage.getItem('token');
            if (!token) return alert("กรุณาเข้าสู่ระบบใหม่");

            if (actionType === 'USE') {
                if (qtyInput <= 0) return alert("กรุณากรอกจำนวนที่ใช้จริง");
                await axios.post(`${API_BASE}/api/borrow/finalize-partial`, {
                    transactionId: item.borrow_id,
                    equipmentId: item.equipment_id,
                    lotId: item.lot_id,
                    usedQty: qtyInput,
                    machineSN: snInput,
                    machineNumber: machineNumberInput,
                    machineId: machineIdInput,
                    repairTypeId: repairTypeIdInput,
                    departmentId: departmentIdInput
                }, { headers: { Authorization: `Bearer ${token}` } });

                alert("ดำเนินการสำเร็จ");
                
                setFinalizeData(prev => {
                    const newData = { ...prev };
                    delete newData[uniqueKey];
                    return newData;
                });
                fetchPendingBorrows();
            }
        } catch (err) { 
            alert("เกิดข้อผิดพลาด: " + (err.response?.data?.error || err.message)); 
        }
    };

    const pendingBorrowListUI = (
        <div className="pending-container fade-in">
            <div className="section-header-main">
                <div className="title-with-icon">
                    <FaExclamationTriangle className="warn-icon-header" />
                    <h3>รายการยืมล่วงหน้าที่รอการสรุป</h3>
                </div>
                <span className="pending-count-badge">{pendingItems.length} รายการ</span>
            </div>

            {pendingItems.length === 0 ? (
                <div className="empty-pending-card">ไม่มีรายการอะไหล่ค้างจ่าย</div>
            ) : (
                <div className="pending-grid-modern">
                    {pendingItems.map((item, index) => {
                        const uniqueKey = `${item.borrow_id}-${index}`;
                        const cardFilteredDeps = filteredDepsMap[uniqueKey] || [];
                        
                        return (
                            <div key={uniqueKey} className="pending-card-modern">
                                {/* ส่วนหัวของการ์ด */}
                                <div className="card-top-info">
                                    <div className="equipment-main-name">
                                        <FaBoxOpen className="box-icon" />
                                        <strong>{item.equipment_name}</strong>
                                    </div>
                                    <div className="stock-in-hand">
                                        <span>ในมือ:</span>
                                        <strong className="qty-highlight">{item.borrow_qty}</strong>
                                        <small>ชิ้น</small>
                                    </div>
                                </div>
                                
                                <div className="date-ref-line">
                                    <span>วันที่เบิก: {new Date(item.borrow_date).toLocaleDateString('th-TH')}</span>
                                    <span className="ref-text">ID: {item.borrow_id}</span>
                                </div>

                                {/* ฟอร์มกรอกข้อมูล */}
                                <div className="finalize-form-modern">
                                    <div className="form-row-duo">
                                        <div className="form-group">
                                            <label>ประเภทงาน</label>
                                            <select 
                                                value={finalizeData[uniqueKey]?.repairTypeId || ''}
                                                onChange={(e) => handleInputChange(uniqueKey, 'repairTypeId', e.target.value)}
                                            >
                                                <option value="">-- เลือกประเภทงาน --</option>
                                                {repairTypes.map(rt => (
                                                    <option key={rt.repair_type_id} value={rt.repair_type_id}>{rt.repair_type_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>เครื่องที่นำไปใช้</label>
                                            <select 
                                                className="withdraw-input-modern" 
                                                // เปลี่ยนมาดึงค่าจาก finalizeData ตาม uniqueKey ของการ์ดนั้นๆ
                                                value={finalizeData[uniqueKey]?.machineId || ''} 
                                                // ใช้ handleInputChange เพื่ออัปเดตค่าแยกตาม uniqueKey
                                                onChange={(e) => handleInputChange(uniqueKey, 'machineId', e.target.value)}
                                            >
                                                <option value="">-- เลือกเครื่องมือ --</option>
                                                {machines.map((m) => (
                                                    <option key={m.machine_id} value={m.machine_id}>
                                                        {`${m.machine_type_name} - ${m.machine_supplier} - ${m.machine_model}`}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-row-duo">
                                        <div className="form-group">
                                            <label>ตึก</label>
                                            <select 
                                                value={finalizeData[uniqueKey]?.selectedBuilding || ''}
                                                onChange={(e) => handleInputChange(uniqueKey, 'selectedBuilding', e.target.value)}
                                            >
                                                <option value="">-- ตึก --</option>
                                                {[...new Set(departments.map(d => d.buildings))].map(b => (
                                                    <option key={b} value={b}>{b}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>แผนก</label>
                                            <select 
                                                value={finalizeData[uniqueKey]?.departmentId || ''}
                                                onChange={(e) => handleInputChange(uniqueKey, 'departmentId', e.target.value)}
                                                disabled={!finalizeData[uniqueKey]?.selectedBuilding}
                                            >
                                                <option value="">-- แผนก --</option>
                                                {cardFilteredDeps.map(d => (
                                                    <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-row-duo">
                                        <div className="form-group">
                                            <label>เลขครุภัณฑ์ (รพ.)</label>
                                            <input type="text" placeholder="เช่น 1234/67" value={finalizeData[uniqueKey]?.machineNumber || ''} onChange={(e) => handleInputChange(uniqueKey, 'machineNumber', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label>SN (โรงงาน)</label>
                                            <input type="text" placeholder="Serial Number" value={finalizeData[uniqueKey]?.machineSN || ''} onChange={(e) => handleInputChange(uniqueKey, 'machineSN', e.target.value)} />
                                        </div>
                                    </div>

                                    {/* ส่วนบันทึกการใช้ */}
                                    <div className="action-footer-modern">
                                        <div className="usage-input-box">
                                            <label>จำนวนที่ใช้จริง</label>
                                            <div className="qty-control">
                                                <input 
                                                    type="number" 
                                                    min="1" 
                                                    max={item.borrow_qty} 
                                                    value={finalizeData[uniqueKey]?.usedQty || ''} 
                                                    onChange={(e) => handleInputChange(uniqueKey, 'usedQty', e.target.value)} 
                                                />
                                                <button className="btn-confirm-use" onClick={() => handleProcessBorrow(item, 'USE', uniqueKey)}>
                                                    <FaCheckCircle /> บันทึก
                                                </button>
                                            </div>
                                        </div>
                                        <button className="btn-return-warehouse" onClick={() => handlespecificReturn(item, uniqueKey)}>
                                            <FaReply /> คืนคลังทั้งหมด
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    const HomeContent = (
        <div className="engineer-home-wrapper">
            <div className="welcome-banner fade-in">
                <h1>หน้าหลักวิศวกร</h1>
                <p>เลือกเมนูเพื่อดำเนินการจัดการอะไหล่</p>
            </div>
            <div className="main-actions-container">
                <button className="action-button" onClick={() => goTo("/dashboard/engineer/withdraw")}><FaBoxOpen className="action-icon" /> <span>เบิกอะไหล่</span></button>
                <button className="action-button" onClick={() => goTo("/dashboard/engineer/return")}><FaReply className="action-icon" /> <span>คืนอะไหล่</span></button>
                <button className="action-button" onClick={() => goTo("/dashboard/engineer/borrow")}><FaHandHolding className="action-icon" /> <span>เบิกอะไหล่ล่วงหน้า</span></button>
            </div>
            {pendingBorrowListUI} 
        </div>
    );

    if (!user) return <div className="loading-screen"><div className="spinner"></div></div>;

    return (
        <div className={`layout-wrapper ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
            {/* Sidebar Overlay สำหรับมือถือ */}
            <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>

            <aside className="sidebar-container">
                <div className="sidebar-header"><div className="brand"><h2>MEMS ENGINEER</h2></div></div>
                <nav className="sidebar-nav">
                    <button className="nav-link" onClick={() => goTo("/dashboard/engineer/home")}><FaHome /> <span>หน้าหลัก</span></button>
                    <button className="nav-link" onClick={() => goTo("/dashboard/engineer/search")}><FaSearch /> <span>ค้นหาอะไหล่</span></button>
                    <button className="nav-link" onClick={() => goTo("/dashboard/engineer/history")}><FaHistory /> <span>ประวัติการทำรายการ</span></button>
                    <button className="nav-link" onClick={() => goTo("/dashboard/engineer/profile")}><FaUserEdit /> <span>แก้ไขโปรไฟล์</span></button>
                    <div className="nav-divider"></div>
                    <button className="nav-link" onClick={() => goTo("/dashboard/engineer/withdraw")}><FaBoxOpen /> <span>เบิกอะไหล่</span></button>
                    <button className="nav-link" onClick={() => goTo("/dashboard/engineer/return")}><FaReply /> <span>คืนอะไหล่</span></button>
                    <button className="nav-link" onClick={() => goTo("/dashboard/engineer/borrow")}><FaHandHolding /> <span>เบิกอะไหล่ล่วงหน้า</span></button>
                    <div className="nav-divider"></div> 
                    <button className="logout-btn-sidebar" onClick={localHandleLogout}>
                        <FaSignOutAlt /> <span>ออกจากระบบ</span>
                    </button>
                </nav>
                
            </aside>

            <main className="main-content-wrapper">
                <header className="top-navbar">
                    <button className="sidebar-toggle-btn" onClick={toggleSidebar}><FaBars /></button>
                    <div className="user-profile-nav">
                        <span className="user-name">{user?.fullname}</span>
                        <div className="avatar-circle">
                            {user?.profile_img ? <img src={`${API_BASE}/profile-img/${user.profile_img}`} alt="Profile" className="profile-img-circle" /> : user.fullname?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>
                <div className="content-body">
                    <Routes>
                        <Route index element={HomeContent} />
                        <Route path="engineer/home" element={HomeContent} />
                        <Route path="engineer/withdraw" element={<WithdrawPage user={user} />} />
                        <Route path="engineer/return" element={<ReturnPartPage user={user} />} />
                        <Route path="engineer/history" element={<HistoryPage user={user} />} />
                        <Route path="engineer/borrow" element={<BorrowPage user={user} />} />
                        <Route path="engineer/profile" element={<ProfileENG user={user} handleLogout={handleLogout} refreshUser={refreshUser} />}>
                            <Route path="edit" element={<ProfileEditENG user={user} refreshUser={refreshUser} />} />
                            <Route path="change-passwordENG" element={<ChangePasswordENG />} />
                        </Route>
                        <Route path="engineer/search" element={<SearchPartPageENG/>} />
                    </Routes>
                </div>
            </main>
        </div>
    );
}

export default EngineerMainPage;