import React, { useState, useEffect } from "react";
import { useNavigate, NavLink, Link } from "react-router-dom";
import { 
    FaUserCircle, FaBars, FaHome, FaSearch, FaHistory, 
    FaUser, FaToolbox, FaSignOutAlt, FaSave, FaArrowLeft 
} from "react-icons/fa";
import "./ProfileENG.css"; // ใช้ CSS ตัวหลักเพื่อ Layout
import "./ProfileEditENG.css"; // ใช้ CSS เฉพาะฟอร์ม

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
    const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Desktop เริ่มต้นเปิด

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const handleLogout = () => {
        if (window.confirm("ต้องการออกจากระบบใช่หรือไม่?")) {
            localStorage.removeItem('authToken');
            navigate('/login');
        }
    };

    // Fetch User Data
    useEffect(() => {
        const fetchUserData = async () => {
            const token = localStorage.getItem('authToken');
            if (!token) return navigate('/login');

            try {
                const response = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) throw new Error('Failed to fetch user data');
                
                const data = await response.json();
                setUserData(data);
                setFormData({
                    user_id: data.user_id || data.staffId || '', 
                    fullname: data.fullname || '',
                    email: data.email || '',
                    phone_number: data.phone_number || '', 
                    position: data.position || data.role || ''      
                });
            } catch (err) {
                console.error("Error fetching data:", err);
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const token = localStorage.getItem('authToken');
        try {
            const response = await fetch('/api/profile-edit', { 
                method: 'PUT', 
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData) 
            });

            if (!response.ok) throw new Error('Failed to update profile');

            alert("บันทึกข้อมูลสำเร็จ!");
            navigate('/profileENG'); // กลับไปหน้าโปรไฟล์
        } catch (err) {
            alert("เกิดข้อผิดพลาด: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading-container"><div className="spinner"></div><p>กำลังโหลด...</p></div>;

    return (
        <div className={`layout-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>

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
                        <h2 className="page-title-mobile">แก้ไขข้อมูล</h2>
                    </div>
                    
                    <div className="nav-right">
                        <div className="user-profile-display">
                            <div className="user-text">
                                <span className="name">{userData?.fullname}</span>
                                <span className="role">{formData.position}</span>
                            </div>
                        </div>
                        <button onClick={handleLogout} className="logout-btn-top">
                            <FaSignOutAlt /> <span>ออกจากระบบ</span>
                        </button>
                    </div>
                </header>

                {/* Content Body */}
                <main className="content-body">
                    
                    <div className="profile-center-container fade-in">
                        <div className="edit-card-container">
                            <div className="edit-header">
                                <Link to="/profileENG" className="back-link">
                                    <FaArrowLeft /> ย้อนกลับ
                                </Link>
                                <h2>แก้ไขข้อมูลส่วนตัว</h2>
                            </div>

                            <div className="edit-avatar-section">
                                <div className="avatar-wrapper">
                                    <FaUserCircle className="avatar-icon" />
                                </div>
                                <p className="avatar-hint">รูปโปรไฟล์จะแสดงตามระบบ</p>
                            </div>

                            <form onSubmit={handleSubmit} className="edit-form-grid">
                                <div className="form-group full-width">
                                    <label>รหัสพนักงาน (แก้ไขไม่ได้)</label>
                                    <input 
                                        type="text" 
                                        name="user_id" 
                                        value={formData.user_id} 
                                        readOnly 
                                        className="input-readonly" 
                                    />
                                </div>

                                <div className="form-group">
                                    <label>ชื่อ - นามสกุล</label>
                                    <input 
                                        type="text" 
                                        name="fullname" 
                                        value={formData.fullname} 
                                        onChange={handleChange} 
                                        required 
                                    />
                                </div>

                                <div className="form-group">
                                    <label>ตำแหน่ง</label>
                                    <input 
                                        type="text" 
                                        name="position" 
                                        value={formData.position} 
                                        onChange={handleChange} 
                                    />
                                </div>

                                <div className="form-group">
                                    <label>อีเมล</label>
                                    <input 
                                        type="email" 
                                        name="email" 
                                        value={formData.email} 
                                        onChange={handleChange} 
                                        required 
                                    />
                                </div>

                                <div className="form-group">
                                    <label>เบอร์โทรศัพท์</label>
                                    <input 
                                        type="tel" 
                                        name="phone_number" 
                                        value={formData.phone_number} 
                                        onChange={handleChange} 
                                    />
                                </div>

                                <div className="form-actions">
                                    <button type="button" onClick={() => navigate('/profileENG')} className="btn-cancel">
                                        ยกเลิก
                                    </button>
                                    <button type="submit" className="btn-save" disabled={loading}>
                                        <FaSave /> {loading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                </main>
            </div>
            
            {/* Mobile Overlay */}
            {isSidebarOpen && <div className="mobile-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
        </div>
    );
}

export default ProfileEditENG;