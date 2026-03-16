import React, { useState, useLayoutEffect, useEffect } from "react";
import axios from "axios";
import { useNavigate, Routes, Route } from "react-router-dom";
import {
    FaBars, FaHome, FaChartLine, FaBell, FaUserCircle,
    FaSignOutAlt, FaIndustry, FaCogs, FaExchangeAlt, FaTruck, FaUsers , FaBuilding
} from "react-icons/fa";

import "./AdminMainPage.css";

import ManageMachine from "./ManageMachine";
import ManageEquipment from "./ManageEquipment";
import ManageLot from "./ManageLot";
import ManageTransaction from "./ManageTransaction";
import ManageUser from "./ManageUser";
import ManageSupplier from "./ManageSupplier";
import ReportPage from "./ReportPage";
import AlertPage from "./AlertPage";
import ProfileENG from './ProfileENG';
import ProfileEditENG from './ProfileEditENG';
import ChangePasswordENG from './ChangePasswordENG';
import ManageDepartment from './ManageDepartment';

const API_BASE_URL = process.env.REACT_APP_API_URL;

function AdminMainPage({ user, handleLogout }) {
    const navigate = useNavigate();

    const getInitialSidebarState = () => window.innerWidth > 768;
    const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarState);
    const [alertCount, setAlertCount] = useState(0);

    useEffect(() => {
        const fetchAlertCount = async () => {
            try {
                const [expireRes, stockRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/api/alerts/expire`),
                    axios.get(`${API_BASE_URL}/api/alerts/low-stock`)
                ]);
                const total = expireRes.data.length + stockRes.data.length;
                setAlertCount(total);
            } catch (error) {
                console.error("Error fetching alert count:", error);
            }
        };

        fetchAlertCount();
        const interval = setInterval(fetchAlertCount, 60000); 
        return () => clearInterval(interval);
    }, []);

    useLayoutEffect(() => {
        const handleResize = () => {
            setSidebarOpen(window.innerWidth > 768);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const goTo = (path) => {
        navigate(path);
        if (window.innerWidth <= 768) {
            setSidebarOpen(false);
        }
    };

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
                <p className="text-xl text-gray-600">กำลังโหลดข้อมูลผู้ดูแลระบบ...</p>
            </div>
        );
    }

    return (
        <div className={`layout-wrapper ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
            
            <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>

            {/* ===== Sidebar ===== */}
            <aside className="sidebar-container">
                <div className="sidebar-header">
                    <h2>MEMS ADMIN</h2>
                </div>

                <nav className="sidebar-nav">
                    <button className="nav-link" onClick={() => goTo("/dashboard/admin/home")}>
                        <FaHome /> <span>หน้าหลัก</span>
                    </button>

                    <button className="nav-link" onClick={() => goTo("/dashboard/admin/report")}>
                        <FaChartLine /> <span>รายงานสรุป</span>
                    </button>

                    <button className="nav-link" onClick={() => goTo("/dashboard/admin/alert")}>
                        <div className="nav-link-content">
                            <FaBell />
                            <span>แจ้งเตือน</span>
                            {alertCount > 0 && (
                                <span className="notification-badge-inline">
                                    {alertCount}
                                </span>
                            )}
                        </div>
                    </button>

                    <button className="nav-link" onClick={() => goTo("/dashboard/admin/profile")}>
                        <FaUserCircle /> <span>แก้ไขโปรไฟล์</span>
                    </button>

                    <div className="nav-divider"></div> 
                    <button className="logout-btn-sidebar" onClick={localHandleLogout}>
                        <FaSignOutAlt /> <span>ออกจากระบบ</span>
                    </button>
                </nav>

                
            </aside>

            {/* ===== Main Content ===== */}
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
                                <span className="name">สวัสดี, {user?.fullname || "Admin"}</span>
                                <span className="role">ผู้ดูแลระบบ</span>
                            </div>
                            <div className="avatar-circle">
                                {user?.fullname?.charAt(0) || "A"}
                            </div>
                        </div>
                    </div>
                </header>

                <div className="content-body">
                    <Routes>
                        <Route path="/" element={<HomeMenu navigate={goTo} />} />
                        <Route path="/admin/home" element={<HomeMenu navigate={goTo} />} />
                        <Route path="/admin/report" element={<ReportPage />} />
                        <Route path="/admin/machine" element={<ManageMachine />} />
                        <Route path="/admin/equipment" element={<ManageEquipment />} />
                        <Route path="/admin/lot/:equipmentId" element={<ManageLot />} />
                        <Route path="/admin/transactions" element={<ManageTransaction />} />
                        <Route path="/admin/user" element={<ManageUser />} />
                        <Route path="/admin/department" element={<ManageDepartment />} />
                        <Route path="/admin/supplier" element={<ManageSupplier />} />
                        <Route path="/admin/alert" element={<AlertPage />} />
                        <Route path="/admin/profile" element={<ProfileENG user={user}/>} />
                        <Route path="/admin/profile/edit" element={<ProfileEditENG user={user}/>} />
                        <Route path="/admin/profile/change-passwordENG" element={<ChangePasswordENG user={user}/>} />
                        <Route path="*" element={<h2>ไม่พบหน้าที่คุณต้องการ</h2>} />
                    </Routes>
                </div>
            </main>
        </div>
    );
}

function HomeMenu({ navigate }) {
    return (
        <>
            <h1 className="page-title">หน้าหลักผู้ดูแลระบบ</h1>
            <p className="page-subtitle">เลือกเมนูเพื่อจัดการข้อมูลภายในระบบ</p>

            <div className="admin-action-grid">
                <button className="admin-action-card" onClick={() => navigate("/dashboard/admin/machine")}>
                    <FaIndustry className="icon" /><span>จัดการข้อมูลครุภัณฑ์</span>
                </button>
                <button className="admin-action-card" onClick={() => navigate("/dashboard/admin/equipment")}>
                    <FaCogs className="icon" /><span>จัดการข้อมูลอะไหล่</span>
                </button>
                <button className="admin-action-card" onClick={() => navigate("/dashboard/admin/transactions")}>
                    <FaExchangeAlt className="icon" /><span>จัดการประวัติการเบิกคืน</span>
                </button>
                <button className="admin-action-card" onClick={() => navigate("/dashboard/admin/supplier")}>
                    <FaTruck className="icon" /><span>จัดการข้อมูลบริษัทนำเข้าอะไหล่</span>
                </button>
                <button className="admin-action-card" onClick={() => navigate("/dashboard/admin/user")}>
                    <FaUsers className="icon" /><span>จัดการข้อมูลผู้ใช้งาน</span>
                </button>
                <button className="admin-action-card" onClick={() => navigate("/dashboard/admin/department")}>
                    <FaBuilding className="icon" /><span>จัดการข้อมูลหน่วยงาน</span>
                </button>
            </div>
        </>
    );
}

export default AdminMainPage;