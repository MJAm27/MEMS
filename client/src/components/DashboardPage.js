import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// (Helper function)
function getRoleFromToken(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.role;
    } catch (e) {
        return null;
    }
}

// สร้าง Component ของแต่ละ Role
const AdminDashboard = () => <div>หน้าสำหรับ Admin</div>;
const ManagerDashboard = () => <div>หน้าสำหรับ Manager</div>;
const EngineerDashboard = () => <div>หน้าสำหรับ Engineer</div>;

function DashboardPage() {
    const [userRole, setUserRole] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            navigate('/login'); 
            return;
        }

        const role = getRoleFromToken(token);
        if (role) {
            setUserRole(role);
        } else {
            localStorage.removeItem('authToken');
            navigate('/login');
        }
    }, [navigate]);

    const renderDashboard = () => {
        switch (userRole) {
            case 'admin':
                return <AdminDashboard />;
            case 'manager':
                return <ManagerDashboard />;
            case 'engineer':
                return <EngineerDashboard />;
            default:
                return <p>กำลังโหลดข้อมูลผู้ใช้...</p>;
        }
    };

    return (
        <div>
            <h1>ยินดีต้อนรับค่ะ</h1>
            {renderDashboard()}
            <button onClick={() => {
                localStorage.removeItem('authToken');
                navigate('/login');
            }}>Logout</button>
        </div>
    );
}

export default DashboardPage;