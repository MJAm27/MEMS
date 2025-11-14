import React from 'react';
import { useNavigate, Link , NavLink} from 'react-router-dom';
import {FaHome, FaSearch, FaHistory, FaUser} from 'react-icons/fa';
import './EngineerMainPage.css'; 
function EngineerMainPage({ user }) {
    const navigate = useNavigate();
    console.log("data in user prop: ", user);
    const handleLogout = () => {
        localStorage.removeItem('authToken');
        navigate('/login');
    };

    return (

        <div className="layout-container">
             <nav className="sidebar-container">
                <div className="sidebar-header">
                    <h3>MEMS</h3>
                </div>

                <ul className="sidebar-nav">
                    <li>
                        <NavLink 
                            to="/dashboard" 
                            className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                            <FaHome /> <span>หน้าหลัก</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink 
                            to="/search" 
                            className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                            <FaSearch /> <span>ค้นหา</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink 
                            to="/history" 
                            className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                             <FaHistory /> <span>ประวัติ</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink 
                            to="/profileENG" 
                            className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                             <FaUser /> <span>โปรไฟล์</span>
                        </NavLink>
                    </li>
                </ul>
            </nav>


        <main className="main-content-area">
                <header className="main-content-header">
                     <h2>หน้าหลักวิศวกร</h2>
                        <div className="user-info">
                            <span>สวัสดี, {user?.fullname || 'User'}</span>
                            <button onClick={handleLogout} className="logout-button-top">
                                ออกจากระบบ
                            </button>
                        </div>
                </header>
                    <div className="button-container">
                        <Link to="/withdraw" className="action-button">เบิกอะไหล่</Link>
                        <Link to="/return" className="action-button">คืนอะไหล่</Link>
                        <Link to="/borrow" className="action-button">ยืมอะไหล่</Link>
                    </div>

        </main>
        </div>
    );
}

export default EngineerMainPage;