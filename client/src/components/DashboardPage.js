
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import EngineerMainPage from './EngineerMainPage';
import AdminMainPage from './AdminMainPage';



function getPayloadFromToken(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload; 
    } catch (e) {
        return null;
    }
}

const ManagerDashboard = ({ user }) => (
    <div>
        <h1>หน้าสำหรับ Manager ({user?.email})</h1>
        <p>เนื้อหาของ Manager...</p>
        <button onClick={() => {
            localStorage.removeItem('authToken');
            window.location.href = '/login'; 
        }}>Logout</button>
    </div>
);


function DashboardPage() {
    const [userPayload, setUserPayload] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            navigate('/login'); 
            return;
        }

        const payload = getPayloadFromToken(token);
        if (payload) {
            setUserPayload(payload);
        } else {
            // Token ไม่ถูกต้อง
            localStorage.removeItem('authToken');
            navigate('/login');
        }
    }, [navigate]);

    // ฟังก์ชันสำหรับ Render หน้าตาม Role
    const renderDashboardByRole = () => {
        if (!userPayload) {
            return <p>กำลังโหลดข้อมูลผู้ใช้...</p>;
        }

        const { role } = userPayload;

        switch (role) {
            case 'engineer':
                // ส่งข้อมูล 'user' (payload) ไปให้ Component ของ Engineer
                return <EngineerMainPage user={userPayload} />;
            
            case 'admin':
                return <AdminMainPage user={userPayload} />;
            
            case 'manager':
                return <ManagerDashboard user={userPayload} />;
            
            default:
                // ถ้าเจอ Role แปลกๆ หรือ Role 'unknown'
                localStorage.removeItem('authToken');
                navigate('/login');
                return null;
        }
    };

    // return สิ่งที่ renderDashboardByRole() คืนค่ามา
    return renderDashboardByRole();
}

export default DashboardPage;