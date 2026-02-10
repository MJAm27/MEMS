import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import VerifyPage from './components/VerifyPage';
import Setup2FAPage from './components/Setup2FAPage';
import ManagerMainPage from './components/ManagerMainPage';
import DashboardPage from './components/DashboardPage';
import ChangePasswordENG from './components/ChangePasswordENG';
import ProfileENG from './components/ProfileENG'; 
import ProfileEditENG from './components/ProfileEditENG';

function App() {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = "/login";
    };
    // ฟังก์ชันนี้จะทำหน้าที่อัปเดต state user เมื่อมีการแก้ไขข้อมูล
    const refreshUser = () => {
        const updatedUser = JSON.parse(localStorage.getItem('user'));
        setUser(updatedUser);
        console.log("ข้อมูลผู้ใช้ถูกอัปเดตแล้ว");
    };

    const debounce = (callback) => {
        let tid;
        return (...args) => {
            window.cancelAnimationFrame(tid);
            tid = window.requestAnimationFrame(() => callback.apply(this, args));
        };
    };

    const resizeObserverErr = (e) => {
        if (e.message === 'ResizeObserver loop completed with undelivered notifications.' || 
            e.message === 'ResizeObserver loop limit exceeded') {
            const resizeObserverErrDiv = document.getElementById(
            'webpack-dev-server-client-overlay-div'
            );
            const resizeObserverErrStyle = document.getElementById(
            'webpack-dev-server-client-overlay'
            );
            if (resizeObserverErrDiv) resizeObserverErrDiv.setAttribute('style', 'display: none');
            if (resizeObserverErrStyle) resizeObserverErrStyle.setAttribute('style', 'display: none');
        }
    };

window.addEventListener('error', debounce(resizeObserverErr));

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
                <Route path="/profile" element={<ProfileENG user={user} />}>
                    <Route path="edit" element={<ProfileEditENG user={user} refreshUser={refreshUser} />} />
                    <Route path="change-passwordENG" element={<ChangePasswordENG />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;