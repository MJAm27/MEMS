import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import VerifyPage from './components/VerifyPage';
import Setup2FAPage from './components/Setup2FAPage';
import ManagerMainPage from './components/ManagerMainPage';
import DashboardPage from './components/DashboardPage';

function App() {
    const [user] = useState(JSON.parse(localStorage.getItem('user')) || null);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = "/login";
    };

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LoginPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} /> 
                <Route path="/verify" element={<VerifyPage />} />
                <Route path="/setup-2fa" element={<Setup2FAPage />} />
                {/* ส่ง handleLogout เป็น Prop ไปให้ Manager */}
                <Route 
                    path="/dashboard/manager/*" 
                    element={<ManagerMainPage user={user} handleLogout={handleLogout} />} 
                />
                <Route path="/dashboard/*" element={<DashboardPage />} /> 
            </Routes>
        </BrowserRouter>
    );
}

export default App;