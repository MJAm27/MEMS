import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
// import axios from 'axios'; // ถ้ามีการใช้ axios ใน DashboardPage ให้ import เข้ามาด้วย

import EngineerMainPage from './EngineerMainPage';
import AdminMainPage from './AdminMainPage';

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

const ManagerDashboard = ({ user, handleLogout }) => (
    <div>
        <h1>หน้าสำหรับ Manager ({user?.email})</h1>
        <p>เนื้อหาของ Manager...</p>
        <button onClick={handleLogout}>Logout</button>
    </div>
);


function DashboardPage() {
    const [userPayload, setUserPayload] = useState(null);
    const navigate = useNavigate();

    const handleLogout = useCallback(() => {
        localStorage.removeItem('token');
        navigate('/login', { replace: true }); 
    }, [navigate]); 

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('No token');
            handleLogout(); 
            return;
        }

        const payload = getPayloadFromToken(token);
        if (payload) {
            console.log('Payload:', payload);
            setUserPayload(payload);
        } else {
            console.log('Invalid token');
            localStorage.removeItem('token');
            handleLogout(); 
        }
    }, [handleLogout]); 

    useEffect(() => {
        if (userPayload && !['R-ENG', 'R-ADM', 'R-MGR'].includes(userPayload.role)) {
            console.warn(`Unknown role detected: ${userPayload.role}. Logging out.`);
            handleLogout(); 
        }
    }, [userPayload, handleLogout]);


    const renderDashboardByRole = () => {
        if (!userPayload) {
            return <p>กำลังโหลดข้อมูลผู้ใช้...</p>;
        }
        const { role } = userPayload; 
        console.log('User role ID:', role);

        switch (userPayload.role) { 
            case 'engineer': 
                return <EngineerMainPage user={userPayload} handleLogout={handleLogout} />;
            case 'admin':
                return <AdminMainPage user={userPayload} handleLogout={handleLogout} />;
            case 'manager':
                return <ManagerDashboard user={userPayload} handleLogout={handleLogout} />;
            default:
                return <p style={{color: 'red'}}>Error: ไม่พบ Role ที่ถูกต้อง ({userPayload.role})</p>;
        }
    };

    return renderDashboardByRole();
}

export default DashboardPage;