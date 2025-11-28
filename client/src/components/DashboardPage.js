
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import EngineerMainPage from './EngineerMainPage';
import AdminMainPage from './AdminMainPage';



function getPayloadFromToken(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g,'+').replace(/-/g,'/');
        return JSON.parse(decodeURIComponent(escape(window.atob(base64))));
    } catch (e) {
        return null;
    }
}

const ManagerDashboard = ({ user }) => (
    <div>
        <h1>หน้าสำหรับ Manager ({user?.email})</h1>
        <p>เนื้อหาของ Manager...</p>
        <button onClick={() => {
            localStorage.removeItem('token');
            window.location.href = '/login'; 
        }}>Logout</button>
    </div>
);


function DashboardPage() {
    const [userPayload, setUserPayload] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('No token')
            navigate('/login'); 
            return;
        }

        const payload = getPayloadFromToken(token);
        if (payload) {
            console.log('Payload:', payload);
            setUserPayload(payload);
        } else {
            console.log('Invalid token');
            // Token ไม่ถูกต้อง
            localStorage.removeItem('token');
            navigate('/login');
        }
    }, [navigate]);

    // ฟังก์ชันสำหรับ Render หน้าตาม Role
    const renderDashboardByRole = () => {
        if (!userPayload) {
            return <p>กำลังโหลดข้อมูลผู้ใช้...</p>;
        }

        const { role } = userPayload;
        console.log('User role:', role);

        switch (role) {

            case 'engineer':

                return <EngineerMainPage user={userPayload} />;

            case 'admin':
                return <AdminMainPage user={userPayload} />;

            case 'manager':
                return <ManagerDashboard user={userPayload} />;

            
            default:

                localStorage.removeItem('token');
                navigate('/login');
                return null;
        }
    };

    return renderDashboardByRole();
}

export default DashboardPage;