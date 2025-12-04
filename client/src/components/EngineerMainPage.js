import React, { useState,useLayoutEffect} from "react";
import { useNavigate, Routes, Route  } from "react-router-dom"; 
import {
    FaBars,
    FaHome,
    FaSearch,
    FaHistory,
    FaUserCircle,
    FaSignOutAlt,
} from "react-icons/fa";
import "./EngineerMainPage.css"; 

import ProfileENG from './ProfileENG'; 
import ProfileEditENG from './ProfileEditENG'; 


function EngineerMainPage({ user, handleLogout, refreshUser }) { 
    const navigate = useNavigate();
    const getInitialSidebarState = () =>{
        return window.innerWidth > 768;
    }
    const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarState); 
    useLayoutEffect(() =>{
        const handleResize = () =>{
            setSidebarOpen(window.innerWidth > 768);
        };
        window.addEventListener('resize',handleResize);
        return () => {
            window.removeEventListener('resize',handleResize);
        };
    },[]);
    const toggleSidebar = () => {
        setSidebarOpen((prev) => !prev);
    };

    
    const localHandleLogout = () => {
        localStorage.removeItem("token"); 
        handleLogout(); 
    };

    if (!user) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <p className="text-xl text-gray-600">กำลังโหลดข้อมูลวิศวกร...</p>
            </div>
        );
    }

    return (
        <div className={`layout-wrapper ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>

            <aside className="sidebar-container"> 
                <div className="sidebar-header">
                    <div className="brand">
                        <h2>MEMS</h2>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <button className="nav-link active" onClick={() => navigate("/dashboard/engineer/home")}>
                        <FaHome /> <span>หน้าหลัก</span>
                    </button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/search")}>
                        <FaSearch /> <span>ค้นหา</span>
                    </button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/history")}>
                        <FaHistory /> <span>ประวัติ</span>
                    </button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/profile")}>
                        <FaUserCircle /> <span>โปรไฟล์</span>
                    </button>
                </nav>
                <button className="logout-btn-top" onClick={localHandleLogout} style={{margin:'15px', padding:'10px'}}> 
                    <FaSignOutAlt /> ออกจากระบบ
                </button>
            </aside>

            <main className="main-content-wrapper"> 
                <header className="top-navbar">
                    <div className="nav-left">
                        <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
                            <FaBars />
                        </button>
                    </div>

                    <div className="nav-right">
                        <div className="user-profile-display">
                            <div className="user-text">
                                <span className="name">สวัสดี, {user?.fullname || 'วิศวกร'}</span> 
                                <span className="role">วิศวกร</span>
                            </div>
                            <div className="avatar-circle">{user?.fullname?.charAt(0) || 'E'}</div>
                        </div>
                    </div>
                </header>

                <div className="content-body">
                    <Routes>
                        
                        <Route path="/" element={
                            <><h1>หน้าหลักวิศวกร</h1><p>เลือกเมนูจากแถบด้านซ้ายเพื่อเริ่มทำงาน</p>
                                <div className="main-actions-container">
                                    <button className="action-button primary-action" onClick={() => navigate("/dashboard/engineer/withdraw")}>
                                        เบิกอะไหล่
                                    </button>
                                    <button className="action-button secondary-action" onClick={() => navigate("/dashboard/engineer/return")}>
                                        คืนอะไหล่
                                    </button>
                                    <button className="action-button secondary-action" onClick={() => navigate("/dashboard/engineer/borrow")}>
                                        ยืมอะไหล่
                                    </button>
                                    
                                </div>
                            </>
                            
                        } />
                        
                        <Route path="engineer/home" element={
                            <>
                                <h1>หน้าหลักวิศวกร</h1><p>เลือกเมนูจากแถบด้านซ้ายเพื่อเริ่มทำงาน</p>
                                <div className="main-actions-container">
                                    <button className="action-button primary-action" onClick={() => navigate("/dashboard/engineer/withdraw")}>
                                        เบิกอะไหล่
                                    </button>
                                    <button className="action-button secondary-action" onClick={() => navigate("/dashboard/engineer/return")}>
                                        คืนอะไหล่
                                    </button>
                                    <button className="action-button secondary-action" onClick={() => navigate("/dashboard/engineer/borrow")}>
                                        ยืมอะไหล่
                                    </button>
                                    
                                </div>
                            </>
                        } />
                        

                        <Route path="engineer/profile" element={<ProfileENG user={user} handleLogout={handleLogout} refreshUser={refreshUser} />} >
                            <Route path="edit" element={<ProfileEditENG user={user} handleLogout={handleLogout} refreshUser={refreshUser} />} />
                            <Route path="change-password" element={<h2>หน้าเปลี่ยนรหัสผ่าน</h2>} />
                        </Route>
                        <Route path="engineer/withdraw" element={<h2 className="page-title">⚙️ หน้าเบิกอะไหล่</h2>} />
                        <Route path="engineer/return" element={<h2 className="page-title">🔄 หน้าคืนอะไหล่</h2>} />
                        <Route path="engineer/borrow" element={<h2 className="page-title">📦 หน้ายืมอะไหล่</h2>} />
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