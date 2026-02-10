import React, { useState, useLayoutEffect, useCallback, useEffect } from "react";
import { useNavigate, Routes, Route, Navigate } from "react-router-dom"; 
import axios from "axios";
import {
    FaBars, 
    FaHome, 
    FaChartBar, 
    FaBell, 
    FaHistory, 
    FaSignOutAlt, 
    FaUserCircle 
} from "react-icons/fa";

// Import CSS สำหรับ Manager
import "./ManagerMainPage.css"; 

// Import หน้าย่อยที่รวม Logic กราฟและรายงานไว้แล้ว
import ManagerDashboard from "./ManagerDashboard";
import ManagerAlertPage from "./ManagerAlertPage";
import ManagerReportPage from "./ManagerReportPage";
import HistoryPage from "./HistoryPage"; // ใช้คอมโพเนนต์ประวัติร่วมกับ Engineer ได้

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

function ManagerMainPage({ user, handleLogout }) {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [alertCount, setAlertCount] = useState(0);

    // ตรวจสอบขนาดหน้าจออัตโนมัติสำหรับการเปิด/ปิด Sidebar
    useLayoutEffect(() => {
        const handleResize = () => setSidebarOpen(window.innerWidth > 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ดึงจำนวนแจ้งเตือนรวมเพื่อแสดงที่ Sidebar ตามระบบแจ้งเตือนใน Use Case
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
        // ตั้งเวลาตรวจสอบการแจ้งเตือนทุก 1 นาที
        const interval = setInterval(fetchAlertCount, 60000); 
        return () => clearInterval(interval);
    }, [fetchAlertCount]);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const localHandleLogout = () => {
        if (window.confirm("ต้องการออกจากระบบใช่หรือไม่?")) {
            // ตรวจสอบว่า handleLogout มีตัวตนและเป็นฟังก์ชันจริงๆ หรือไม่
            if (typeof handleLogout === "function") {
                handleLogout();
            } else {
                console.error("Error: handleLogout prop is missing!");
                // แผนสำรอง: ลบ token เองถ้าฟังก์ชันไม่ถูกส่งมา
                localStorage.removeItem('token');
                window.location.href = "/login";
            }
        }
    };


    return (
        <div className={`layout-wrapper ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
            
            {/* Sidebar: เมนูสำหรับ Manager ตาม Use Case Diagram */}
            <aside className="sidebar-container">
                <div className="sidebar-header">
                    <div className="manager-logo">
                        <h2>MEMS MANAGER</h2>
                    </div>
                </div>
                
                <nav className="sidebar-nav">
                    {/* แก้ไข URL ให้เป็น Absolute Path เพื่อป้องกันปัญหา URL ซ้อนกัน (/home/home/home) */}
                    <button className="nav-link" onClick={() => navigate("/dashboard/manager/home")}>
                        <FaHome /> <span>แผงควบคุมหลัก</span>
                    </button>
                    
                    {/* Use Case: ระบบรายงานสรุป */}
                    <button className="nav-link" onClick={() => navigate("/dashboard/manager/reports")}>
                        <FaChartBar /> <span>รายงานสรุปคลัง</span>
                    </button>

                    {/* Use Case: ระบบแจ้งเตือน */}
                    <button className="nav-link" onClick={() => navigate("/dashboard/manager/alerts")}>
                        <div className="nav-link-content">
                            <FaBell /> 
                            <span>รายการแจ้งเตือน</span>
                            {alertCount > 0 && <span className="notification-badge-inline">{alertCount}</span>}
                        </div>
                    </button>

                    {/* Use Case: แสดงสรุปการเบิกคืนแบบละเอียด */}
                    <button className="nav-link" onClick={() => navigate("/dashboard/manager/history")}>
                        <FaHistory /> <span>ประวัติการใช้งาน</span>
                    </button>
                </nav>

                <button className="logout-btn-top" onClick={localHandleLogout}>
                    <FaSignOutAlt /> <span>ออกจากระบบ</span>
                </button>
            </aside>

            {/* Main Content Area */}
            <main className="main-content-wrapper">
                <header className="top-navbar">
                    <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
                        <FaBars />
                    </button>
                    
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
                    {/* จัดการเส้นทางภายใน (Sub-routes) ให้สอดคล้องกับ URL */}
                    <Routes>
                        <Route path="home" element={<ManagerDashboard />} />
                        <Route path="reports" element={<ManagerReportPage />} />
                        <Route path="alerts" element={<ManagerAlertPage />} />
                        <Route path="history" element={<HistoryPage user={user} />} />
                        
                        {/* ตั้งค่า Default Route ให้ไปที่หน้าหลักของผู้จัดการ */}
                        <Route index element={<Navigate to="home" replace />} />
                        <Route path="*" element={<h2 className="text-center mt-10">ไม่พบหน้าที่คุณต้องการ</h2>} />
                    </Routes>
                </div>
            </main>
        </div>
    );
}

export default ManagerMainPage;