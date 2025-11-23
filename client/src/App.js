import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import VerifyPage from './components/VerifyPage';
import Setup2FAPage from './components/Setup2FAPage';
import DashboardPage from './components/DashboardPage';
import RegisterPage from './components/RegisterPage';
import ProfileENG from './components/ProfileENG';
import ProfileEditENG from './components/ProfileEditENG';
import EngineerMainPage from './components/EngineerMainPage';


function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LoginPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} /> 
                <Route path="/verify" element={<VerifyPage />} />
                <Route path="/setup-2fa" element={<Setup2FAPage />} />
                <Route path="/dashboard/*" element={<DashboardPage />} />
                <Route path="/profileENG" element={<ProfileENG />} />
                <Route path="/profileENG/edit" element={<ProfileEditENG />} />
                <Route path="/profileENG/profile-edit" element={<ProfileEditENG />} />
                <Route path="/engineer/*" element={<EngineerMainPage />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;