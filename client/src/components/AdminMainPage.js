import React from 'react';
import { useNavigate } from 'react-router-dom';
import './DashboardPage.css';

function AdminMainPage({ user }) {
    const navigate = useNavigate();
    const handleLogout = () => {
        localStorage.removeItem('authToken');
        navigate('/login');
    };

    return (
        <div className="dashboard-wrapper">
            <header className="dashboard-header">
                <h1>หน้าสำหรับ Admin ({user?.email})</h1>
            </header>
            
            {/* Admin อาจจะมีปุ่มจัดการผู้ใช้ ฯลฯ */}
            <div style={{padding: '20px'}}>
                <p>เนื้อหาของ Admin...</p>
            </div>

            <div className="logout-container">
                <button onClick={handleLogout} className="logout-button">Logout</button>
            </div>

        </div>
    );
}

export default AdminMainPage;