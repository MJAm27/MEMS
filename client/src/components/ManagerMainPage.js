import React, { useState, useLayoutEffect, useCallback, useEffect } from "react";
import { useNavigate, Routes, Route, Navigate } from "react-router-dom"; 
import axios from "axios";
import {
    FaBars, FaHome, FaChartBar, FaBell, FaHistory, 
    FaSignOutAlt, FaUserCircle ,FaBoxOpen, FaCalendarDay
} from "react-icons/fa";

import "./ManagerMainPage.css"; 

import ManagerDashboard from "./ManagerDashboard";
import ManagerAlertPage from "./ManagerAlertPage";
import ManagerReportPage from "./ManagerReportPage";
import ManagerEquipmentPage from "./ManagerEquipmentPage";
import ManagerHistoryPage from "./ManagerHistoryPage";
import ProfileENG from './ProfileENG';
import ProfileEditENG from './ProfileEditENG';
import ChangePasswordENG from './ChangePasswordENG';

const API_BASE_URL = process.env.REACT_APP_API_URL ;

function ManagerMainPage({ user, handleLogout, refreshUser }) {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [alertCount, setAlertCount] = useState(0);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

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

    const fetchAlertCount = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const [expireRes, stockRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/alerts/expire`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_BASE_URL}/api/alerts/low-stock`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setAlertCount(expireRes.data.length + stockRes.data.length);
        } catch (error) {
            console.error("Error fetching alerts:", error);
        }
    }, []);

    useEffect(() => {
        fetchAlertCount();
        const interval = setInterval(fetchAlertCount, 60000); 
        return () => clearInterval(interval);
    }, [fetchAlertCount]);

    // ✅ ฟังก์ชันสำหรับเปลี่ยนหน้าและปิด Sidebar อัตโนมัติ (สำหรับมือถือ)
    const goTo = (path) => {
        navigate(path);
        if (window.innerWidth <= 768) {
            setSidebarOpen(false);
        }
    };

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const localHandleLogout = () => {
        if (window.confirm("ต้องการออกจากระบบใช่หรือไม่?")) {
            if (typeof handleLogout === "function") {
                handleLogout();
            } else {
                localStorage.removeItem('token');
                window.location.href = "/login";
            }
        }
    };

    return (
        <div className={`layout-wrapper ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
            
            {/* ✅ Overlay สำหรับมือถือ (แตะเพื่อปิด sidebar) */}
            <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>

            <aside className="sidebar-container">
                <div className="sidebar-header">
                    <div className="manager-logo">
                        <h2>MEMS MANAGER</h2>
                    </div>
                </div>
                
                <nav className="sidebar-nav">
                    {/* ✅ เปลี่ยนจาก navigate เป็น goTo เพื่อให้ sidebar ปิดบนมือถือ */}
                    <button className="nav-link" onClick={() => goTo("/dashboard/manager/home")}>
                        <FaHome /> <span>แผงควบคุมหลัก</span>
                    </button>
                    <button className="nav-link" onClick={() => goTo("/dashboard/manager/reports")}>
                        <FaChartBar /> <span>รายงานสรุปคลัง</span>
                    </button>
                    <button className="nav-link" onClick={() => goTo("/dashboard/manager/alerts")}>
                        <div className="nav-link-content">
                            <FaBell /> 
                            <span>รายการแจ้งเตือน</span>
                            {alertCount > 0 && <span className="notification-badge-inline">{alertCount}</span>}
                        </div>
                    </button>
                    <button className="nav-link" onClick={() => goTo("/dashboard/manager/equipment")}>
                        <FaBoxOpen /> <span>ข้อมูลอะไหล่ทั้งหมด</span>
                    </button>
                    <button className="nav-link" onClick={() => goTo("/dashboard/manager/managerhistory")}>
                        <FaHistory /> <span>ประวัติการใช้งาน</span>
                    </button>
                    <button className="nav-link" onClick={() => goTo("/dashboard/manager/profile")}>
                        <FaUserCircle /> <span>โปรไฟล์</span>
                    </button>
                </nav>

                <button className="logout-btn-sidebar" onClick={localHandleLogout}>
                    <FaSignOutAlt /> <span>ออกจากระบบ</span>
                </button>
            </aside>

            <main className="main-content-wrapper">
                <header className="top-navbar">
                    <div className="nav-left-section">
                        <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
                            <FaBars />
                        </button>
                        <div className="daily-filter-container">
                            <FaCalendarDay className="calendar-icon" />
                            <span className="filter-text">มุมมองรายวัน:</span>
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={(e) => setSelectedDate(e.target.value)} 
                                className="daily-date-input"
                            />
                        </div>
                    </div>
                    
                    <div className="nav-right">
                        <div className="user-profile-display">
                            <div className="user-text">
                                <span className="name">{user?.fullname || "Manager User"}</span>
                                <span className="role">หัวหน้าแผนก</span>
                            </div>
                            <div className="avatar-circle">
                                {user?.fullname ? user.fullname.charAt(0).toUpperCase() : <FaUserCircle />}
                            </div>
                        </div>
                    </div>
                </header>

                <div className="content-body">
                    <Routes>
                        <Route path="manager/home" element={<ManagerDashboard viewDate={selectedDate} />} />
                        <Route path="manager/reports" element={<ManagerReportPage viewDate={selectedDate} />} />
                        <Route path="manager/alerts" element={<ManagerAlertPage />} />
                        <Route path="manager/managerhistory" element={<ManagerHistoryPage user={user} viewDate={selectedDate} />} />
                        <Route path="manager/equipment" element={<ManagerEquipmentPage />} />
                        <Route path="manager/profile" element={<ProfileENG user={user}/>} />
                        <Route path="manager/profile/edit" element={<ProfileEditENG user={user} refreshUser={refreshUser}/>} />
                        <Route path="manager/profile/change-passwordENG" element={<ChangePasswordENG user={user}/>} />
                        <Route index element={<Navigate to="manager/home" replace />} />
                        <Route path="manager/*" element={<h2 className="text-center mt-10">ไม่พบหน้าที่คุณต้องการ</h2>} />
                    </Routes>
                </div>
            </main>
        </div>
    );
}

export default ManagerMainPage;