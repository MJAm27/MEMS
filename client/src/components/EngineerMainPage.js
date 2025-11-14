import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Sidebar from './Sidebar'; 
import './DashboardPage.css'; 

function EngineerMainPage({ user }) {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        navigate('/login');
    };

    return (
        // 2. นี่คือ Layout Container ใหม่
        <div className="layout-container">
            
            {/* 3. เรียกใช้ Sidebar ที่ถูกต้อง */}
            <Sidebar /> 

            {/* 4. นี่คือส่วนเนื้อหาหลัก (ด้านขวา) */}
            <main className="main-content-area">
                
                {/* 5. Header ที่อยู่ด้านบนของเนื้อหา */}
                <header className="main-content-header">
                    <h2>หน้าหลักวิศวกร</h2>
                    <div className="user-info">
                        <span>สวัสดี, {user?.email || 'User'}</span>
                        <button onClick={handleLogout} className="logout-button-top">
                            ออกจากระบบ
                        </button>
                    </div>
                </header>

                {/* 6. ส่วน 3 ปุ่ม (เหมือนเดิม) */}
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