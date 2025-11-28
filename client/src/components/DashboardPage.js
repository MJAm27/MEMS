import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import EngineerMainPage from './EngineerMainPage';
import AdminMainPage from './AdminMainPage';

// ************************************************************
// ✅ 1. แก้ไข: ปรับปรุงการถอดรหัส Base64 URL-safe เพื่อความเสถียร
// ************************************************************
function getPayloadFromToken(token) {
    try {
        const base64Url = token.split('.')[1];
        let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        
        while (base64.length % 4) {
            base64 += '=';
        }
        
        const jsonPayload = window.atob(base64);
        
        const decodedString = decodeURIComponent(jsonPayload.split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(decodedString);
    } catch (e) {
        console.error('Error decoding token payload:', e);
        return null;
    }
}

const ManagerDashboard = ({ user }) => (
    <div>
        <h1>หน้าสำหรับ Manager ({user?.email})</h1>
        <p>เนื้อหาของ Manager...</p>
        <button onClick={() => {
            localStorage.removeItem('token');
            // แนะนำให้ใช้ navigate('/login') แทน window.location.href 
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
            localStorage.removeItem('token');
            navigate('/login');
        }
    }, [navigate]); 
    const renderDashboardByRole = () => {
        if (!userPayload) {
            return <p>กำลังโหลดข้อมูลผู้ใช้...</p>;
        }
        const { role } = userPayload; 
        console.log('User role ID:', role);

        switch (role) {
            case 'R-ENG': 
                return <EngineerMainPage user={userPayload} />;
            case 'R-ADM':
                return <AdminMainPage user={userPayload} />;
            case 'R-MGR':
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