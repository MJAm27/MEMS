import React, { useState, useLayoutEffect, useCallback, useEffect } from "react";
import { useNavigate, Routes, Route } from "react-router-dom"; 
import axios from "axios";
import {
    FaBars, FaHome, FaSearch, FaHistory, FaSignOutAlt,
    FaBoxOpen, FaReply, FaHandHolding, FaUserEdit, FaCheckCircle,
    FaExclamationTriangle, FaTimes 
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
    }, [fetchPendingBorrows]);

    const handleInputChange = (borrowId, field, value) => {
        setFinalizeData(prev => ({
            ...prev,
            [borrowId]: { 
                ...(prev[borrowId] || {}),
                [field]: value
            }
        }));
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

        try {
            const token = localStorage.getItem('token');
            if (!token) return alert("กรุณาเข้าสู่ระบบใหม่");

            if (actionType === 'USE') {
                if (!snInput || qtyInput <= 0) {
                    return alert("กรุณากรอกเลขครุภัณฑ์และจำนวนที่ใช้จริงให้ถูกต้อง");
                }
                await axios.post(`${API_BASE}/api/borrow/finalize-partial`, {
                    transactionId: item.borrow_id,
                    equipmentId: item.equipment_id,
                    machineSN: snInput,
                    usedQty: qtyInput,
                    lotId: item.lot_id
                }, { headers: { Authorization: `Bearer ${token}` } });

                alert("ดำเนินการสำเร็จ");
                fetchPendingBorrows();
            }
        } catch (err) { 
            alert("เกิดข้อผิดพลาด: " + (err.response?.data?.error || err.message)); 
        }
    };

    const pendingBorrowListUI = (
        <div className="pending-container fade-in">
            <div className="section-title">
                <FaExclamationTriangle className="warn-icon" />
                <h3>รายการยืมล่วงหน้าที่รอการสรุป</h3>
            </div>
            {pendingItems.length === 0 ? (
                <div className="empty-pending-card">ไม่มีรายการอะไหล่ค้างจ่าย</div>
            ) : (
                <div className="pending-grid">
                    {pendingItems.map((item, index) => {
                        const uniqueKey = `${item.borrow_id}-${index}`;
                        const displayQtyToReturn = finalizeData[uniqueKey]?.usedQty || item.borrow_qty;
                        return (
                            <div key={uniqueKey} className="pending-card">
                                <div className="pending-info">
                                    <strong>{item.equipment_name}</strong>
                                    <p>คงเหลือในมือ: <b style={{ color: '#e91e63' }}>{item.borrow_qty}</b> ชิ้น</p>
                                    <small>วันที่เบิก: {new Date(item.borrow_date).toLocaleDateString('th-TH')}</small>
                                </div>
                                <div className="finalize-form">
                                    <label>ระบุเลขครุภัณฑ์:</label>
                                    <input type="text" placeholder="เช่น C-001..." value={finalizeData[uniqueKey]?.machineSN || ''} onChange={(e) => handleInputChange(uniqueKey, 'machineSN', e.target.value)} />
                                    <label>จำนวนที่ใช้จริง/คืน:</label>
                                    <div className="action-row">
                                        <input type="number" placeholder="จำนวน..." min="1" max={item.borrow_qty} value={finalizeData[uniqueKey]?.usedQty || ''} onChange={(e) => handleInputChange(uniqueKey, 'usedQty', e.target.value)} />
                                        <button className="btn-use-part" onClick={() => handleProcessBorrow(item, 'USE', uniqueKey)}><FaCheckCircle /> บันทึกการใช้</button>
                                    </div>
                                    <button className="btn-return-part" onClick={() => handlespecificReturn(item, uniqueKey)} style={{ marginTop: '5px', width: '100%' }}>
                                        <FaReply /> คืนคลัง ({displayQtyToReturn} ชิ้น)
                                    </button>
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
                </nav>
                <button className="logout-btn-sidebar" onClick={localHandleLogout}><FaSignOutAlt /> ออกจากระบบ</button>
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