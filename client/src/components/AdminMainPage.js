import React, { useState, useLayoutEffect, useEffect } from "react"; // เพิ่ม useEffect
import axios from "axios"; // เพิ่ม axios
import { useNavigate, Routes, Route } from "react-router-dom";
import {
    FaBars,
    FaHome,
    FaChartLine,
    FaBell,
    FaUserCircle,
    FaSignOutAlt,
    FaIndustry,
    FaCogs,
    FaExchangeAlt,
    FaTruck,
    FaUsers
} from "react-icons/fa";

import "./AdminMainPage.css";

import ManageMachine from "./ManageMachine";
import ManageEquipment from "./ManageEquipment";
import ManageTransaction from "./ManageTransaction";
import ManageUser from "./ManageUser";
import ManageSupplier from "./ManageSupplier";
import ReportPage from "./ReportPage";
import AlertPage from "./AlertPage";
import ProfileENG from './ProfileENG';
import ProfileEditENG from './ProfileEditENG';
import ChangePasswordENG from './ChangePasswordENG';


const API_BASE_URL = process.env.REACT_APP_API_URL;

function AdminMainPage({ user, handleLogout }) {
    const navigate = useNavigate();

    const getInitialSidebarState = () => window.innerWidth > 768;
    const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarState);

    const [alertCount, setAlertCount] = useState(0);

    useEffect(() => {
        const fetchAlertCount = async () => {
            try {
                // เรียกทั้ง 2 API เพื่อมานับรวมกัน
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
        
        // (Optional) ตั้ง Interval ให้เช็คทุก 1 นาที
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
            {/* ===== Sidebar ===== */}
            <aside className="sidebar-container">
                <div className="sidebar-header">
                    <h2>MEMS ADMIN</h2>
                </div>

                <nav className="sidebar-nav">
                    <button className="nav-link" onClick={() => navigate("/dashboard/admin/home")}>
                        <FaHome /> <span>หน้าหลัก</span>
                    </button>

                    <button className="nav-link" onClick={() => navigate("/dashboard/admin/report")}>
                        <FaChartLine /> <span>รายงานสรุป</span>
                    </button>

                    <button className="nav-link" onClick={() => navigate("/dashboard/admin/alert")}>
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

                    <button className="nav-link" onClick={() => navigate("/dashboard/admin/profile")}>
                        <FaUserCircle /> <span>โปรไฟล์</span>
                    </button>
                </nav>

                <button className="logout-btn-top" onClick={localHandleLogout}>
                    <FaSignOutAlt /> ออกจากระบบ
                </button>
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
                        <Route
                            path="/"
                            element={
                                <>
                                    <h1 className="page-title">หน้าหลักผู้ดูแลระบบ</h1>
                                    <p className="page-subtitle">เลือกเมนูเพื่อจัดการข้อมูลภายในระบบ</p>

                                    <div className="admin-action-grid">
                                        <button
                                            className="admin-action-card"
                                            onClick={() => navigate("/dashboard/admin/machine")}
                                        >
                                            <FaIndustry className="icon" />
                                            <span>จัดการข้อมูลครุภัณฑ์</span>
                                        </button>

                                        <button
                                            className="admin-action-card"
                                            onClick={() => navigate("/dashboard/admin/equipment")}
                                        >
                                            <FaCogs className="icon" />
                                            <span>จัดการข้อมูลอะไหล่</span>
                                        </button>

                                        <button
                                            className="admin-action-card"
                                            onClick={() => navigate("/dashboard/admin/transactions")}
                                        >
                                            <FaExchangeAlt className="icon" />
                                            <span>จัดการประวัติการเบิกคืน</span>
                                        </button>

                                        <button
                                            className="admin-action-card"
                                            onClick={() => navigate("/dashboard/admin/supplier")}
                                        >
                                            <FaTruck className="icon" />
                                            <span>จัดการข้อมูลบริษัทนำเข้าอะไหล่</span>
                                        </button>

                                        <button
                                            className="admin-action-card"
                                            onClick={() => navigate("/dashboard/admin/user")}
                                        >
                                            <FaUsers className="icon" />
                                            <span>จัดการข้อมูลผู้ใช้งาน</span>
                                        </button>
                                    </div>
                                </>
                            }
                        />
                        <Route
                            path="/admin/home"
                            element={
                                <>
                                    <h1 className="page-title">หน้าหลักผู้ดูแลระบบ</h1>
                                    <p className="page-subtitle">เลือกเมนูเพื่อจัดการข้อมูลภายในระบบ</p>

                                    <div className="admin-action-grid">
                                        <button
                                            className="admin-action-card"
                                            onClick={() => navigate("/dashboard/admin/machine")}
                                        >
                                            <FaIndustry className="icon" />
                                            <span>จัดการข้อมูลครุภัณฑ์</span>
                                        </button>

                                        <button
                                            className="admin-action-card"
                                            onClick={() => navigate("/dashboard/admin/equipment")}
                                        >
                                            <FaCogs className="icon" />
                                            <span>จัดการข้อมูลอะไหล่</span>
                                        </button>

                                        <button
                                            className="admin-action-card"
                                            onClick={() => navigate("/dashboard/admin/transactions")}
                                        >
                                            <FaExchangeAlt className="icon" />
                                            <span>จัดการประวัติการเบิกคืน</span>
                                        </button>

                                        <button
                                            className="admin-action-card"
                                            onClick={() => navigate("/dashboard/admin/supplier")}
                                        >
                                            <FaTruck className="icon" />
                                            <span>จัดการข้อมูลบริษัทนำเข้าอะไหล่</span>
                                        </button>

                                        <button
                                            className="admin-action-card"
                                            onClick={() => navigate("/dashboard/admin/user")}
                                        >
                                            <FaUsers className="icon" />
                                            <span>จัดการข้อมูลผู้ใช้งาน</span>
                                        </button>
                                    </div>
                                </>
                            }
                        />


                        <Route path="/admin/report" element={<ReportPage />} />
                        
                        <Route path="/admin/machine" element={<ManageMachine />} />
                        <Route path="/admin/equipment" element={<ManageEquipment />} />
                        <Route path="/admin/transactions" element={<ManageTransaction />} />
                        <Route path="/admin/user" element={<ManageUser />} />
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

export default AdminMainPage;
