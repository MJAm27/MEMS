import React, { useState, useLayoutEffect } from "react";
import { useNavigate, Routes, Route } from "react-router-dom"; 
import {
    FaBars, FaHome, FaSearch, FaHistory, FaSignOutAlt, 
    FaBoxOpen, FaReply, FaHandHolding, FaUserEdit, FaCheckCircle
} from "react-icons/fa";
import "./EngineerMainPage.css"; 

import ProfileENG from './ProfileENG'; 
import ProfileEditENG from './ProfileEditENG'; 
import ReturnPartPage from './ReturnPartPage';
import WithdrawPage from './WithdrawPage';
import HistoryPage from "./HistoryPage";

function EngineerMainPage({ user, handleLogout, refreshUser }) { 
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768); 

    useLayoutEffect(() => {
        const handleResize = () => setSidebarOpen(window.innerWidth > 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const localHandleLogout = () => {
        localStorage.removeItem("token"); 
        handleLogout(); 
    };

    if (!user) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>กำลังโหลดข้อมูลวิศวกร...</p>
            </div>
        );
    }

    // UI ส่วนหน้าหลัก (Engineer Home)
    const HomeContent = (
        <div className="fade-in">
            <h1>หน้าหลักวิศวกร</h1>
            <p>ยินดีต้อนรับคุณ {user.fullname} เลือกเมนูเพื่อเริ่มดำเนินการ</p>
            <div className="main-actions-container">
                <button className="action-button secondary-action" onClick={() => navigate("/dashboard/engineer/withdraw")}>
                    <FaBoxOpen className="action-icon" />
                    <span>เบิกอะไหล่</span>
                </button>
                
                <button className="action-button secondary-action" onClick={() => navigate("/dashboard/engineer/return")}>
                    <FaReply className="action-icon" />
                    <span>คืนอะไหล่</span>
                </button>
                
                <button className="action-button secondary-action" onClick={() => navigate("/dashboard/engineer/borrow")}>
                    <FaHandHolding className="action-icon" />
                    <span>ยืมอะไหล่</span>
                </button>
            </div>
        </div>
    );

    return (
        <div className={`layout-wrapper ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
            {/* Sidebar */}
            <aside className="sidebar-container" style={{ left: sidebarOpen ? 0 : "-260px", transition: "0.3s" }}>
                <div className="sidebar-header" style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
                    <div className="brand"><h2>MEMS</h2></div>
                </div>
                <nav className="sidebar-nav" style={{ padding: '10px' }}>
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/home")}>
                        <FaHome /> <span>หน้าหลัก</span>
                    </button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/search")}>
                        <FaSearch /> <span>ค้นหาอะไหล่</span>
                    </button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/history")}>
                        <FaHistory /> <span>ประวัติการทำรายการ</span>
                    </button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/profile/edit")}>
                        <FaUserEdit /> <span>แก้ไขโปรไฟล์</span>
                    </button>
                    <div className="nav-divider"></div>
                    <button className="nav-link withdraw-link" onClick={() => navigate("/dashboard/engineer/withdraw")}>
                        <FaBoxOpen /> <span>เบิกอะไหล่</span>
                    </button>
                    <button className="nav-link return-link" onClick={() => navigate("/dashboard/engineer/return")}>
                        <FaReply /> <span>คืนอะไหล่</span>
                    </button>
                    <button className="nav-link borrow-link" onClick={() => navigate("/dashboard/engineer/borrow")}>
                        <FaHandHolding /> <span>ยืมอะไหล่</span>
                    </button>
                </nav>
                <button className="logout-btn-sidebar" onClick={localHandleLogout}>
                    <FaSignOutAlt /> ออกจากระบบ
                </button>
            </aside>

            {/* Main Content Area */}
            <main className="main-content-wrapper" style={{ marginLeft: sidebarOpen && window.innerWidth > 768 ? "260px" : "0" }}>
                <header className="top-navbar">
                    <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
                        <FaBars />
                    </button>
                    
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="user-profile-nav" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="user-name" style={{ fontWeight: '600' }}>{user?.fullname}</span>
                            <div className="avatar-circle">
                                {user.fullname?.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </header>

                <div className="content-body">
                    <Routes>
                        <Route index element={HomeContent} /> 
                        <Route path="engineer/home" element={HomeContent} />
                        
                        {/* ส่ง user prop เพื่อใช้บันทึก userId และดึงข้อมูลประวัติ */}
                        <Route path="engineer/withdraw" element={<WithdrawPage user={user} />} />
                        <Route path="engineer/return" element={<ReturnPartPage user={user} />} />
                        <Route path="engineer/history" element={<HistoryPage user={user} />} />
                        
                        <Route path="engineer/profile" element={<ProfileENG user={user} handleLogout={handleLogout} refreshUser={refreshUser} />}>
                            <Route path="edit" element={<ProfileEditENG user={user} refreshUser={refreshUser} />} />
                        </Route>

                        <Route path="engineer/search" element={<h2>หน้าค้นหาอะไหล่</h2>} />
                        <Route path="engineer/borrow" element={<h2 className="page-title">📦 หน้ายืมอะไหล่</h2>} />
                        <Route path="*" element={<h2>ไม่พบหน้าที่คุณต้องการ</h2>} />
                    </Routes>
                </div>
            </main>
        </div>
    );
}

export default EngineerMainPage;