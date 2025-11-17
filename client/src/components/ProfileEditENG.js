import React, { useState, useEffect } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { FaUserCircle, FaEdit, FaBars, FaHome, FaSearch, FaHistory, FaUser } from "react-icons/fa"; 
import "./ProfileEditENG.css";

function ProfileEditENG() {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [formData, setFormData] = useState({
        user_id: '', 
        fullname: '',
        email: '',
        phone_number: '',
        position: ''
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
                    throw new Error('Failed to fetch user data');
                }
                const data = await response.json();
                setUserData(data); 
                setFormData({

                    user_id: data.user_id || '', 
                    fullname: data.fullname || '',
                    email: data.email || '',
                    phone_number: data.phone_number || '', 
                    position: data.position || ''       
                });


            } catch (err) {
                console.error("Error fetching user data for edit:", err);
                setError("Failed to load profile data.");
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('authToken');
        if (!token) {
            navigate('/login');
            return;
        }

        try {
            const response = await fetch('/api/profile-edit', { 
                method: 'PUT', 
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData) 
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update profile');
            }

            alert("บันทึกข้อมูลสำเร็จ!");
            navigate('/profileENG'); 
        } catch (err) {
            console.error("Error updating profile:", err);
            setError(err.message || "Failed to update profile.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="profile-edit-loading">กำลังโหลดข้อมูล...</div>;
    }

    if (error) {
        return <div className="profile-edit-error">เกิดข้อผิดพลาด: {error}</div>;
    }
    if (!userData) {
        return <div className="profile-edit-error">ไม่พบข้อมูลผู้ใช้.</div>;
    }



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
                            <NavLink to="/dashboard/search" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                                <FaSearch /> <span>ค้นหา</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/dashboard/history" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
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
                        <span>สวัสดี, {userData.fullname}</span>
                        <button onClick={handleLogout} className="logout-button-top">
                            ออกจากระบบ
                        </button>
                    </div>
                </header>

                <div className="profile-edit-card">
                    <div className="profile-edit-avatar-section">
                        <FaUserCircle className="profile-edit-avatar" />
                        <button className="edit-avatar-button">
                            <FaEdit />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="profile-edit-form">
                        <div className="form-group">
                            <label htmlFor="user_id">รหัสประจำตัว</label>
                            <input
                                type="text"
                                id="user_id"
                                name="user_id" 
                                value={formData.user_id} 
                                onChange={handleChange}
                                readOnly 
                                className="readonly-input"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="fullname">ชื่อ - นามสกุล</label>
                            <input
                                type="text"
                                id="fullname"
                                name="fullname"
                                value={formData.fullname}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">อีเมล</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="phone_number">เบอร์โทรศัพท์มือถือ</label>
                            <input
                                type="tel"
                                id="phone_number"
                                name="phone_number"
                                value={formData.phone_number}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="position">ตำแหน่ง</label>
                            <input
                                type="text"
                                id="position"
                                name="position"
                                value={formData.position}
                                onChange={handleChange}
                            />
                        </div>

                        <button type="submit" className="submit-button" disabled={loading}>

                            {loading ? 'กำลังบันทึก...' : 'ยืนยันการแก้ไข'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default ProfileEditENG;