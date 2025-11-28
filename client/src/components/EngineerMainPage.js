import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    FaBars,
    FaHome,
    FaSearch,
    FaHistory,
    FaUserCircle,
    FaSignOutAlt,
} from "react-icons/fa";
import "./EngineerMainPage.css";

function EngineerMainPage() {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [user, setUser] = useState(null);

    // โหลดข้อมูลผู้ใช้จาก localStorage
    useEffect(() => {
        const userData = localStorage.getItem("userData");
        if (!userData) {
            navigate("/login");
            return;
        }
        setUser(JSON.parse(userData));
    }, [navigate]);

    const toggleSidebar = () => {
        setSidebarOpen((prev) => !prev);
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("userData");
        navigate("/login");
    };

    if (!user) {
        return <div className="loading-screen">กำลังโหลด...</div>;
    }

    return (
        <div className={`main-container ${sidebarOpen ? "sidebar-open" : ""}`}>
            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
                <div className="sidebar-header">
                    <h2>MEMS</h2>
                </div>

                <nav className="sidebar-nav">
                    <button
                        className="sidebar-link"
                        onClick={() => navigate("/engineer/home")}
                    >
                        <FaHome />
                        <span>หน้าหลัก</span>
                    </button>

                    <button
                        className="sidebar-link"
                        onClick={() => navigate("/engineer/search")}
                    >
                        <FaSearch />
                        <span>ค้นหา</span>
                    </button>

                    <button
                        className="sidebar-link"
                        onClick={() => navigate("/engineer/history")}
                    >
                        <FaHistory />
                        <span>ประวัติ</span>
                    </button>

                    <button
                        className="sidebar-link"
                        onClick={() => navigate("/engineer/profile")}
                    >
                        <FaUserCircle />
                        <span>โปรไฟล์</span>
                    </button>
                </nav>

                <button className="logout-btn" onClick={handleLogout}>
                    <FaSignOutAlt /> ออกจากระบบ
                </button>
            </aside>

            {/* Main Content */}
            <main className="content">
                <header className="top-header">
                    <button className="menu-btn" onClick={toggleSidebar}>
                        <FaBars />
                    </button>

                    <div className="header-user">
                        <span>สวัสดี, {user.fullname}</span>
                    </div>
                </header>

                <div className="content-body">
                    <h1>ยินดีต้อนรับ วิศวกร</h1>
                    <p>เลือกเมนูจากแถบด้านซ้ายเพื่อเริ่มทำงาน</p>
                </div>
            </main>
        </div>
    );
}

export default EngineerMainPage;
