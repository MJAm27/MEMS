import React, { useState, useEffect } from "react";
import { Link, useNavigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { 
    FaUserCircle, FaChevronRight, FaBars, FaHome, 
    FaSearch, FaHistory, FaUser, FaToolbox, FaSignOutAlt, FaKey, FaEdit 
} from "react-icons/fa";
import "./ProfileENG.css";

function ProfileENG() {
    const navigate = useNavigate();
    const location = useLocation(); // ใช้เช็ค URL ปัจจุบัน
    const [userData, setUserData] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Desktop เริ่มต้นเปิด
    const [isLoading, setIsLoading] = useState(true);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const handleLogout = () => {
        if (window.confirm("ต้องการออกจากระบบใช่หรือไม่?")) {
            localStorage.removeItem("authToken");
            navigate("/login");
        }
    };

    useEffect(() => {
        const fetchUserData = async () => {
            const token = localStorage.getItem("authToken");
            if (!token) return navigate("/login");

            try {
                const res = await fetch("/api/auth/me", {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) throw new Error("Invalid token");

                const data = await res.json();
                // จัด Format ข้อมูล
                const formattedData = {
                    ...data,
                    user_id: data.user_id ?? data.staffId ?? "N/A",
                    role: data.role || "Engineer",
                    fullname: data.fullname || "ผู้ใช้งาน"
                };
                setUserData(formattedData);
            } catch (error) {
                console.error("Profile load error:", error);
                localStorage.removeItem("authToken");
                navigate("/login");
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserData();
    }, [navigate]);

    // --- Loading Screen ---
    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>กำลังโหลดข้อมูล...</p>
            </div>
        );
    }

    // เช็คว่ากำลังอยู่หน้า Edit หรือ Change Password หรือไม่ (ถ้าใช่ ให้ซ่อน Card หลัก)
    const isSubPage = location.pathname.includes("/edit") || location.pathname.includes("change-password");

    return (
        <div className={`layout-wrapper ${isSidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
            
            {/* === SIDEBAR (เหมือนหน้าหลัก) === */}
            <aside className="sidebar-container">
                <div className="sidebar-header">
                    <div className="brand">
                        <FaToolbox className="brand-icon" />
                        <h3>MEMS</h3>
                    </div>
                </div>

                <ul className="sidebar-nav">
                    <li>
                        <NavLink to="/engineer" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                            <FaHome /> <span>หน้าหลัก</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/engineer/search" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                            <FaSearch /> <span>ค้นหา</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/engineer/history" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                            <FaHistory /> <span>ประวัติ</span>
                        </NavLink>
                    </li>
                    <li className="nav-divider"></li>
                    <li>
                        <NavLink to="/profileENG" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                            <FaUser /> <span>โปรไฟล์ส่วนตัว</span>
                        </NavLink>
                    </li>
                </ul>
            </aside>

            {/* === MAIN CONTENT === */}
            <div className="main-content-wrapper">
                
                {/* Top Navbar */}
                <header className="top-navbar">
                    <div className="nav-left">
                        <button onClick={toggleSidebar} className="sidebar-toggle-btn">
                            <FaBars />
                        </button>
                        <h2 className="page-title-mobile">ข้อมูลโปรไฟล์</h2>
                    </div>
                    
                    <div className="nav-right">
                        <div className="user-profile-display">
                            <div className="user-text">
                                <span className="name">{userData.fullname}</span>
                                <span className="role">{userData.role}</span>
                            </div>
                            
                        </div>
                        <button onClick={handleLogout} className="logout-btn-top">
                            <FaSignOutAlt /> <span>ออกจากระบบ</span>
                        </button>
                    </div>
                </header>

                {/* Content Body */}
                <main className="content-body">
                    
                    {/* แสดง Outlet ถ้ามี Route ย่อย (เช่นหน้า Edit) */}
                    <Outlet />

                    {/* แสดง Profile Card เฉพาะตอนที่ไม่ได้อยู่หน้าย่อย */}
                    {!isSubPage && (
                        <div className="profile-center-container fade-in">
                            <div className="profile-card-detailed">
                                <div className="profile-header-bg"></div>
                                <div className="profile-avatar-large">
                                    <FaUserCircle />
                                </div>
                                
                                <div className="profile-details">
                                    <h2>{userData.fullname}</h2>
                                    <p className="detail-badge">{userData.role}</p>
                                    <p className="detail-text">ID: <strong>{userData.user_id}</strong></p>
                                </div>

                                <div className="profile-actions-list">
                                    {/* แก้ไข Link ให้เป็น Route Path ที่ถูกต้อง */}
                                    <Link to="/profileENG/edit" className="action-item">
                                        <div className="action-icon-box pink"><FaEdit /></div>
                                        <div className="action-text">
                                            <span>แก้ไขข้อมูลส่วนตัว</span>
                                            <small>ปรับปรุงชื่อ หรือข้อมูลติดต่อ</small>
                                        </div>
                                        <FaChevronRight className="arrow-icon" />
                                    </Link>

                                    <Link to="change-password" className="action-item">
                                        <div className="action-icon-box purple"><FaKey /></div>
                                        <div className="action-text">
                                            <span>เปลี่ยนรหัสผ่าน</span>
                                            <small>เพื่อความปลอดภัยของบัญชี</small>
                                        </div>
                                        <FaChevronRight className="arrow-icon" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                </main>
            </div>

            {/* Mobile Overlay */}
            {isSidebarOpen && <div className="mobile-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
        </div>
    );
}

export default ProfileENG;