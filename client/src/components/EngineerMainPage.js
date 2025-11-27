import React, { useState, useEffect } from 'react';
import { useNavigate, NavLink, Routes, Route, Link } from 'react-router-dom';
import {
    FaHome, FaSearch, FaHistory, FaUser, FaBars, FaToolbox,
    FaTruckLoading, FaExchangeAlt, FaSignOutAlt
} from 'react-icons/fa';
import './EngineerMainPage.css';

// import WithdrawPage from './WithdrawPage'; // เปิดบรรทัดนี้ถ้ามีไฟล์จริง

// Components จำลอง (Placeholder)
const SearchPage = () => <div className="content-card fade-in"><h2>🔍 ค้นหาอะไหล่</h2></div>;
const HistoryPage = () => <div className="content-card fade-in"><h2>📜 ประวัติการเบิก-จ่าย</h2></div>;
const PlaceholderPage = ({ title }) => <div className="content-card fade-in"><h2>{title}</h2></div>;

function EngineerMainPage() {
    const navigate = useNavigate();
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
                // เปลี่ยน URL ตรงนี้ให้ตรงกับ API ของคุณ
                const res = await fetch("/api/auth/me", {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) throw new Error("Invalid token");

                const data = await res.json();
                
                // จัดรูปแบบข้อมูลป้องกัน Error
                const formattedData = {
                    ...data,
                    user_id: data.user_id ?? data.staffId ?? "N/A",
                    role: data.role || "Engineer",
                    fullname: data.fullname || "ผู้ใช้งานระบบ"
                };
                
                setUserData(formattedData);
            } catch (error) {
                console.error("Profile load error:", error);
                // กรณีเทสแบบไม่มี API ให้เปิดคอมเมนต์ด้านล่างนี้เพื่อดูหน้าเว็บ
                /*
                setUserData({
                    user_id: "ENG-999",
                    fullname: "วิศวกร ทดสอบระบบ",
                    role: "Senior Engineer"
                });
                */
               
                // ถ้าใช้จริงให้เปิด 2 บรรทัดนี้
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

    // --- Main Render ---
    return (
        <div className={`layout-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>

            {/* === SIDEBAR === */}
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
                        <NavLink to="search" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                            <FaSearch /> <span>ค้นหา</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="history" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
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
                {/* ปุ่ม Logout ถูกลบออกจากตรงนี้แล้ว */}
            </aside>

            {/* === MAIN CONTENT === */}
            <div className="main-content-wrapper">
                
                {/* Top Navigation Bar */}
                <header className="top-navbar">
                    <div className="nav-left">
                        <button onClick={toggleSidebar} className="sidebar-toggle-btn">
                            <FaBars />
                        </button>
                        <h2 className="page-title-mobile">MEMS System</h2>
                    </div>
                    
                    <div className="nav-right">
                        <div className="user-profile-display">
                            <div className="user-text">
                                <span className="name">{userData.fullname}</span>
                                <span className="role">{userData.role}</span>
                            </div>
                        </div>
                        
                        {/* ✅ ปุ่มออกจากระบบ ย้ายมาตรงนี้ */}
                        <button onClick={handleLogout} className="logout-btn-top">
                            <FaSignOutAlt /> <span>ออกจากระบบ</span>
                        </button>
                    </div>
                </header>

                {/* Content Body */}
                <main className="content-body">
                    <Routes>
                        {/* หน้า Dashboard หลัก */}
                        <Route path="" element={
                            <div className="fade-in">
                                {/* Profile Summary Card */}
                                <div className="dashboard-welcome-card">
                                    <div className="welcome-text">
                                        <h1>ยินดีต้อนรับ, {userData.fullname}</h1>
                                        <p>รหัสพนักงาน: <strong>{userData.user_id}</strong> | ตำแหน่ง: {userData.role}</p>
                                    </div>
                                    <Link to="/profileENG" className="btn-edit-profile">
                                        จัดการโปรไฟล์
                                    </Link>
                                </div>

                                {/* Main Actions Grid */}
                                <h3 className="section-header">เมนูการจัดการ</h3>
                                <div className="action-grid">
                                    <Link to="withdraw" className="action-card card-pink">
                                        <div className="icon-wrapper"><FaTruckLoading /></div>
                                        <h3>เบิกอะไหล่</h3>
                                        <p>Request Parts</p>
                                    </Link>
                                    
                                    <Link to="return" className="action-card card-blue">
                                        <div className="icon-wrapper"><FaExchangeAlt /></div>
                                        <h3>คืนอะไหล่</h3>
                                        <p>Return Parts</p>
                                    </Link>
                                    
                                    <Link to="borrow" className="action-card card-purple">
                                        <div className="icon-wrapper"><FaUser /></div>
                                        <h3>ยืมอะไหล่</h3>
                                        <p>Borrow Parts</p>
                                    </Link>
                                </div>
                            </div>
                        } />

                        {/* Sub Routes (Nested Routes) */}
                        <Route path="search" element={<SearchPage />} />
                        <Route path="history" element={<HistoryPage />} />
                        {/* <Route path="withdraw" element={<WithdrawPage />} /> */}
                        <Route path="withdraw" element={<PlaceholderPage title="หน้าระบบเบิกอะไหล่" />} />
                        <Route path="return" element={<PlaceholderPage title="ระบบคืนอะไหล่ (Coming Soon)" />} />
                        <Route path="borrow" element={<PlaceholderPage title="ระบบยืมอะไหล่ (Coming Soon)" />} />
                    </Routes>
                </main>
            </div>

            {/* Mobile Overlay */}
            {isSidebarOpen && <div className="mobile-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
        </div>
    );
}

export default EngineerMainPage;
