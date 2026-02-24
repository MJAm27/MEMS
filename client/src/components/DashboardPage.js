import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Import ส่วนประกอบหน้าหลักของแต่ละบทบาท
import EngineerMainPage from './EngineerMainPage';
import AdminMainPage from './AdminMainPage';
import ManagerMainPage from './ManagerMainPage';

/**
 * ฟังก์ชันสำหรับถอดรหัส Token เพื่อดูข้อมูล Payload (เช่น role)
 */
function getPayloadFromToken(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = window.atob(base64);
        return JSON.parse(jsonPayload); 
    } catch (e) {
        console.error('Error decoding token:', e);
        return null;
    }
}

function DashboardPage() {
    const [userPayload, setUserPayload] = useState(null); 
    const navigate = useNavigate();
    const API_URL = process.env.REACT_APP_API_URL ;

    /**
     * ฟังก์ชันออกจากระบบ
     */
    const handleLogout = useCallback(() => {
        localStorage.removeItem('token');
        setUserPayload(null); 
        navigate('/login', { replace: true }); 
    }, [navigate]); 

    /**
     * ฟังก์ชันดึงข้อมูลผู้ใช้ปัจจุบันจาก Server
     */
    const fetchAndSetUser = useCallback(async (token) => {
        if (!token) {
            handleLogout();
            return;
        }

        try {
            const response = await axios.get(`${API_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const freshData = response.data;
            const tokenPayload = getPayloadFromToken(token);
            
            // ผสมข้อมูลจาก API และ Role จาก Token
            const newUserPayload = { 
                ...freshData, 
                role: tokenPayload?.role || freshData.role 
            };
            
            setUserPayload(newUserPayload); 
            
        } catch (error) {
            console.error("Failed to fetch user data:", error);
            handleLogout(); 
        }
    }, [handleLogout, API_URL]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            handleLogout(); 
        } else {
            fetchAndSetUser(token); 
        }
    }, [handleLogout, fetchAndSetUser]);

    /**
     * Logic การตัดสินใจเลือกหน้า Dashboard ตามบทบาท (Role)
     * แก้ไข: เพิ่มการดักจับค่า "MANAGER" และ "R-MGR" ให้แม่นยำขึ้น
     */
    const renderDashboardByRole = () => {
        if (!userPayload) {
            return (
                <div className="flex items-center justify-center h-screen bg-gray-50">
                    <p className="text-xl text-gray-600">กำลังยืนยันตัวตน...</p>
                </div>
            );
        }

        const rawRole = userPayload.role ? userPayload.role.toUpperCase() : "";

        // ตรวจสอบเงื่อนไขเพื่อส่งไปยังหน้า ManagerMainPage
        if (rawRole === 'MANAGER' || rawRole === 'R-MGR' || rawRole === 'MGR') {
            return <ManagerMainPage user={userPayload} handleLogout={handleLogout} />;
        } 
        
        // ตรวจสอบเงื่อนไขสำหรับ Admin
        if (rawRole === 'ADMIN' || rawRole === 'R-ADM' || rawRole === 'ADM') {
            return <AdminMainPage user={userPayload} handleLogout={handleLogout} />;
        }

        // ตรวจสอบเงื่อนไขสำหรับ Engineer
        if (rawRole === 'ENGINEER' || rawRole === 'R-ENG' || rawRole === 'ENG') {
            return <EngineerMainPage user={userPayload} handleLogout={handleLogout} />;
        }

        // กรณีไม่พบ Role ที่กำหนด
        return (
            <div className="p-8 text-center">
                <h2 className="text-red-600 font-bold">ไม่พบสิทธิ์การใช้งานที่ถูกต้อง</h2>
                <p>Role ปัจจุบันของคุณคือ: {userPayload.role}</p>
                <button onClick={handleLogout} className="mt-4 bg-gray-200 px-4 py-2 rounded">ออกจากระบบ</button>
            </div>
        );
    };

    return renderDashboardByRole();
}

export default DashboardPage;