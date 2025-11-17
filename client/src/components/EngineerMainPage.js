import React, { useState } from 'react';
import { useNavigate, NavLink, Routes, Route, Link } from 'react-router-dom'; 
import { FaHome, FaSearch, FaHistory, FaUser, FaBars } from 'react-icons/fa';
import './EngineerMainPage.css'; 

import WithdrawPage from './WithdrawPage'; 

const SearchPage = () => <div><h2>หน้าค้นหา</h2></div>;
const HistoryPage = () => <div><h2>หน้าประวัติ</h2></div>;
const PlaceholderPage = ({ title }) => <div><h2>{title}</h2></div>;

function EngineerMainPage({ user }) {
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        navigate('/login');
    };

    return (
        <div className={`layout-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            
            {/* Sidebar */}
            <nav className="sidebar-container">
                <div className="sidebar-header">
                    {isSidebarOpen && <h3>MEMS</h3>}
                </div>
                <ul className="sidebar-nav">
                    <li>
                        <NavLink to="." end className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                            <FaHome /> {isSidebarOpen && <span>หน้าหลัก</span>}
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="search" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                            <FaSearch /> {isSidebarOpen && <span>ค้นหา</span>}
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="history" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                            <FaHistory /> {isSidebarOpen && <span>ประวัติ</span>}
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/profileENG" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                            <FaUser /> {isSidebarOpen && <span>โปรไฟล์</span>}
                        </NavLink>
                    </li>
                </ul>
            </nav>


            <main className="main-content-area">
                <header className="main-content-header">
                    <button onClick={toggleSidebar} className="sidebar-toggle-btn">
                        <FaBars />
                    </button>
                    <div className="user-info">
                        <span>สวัสดี, {user?.fullname || 'User'}</span>
                        <button onClick={handleLogout} className="logout-button-top">ออกจากระบบ</button>
                    </div>
                </header>
                <h2>หน้าหลักวิศวกร</h2>
                <div className="button-container">
                    <Link to="withdraw" className="action-button">เบิกอะไหล่</Link>
                    <Link to="return" className="action-button">คืนอะไหล่</Link>
                    <Link to="borrow" className="action-button">ยืมอะไหล่</Link>
                </div>
                
                <Routes>
                    <Route path="" element={<></>} /> 
                    <Route path="search" element={<SearchPage />} />
                    <Route path="history" element={<HistoryPage />} />
                    <Route path="withdraw" element={<WithdrawPage />} />
                    <Route path="return" element={<PlaceholderPage title="หน้าคืนอะไหล่" />} />
                    <Route path="borrow" element={<PlaceholderPage title="หน้ายืมอะไหล่" />} />
                    <Route path="profile-edit" element={<PlaceholderPage title="หน้าแก้ไขโปรไฟล์" />} />
                    <Route path="change-password" element={<PlaceholderPage title="หน้าเปลี่ยนรหัสผ่าน" />} />
                </Routes>
            </main>
        </div>
    );
}

export default EngineerMainPage;
