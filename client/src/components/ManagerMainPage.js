import React, { useState, useLayoutEffect, useCallback, useEffect } from "react";
import { useNavigate, Routes, Route, Navigate } from "react-router-dom"; 
import axios from "axios";
import {
    FaBars, FaHome, FaChartBar, FaBell, FaHistory, 
    FaSignOutAlt, FaUserCircle, FaCalendarDay ,FaBoxOpen
} from "react-icons/fa";

import "./ManagerMainPage.css"; 

import ManagerDashboard from "./ManagerDashboard";
import ManagerAlertPage from "./ManagerAlertPage";
import ManagerReportPage from "./ManagerReportPage";
import HistoryPage from "./HistoryPage";
import ManagerEquipmentPage from "./ManagerEquipmentPage";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

function ManagerMainPage({ user, handleLogout }) {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [alertCount, setAlertCount] = useState(0);
    
    // --- ส่วนที่เพิ่ม: การจัดการวันที่รายวัน ---
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    useLayoutEffect(() => {
        const handleResize = () => setSidebarOpen(window.innerWidth > 768);
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
            
            <aside className="sidebar-container">
                <div className="sidebar-header">
                    <div className="manager-logo">
                        <h2>MEMS MANAGER</h2>
                    </div>
                </div>
                
                <nav className="sidebar-nav">
                    <button className="nav-link" onClick={() => navigate("/dashboard/manager/home")}>
                        <FaHome /> <span>แผงควบคุมหลัก</span>
                    </button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/manager/reports")}>
                        <FaChartBar /> <span>รายงานสรุปคลัง</span>
                    </button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/manager/alerts")}>
                        <div className="nav-link-content">
                            <FaBell /> 
                            <span>รายการแจ้งเตือน</span>
                            {alertCount > 0 && <span className="notification-badge-inline">{alertCount}</span>}
                        </div>
                    </button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/manager/equipment")}>
                        <FaBoxOpen /> <span>ข้อมูลอะไหล่ทั้งหมด</span>
                    </button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/manager/history")}>
                        <FaHistory /> <span>ประวัติการใช้งาน</span>
                    </button>
                </nav>

                <button className="logout-btn-top" onClick={localHandleLogout}>
                    <FaSignOutAlt /> <span>ออกจากระบบ</span>
                </button>
            </aside>

            <main className="main-content-wrapper">
                <header className="top-navbar">
                    <div className="nav-left-section">
                        <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
                            <FaBars />
                        </button>
                        
                        {/* --- เพิ่มส่วน Daily Filter ใน Navbar --- */}
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
                        {/* ส่ง selectedDate ไปให้หน้าลูกเพื่อกรองข้อมูลรายวัน */}
                        <Route path="home" element={<ManagerDashboard viewDate={selectedDate} />} />
                        <Route path="reports" element={<ManagerReportPage viewDate={selectedDate} />} />
                        <Route path="alerts" element={<ManagerAlertPage />} />
                        <Route path="history" element={<HistoryPage user={user} viewDate={selectedDate} />} />
                        <Route path="equipment" element={<ManagerEquipmentPage />} />
                        <Route index element={<Navigate to="home" replace />} />
                        <Route path="*" element={<h2 className="text-center mt-10">ไม่พบหน้าที่คุณต้องการ</h2>} />
                    </Routes>
                </div>
            </main>
        </div>
    );
}

export default ManagerMainPage;