import React, { useState,useLayoutEffect} from "react";
import { useNavigate, Routes, Route  } from "react-router-dom"; 
import {
    FaBars,FaHome,FaSearch,FaHistory,FaSignOutAlt,FaBoxOpen,FaReply,FaHandHolding,FaUserEdit
} from "react-icons/fa";
import "./EngineerMainPage.css"; 

import ProfileENG from './ProfileENG'; 
import ProfileEditENG from './ProfileEditENG'; 
import ReturnPartPage from './ReturnPartPage';
import WithdrawPage from './WithdrawPage';


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

    // สร้าง UI ส่วนหน้าหลักซ้ำเพื่อใช้ในหลาย Route
    const HomeContent = (
        <div className="fade-in">
            <h1>หน้าหลักวิศวกร</h1>
            <p>เลือกเมนูที่ต้องการเพื่อเริ่มดำเนินการ</p>
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
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/home")} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '15px', cursor: 'pointer' }}>
                        <FaHome /> <span style={{ marginLeft: '10px' }}>หน้าหลัก</span>
                    </button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/search")}>
                        <FaSearch /> <span>ค้นหา</span>
                    </button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/history")}>
                        <FaHistory /> <span>ประวัติ</span>
                    </button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/profile/edit")}>
                        <FaUserEdit /> <span>แก้ไขโปรไฟล์</span>
                    </button>
                    <div className="nav-divider"></div>
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/withdraw")}>
                        <FaBoxOpen /> <span>เบิกอะไหล่</span>
                    </button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/return")}>
                        <FaReply /> <span>คืนอะไหล่</span>
                    </button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/borrow")}>
                        <FaHandHolding /> <span>ยืมอะไหล่</span>
                    </button>
                </nav>
                <button className="logout-btn-top" onClick={localHandleLogout} style={{ position: 'absolute', bottom: '20px', left: '20px' }}>
                    <FaSignOutAlt /> ออกจากระบบ
                </button>
            </aside>

            <main className="main-content-wrapper" style={{ marginLeft: sidebarOpen ? "260px" : "0" }}>
                <header className="top-navbar">
                    <button className="sidebar-toggle-btn" onClick={toggleSidebar} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>
                        <FaBars />
                    </button>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>{user?.fullname}</span>
                        <div className="avatar-circle" style={{ width: '40px', height: '40px', background: '#e83e8c', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white' }}>
                            {user?.fullname?.charAt(0)}
                        </div>
                    </div>
                </header>

                <div className="content-body">
                    <Routes>
                        {/* หน้าแรกของ Dashboard */}
                        <Route index element={HomeContent} /> 
                        
                        <Route path="engineer/home" element={HomeContent} />
                        
                        {/* ส่วนจัดการโปรไฟล์ */}
                        <Route path="engineer/profile" element={<ProfileENG user={user} handleLogout={handleLogout} refreshUser={refreshUser} />}>
                            <Route path="edit" element={<ProfileEditENG user={user} handleLogout={handleLogout} refreshUser={refreshUser} />} />
                            <Route path="change-password" element={<h2>หน้าเปลี่ยนรหัสผ่าน</h2>} />
                        </Route>

                        {/* ส่วนงานอะไหล่ */}
                        <Route path="engineer/return" element={<ReturnPartPage />} />
                        <Route path="engineer/withdraw" element={<WithdrawPage />} />
                        <Route path="engineer/borrow" element={<h2 className="page-title">📦 หน้ายืมอะไหล่</h2>} />
                        
                        {/* อื่นๆ */}
                        <Route path="engineer/search" element={<h2>หน้าค้นหา</h2>} />
                        <Route path="engineer/history" element={<h2>หน้าประวัติ</h2>} />
                        <Route path="*" element={<h2>ไม่พบหน้าที่คุณต้องการ</h2>} />
                    </Routes>
                </div>
            </main>
        </div>
    );
}

export default EngineerMainPage;