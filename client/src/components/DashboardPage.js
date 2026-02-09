import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import EngineerMainPage from './EngineerMainPage';
import AdminMainPage from './AdminMainPage';
import ManagerMainPage from './ManagerMainPage';

function getPayloadFromToken(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = window.atob(base64);
        return JSON.parse(jsonPayload); 
    } catch (e) {
        console.error('Error decoding token payload:', e);
        console.warn('Failed to decode token. Token structure might be incorrect or expired or JSON is invalid.');
        return null;
    }
}

function DashboardPage() {
    const [userPayload, setUserPayload] = useState(null); 
    const navigate = useNavigate();

    const handleLogout = useCallback(() => {
        localStorage.removeItem('token');
        setUserPayload(null); 
        navigate('/login', { replace: true }); 
    }, [navigate]); 

    const fetchAndSetUser = useCallback(async (token) => {
        if (!token) {
            handleLogout();
            return;
        }

        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error("Token expired or invalid.");
            
            const freshData = await response.json();
            
            const newUserPayload = { 
                ...freshData, 
                // ดึง role จาก token payload ก่อน ถ้าไม่มี ให้ใช้ role จาก freshData
                role: getPayloadFromToken(token)?.role || freshData.role 
            };
            
            setUserPayload(newUserPayload); 
            
        } catch (error) {
            console.error("Failed to fetch fresh user data:", error);
            handleLogout(); 
        }
    }, [handleLogout]);


    const refreshUser = useCallback(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetchAndSetUser(token);
        } else {
            handleLogout();
        }
    }, [fetchAndSetUser, handleLogout]);


    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            handleLogout(); 
            return;
        }
        
        fetchAndSetUser(token); 

    }, [handleLogout, fetchAndSetUser]); 

    // --- Logic การ Normalize Role ถูกต้อง ---
    // ตรวจสอบ userPayload ก่อนเข้าถึง property
    const userRole = userPayload?.role;
    const normalizedRole = userRole ? userRole.toUpperCase() : null;

    // กำหนด Role ที่จะใช้ในการ Render/Switch Case
    const renderRole = normalizedRole === 'ENGINEER' ? 'R-ENG' : (
                       normalizedRole === 'ADMIN' ? 'R-ADM' : (
                       normalizedRole === 'MANAGER' ? 'R-MGR' : userRole)); 
    // ----------------------------------------
    
    // ตรวจสอบความถูกต้องของ Role หลังโหลดข้อมูล
    useEffect(() => {
        // ใช้ normalizedRole ในการตรวจสอบเพื่อรองรับทั้ง 'R-ENG' และ 'ENGINEER'
        if (userPayload && normalizedRole && !['R-ENG', 'R-ADM', 'R-MGR', 'ENGINEER', 'ADMIN', 'MANAGER'].includes(normalizedRole)) {
            console.warn(`Unknown role detected: ${userPayload.role}. Logging out.`);
            handleLogout(); 
        }
    }, [userPayload, normalizedRole, handleLogout]);


    const renderDashboardByRole = () => {
        if (!userPayload) {
            return (
                <div className="flex items-center justify-center h-screen bg-gray-50">
                    <p className="text-xl text-gray-600">กำลังโหลดข้อมูลผู้ใช้...</p>
                </div>
            );
        }

        // ใช้ renderRole ที่ถูก Normalize แล้ว
        console.log('Rendering dashboard for role:', renderRole);

        switch (renderRole) { 
            case 'R-ENG': 
                return <EngineerMainPage user={userPayload} handleLogout={handleLogout} refreshUser={refreshUser} />; 
            case 'R-ADM':
                return <AdminMainPage user={userPayload} handleLogout={handleLogout} refreshUser={refreshUser} />;
            case 'R-MGR':
                return <ManagerMainPage user={userPayload} handleLogout={handleLogout} refreshUser={refreshUser} />;
            default:
                return (
                    <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
                        {/* แสดง role ดั้งเดิมในข้อความ Error */}
                        <p>Error: ไม่พบ Role ที่ถูกต้อง ({userRole}) โปรดติดต่อผู้ดูแลระบบ</p>
                        <button onClick={handleLogout} className="mt-2 text-sm underline">ออกจากระบบ</button>
                    </div>
                );
        }
    };

    return renderDashboardByRole();
}

export default DashboardPage;