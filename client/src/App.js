import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import VerifyPage from './components/VerifyPage';
import Setup2FAPage from './components/Setup2FAPage';
import DashboardPage from './components/DashboardPage';
import RegisterPage from './components/RegisterPage';

import InventoryBalanceReportChart from './components/InventoryBalanceReportChart';
import EquipmentUsageReportChart from './components/EquipmentUsageReportChart';
import EquipmentAgeReportChart from './components/EquipmentAgeReportChart';
import UserList from './components/UserList';
import ProfileEditENG from './components/Profile';
import ManagerMainPage from './components/ManagerMainPage';



    function App() {
        return (
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<LoginPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} /> 
                    <Route path="/verify" element={<VerifyPage />} />
                    <Route path="/setup-2fa" element={<Setup2FAPage />} />
                    <Route path="/dashboard/manager/*" element={<ManagerMainPage />} />
                    <Route path="/dashboard/*" element={<DashboardPage />} /> 
                    <Route path="/profileEditENG" element={<ProfileEditENG />} /> 
                    <Route path="/report/inventory-balance" element={<InventoryBalanceReportChart />} />
                    <Route path="/report/equipment-usage" element={<EquipmentUsageReportChart />} />
                    <Route path="/report/equipment-age" element={<EquipmentAgeReportChart />} />

                    <Route path='/userList' element={<UserList />}/>

                    
                </Routes>
            </BrowserRouter>
        );
    }

    export default App;

                        //<Route path='/lowStockAlert' element={<LowStockAlert />}/>