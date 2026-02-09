import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Routes, Route, Navigate } from "react-router-dom";
import { 
    FaBars, 
    FaHome, 
    FaChartBar, 
    FaBell, 
    FaHistory, 
    FaSignOutAlt, 
    FaUserCircle 
} from "react-icons/fa";

// Import CSS ทั้งของ Admin (เพื่อโครงสร้างหลัก) และ Manager (เพื่อความสวยงามเฉพาะส่วน)
import "./ManagerMainPage.css"; 

// Import หน้าย่อย (ต้องมั่นใจว่าสร้างไฟล์เหล่านี้ไว้ในโฟลเดอร์เดียวกันแล้ว)
import ManagerDashboard from "./ManagerDashboard";
import ManagerAlertPage from "./ManagerAlertPage";
import ManagerReportPage from "./ManagerReportPage";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

function ManagerMainPage({ user, handleLogout }) {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [alertCount, setAlertCount] = useState(0);

    // ดึงจำนวนแจ้งเตือนรวม เพื่อแสดงที่เมนู Sidebar
    useEffect(() => {
        const fetchAlertCount = async () => {
            try {
                const [expireRes, stockRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/api/alerts/expire`),
                    axios.get(`${API_BASE_URL}/api/alerts/low-stock`)
                ]);
                setAlertCount(expireRes.data.length + stockRes.data.length);
            } catch (error) {
                console.error("Error fetching alerts:", error);
            }
        };
        fetchAlertCount();
        
        // ตรวจสอบขนาดหน้าจออัตโนมัติ
        const handleResize = () => setSidebarOpen(window.innerWidth > 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

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

                    <button className="nav-link" onClick={() => navigate("/dashboard/manager/history")}>
                        <FaHistory /> <span>ประวัติการใช้งาน</span>
                    </button>
                </nav>

                <button className="logout-btn-top" onClick={handleLogout}>
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
                                <span className="name">{user?.fullname || "Manager"}</span>
                                <span className="role">หัวหน้าแผนก</span>
                            </div>
                            <div className="avatar-circle">
                                {user?.fullname ? user.fullname.charAt(0) : <FaUserCircle />}
                            </div>
                        </div>
                    </div>
                </header>

                <div className="content-body">
                    {/* ส่วนของการเปลี่ยนหน้าเนื้อหาภายใน */}
                    <Routes>
                        <Route path="home" element={<ManagerDashboard />} />
                        <Route path="reports" element={<ManagerReportPage />} />
                        <Route path="alerts" element={<ManagerAlertPage />} />
                        <Route path="history" element={<div className="fade-in"><h3>ประวัติการเบิก-คืน รายละเอียด</h3><p>ส่วนนี้กำลังพัฒนาเพื่อดึงข้อมูลจาก transactions...</p></div>} />
                        
                        {/* ถ้าเข้ามาหน้าแรก ให้ไปที่ /home อัตโนมัติ */}
                        <Route path="/" element={<Navigate to="home" replace />} />
                        <Route path="*" element={<h2>ไม่พบหน้าที่คุณต้องการ</h2>} />
                    </Routes>
                </div>
            </main>
        </div>
    );
}

export default ManagerMainPage;