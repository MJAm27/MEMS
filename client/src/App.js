import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import VerifyPage from './components/VerifyPage';
import Setup2FAPage from './components/Setup2FAPage';
import DashboardPage from './components/DashboardPage';
import ChangePasswordENG from './components/ChangePasswordENG';
import ProfileENG from './components/ProfileENG'; 
import ProfileEditENG from './components/ProfileEditENG';
import SearchPartPageENG from './components/SearchPartPageENG';
import InventoryBalanceReportChart from './components/InventoryBalanceReportChart';
import EquipmentUsageReportChart from './components/EquipmentUsageReportChart';
import EquipmentAgeReportChart from './components/EquipmentAgeReportChart';
import ForgotPasswordPage from './components/ForgotPasswordPage';
import ResetPasswordPage from './components/ResetPasswordPage';
function App() {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);


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
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/dashboard/*" element={<DashboardPage />} /> 
                <Route path="/profile" element={<ProfileENG user={user} />}>
                    <Route path="edit" element={<ProfileEditENG user={user} refreshUser={refreshUser} />} />
                    <Route path="change-passwordENG" element={<ChangePasswordENG />} />
                </Route>
                <Route path="SearchPartPage" element={<SearchPartPageENG />} />
                <Route path="/report/inventory-balance" element={<InventoryBalanceReportChart />} />
                    <Route path="/report/equipment-usage" element={<EquipmentUsageReportChart />} />
                    <Route path="/report/equipment-age" element={<EquipmentAgeReportChart />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;