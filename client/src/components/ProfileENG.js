import React, { useState, useEffect } from "react";
import { Link, useNavigate, NavLink } from "react-router-dom";
import { FaUserCircle, FaChevronRight, FaBars, FaHome, FaSearch, FaHistory, FaUser } from "react-icons/fa";
import "./ProfileENG.css";

function ProfileENG() {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        navigate('/login');
    };

    useEffect(() => {
        const fetchUserData = async () => {
            const token = localStorage.getItem('authToken');
            if (!token) {
                navigate('/login');
                return;
            }
            try {
                const response = await fetch('/api/auth/me', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!response.ok) {
                    // ถ้า response ไม่ใช่ 200 (เช่น 401, 403) ให้โยน Error
                    throw new Error('Failed to fetch user data or invalid token');
                }
                const data = await response.json();
                setUserData(data);
            } catch (error) {
                console.error('Error fetching user data:', error);
                // (จุดที่แก้ไข 1) ถ้า fetch ล้มเหลว (เช่น token หมดอายุ)
                // ให้ลบ token เก่าทิ้ง และส่งกลับไปหน้า login
                localStorage.removeItem('authToken');
                navigate('/login');
            }
        };
        fetchUserData();
    }, [navigate]); // Dependency ถูกต้อง

    // (จุดที่แก้ไข 2) แก้ไข Logic การแสดงผล
    // ถ้า userData ยังเป็น null (กำลังโหลด) ให้แสดงหน้า Loading...
    if (!userData) {
        return <div>Loading profile...</div>;
        // หรือจะสร้างเป็น Component Loading สวยๆ ก็ได้
    }

    // ถ้าโค้ดมาถึงตรงนี้ได้ แปลว่า userData มีข้อมูลแล้ว
    return (
        <div className="profile-container">
            <nav className={`sidebar-container ${isSidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    {isSidebarOpen && <h3>MEMS</h3>}
                </div>
                {isSidebarOpen && (
                    <ul className="sidebar-nav">
                        <li>
                            <NavLink to="/dashboard" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
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
                        <li>
                            <NavLink to="/profileENG" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                                <FaUser /> <span>โปรไฟล์</span>
                            </NavLink>
                        </li>
                    </ul>
                )}
            </nav>

            <div className="content-wrapper">
                <header className="main-content-header">
                    <button
                        onClick={toggleSidebar}
                        className="sidebar-toggle-btn"
                    >
                        <FaBars />
                    </button>

                    <div className="user-info">
                        {/* ตอนนี้ userData มีข้อมูลแน่นอนแล้ว */}
                        <span>สวัสดี, {userData.fullname}</span>
                        <button onClick={handleLogout} className="logout-button-top">
                            ออกจากระบบ
                        </button>
                    </div>
                </header>

                <div className="profile-card">
                    <div className="profile-avatar">
                        <FaUserCircle />
                    </div>
                    <div className="profile-info">
                        <h3>{userData.fullname}</h3>
                        <p>{userData.user_id}</p>
                    </div>
                </div>

                <div className="profile-actions">
                    <Link to="profile-edit" className="action-link">
                        <span>แก้ไขข้อมูลส่วนตัว</span>
                        <FaChevronRight />
                    </Link>
                    <Link to="change-password" className="action-link">
                        <span>เปลี่ยนรหัสผ่าน</span>
                        <FaChevronRight />
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default ProfileENG;