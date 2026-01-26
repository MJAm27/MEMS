import React from 'react';
    import { BrowserRouter, Routes, Route } from 'react-router-dom';
    import LoginPage from './components/LoginPage';
    import VerifyPage from './components/VerifyPage';
    import Setup2FAPage from './components/Setup2FAPage';
    import DashboardPage from './components/DashboardPage';
    import RegisterPage from './components/RegisterPage';
<<<<<<< HEAD
    import InventoryBalanceReportChart from './components/InventoryBalanceReportChart'
    //import LowStockAlert from './components/LowStockAlert'
    import UserList from './components/UserList'
    import EditUser from './components/EditUser'
    
=======
    import ProfileEditENG from './components/Profile'
    import InventoryBalanceReportChart from './components/InventoryBalanceReportChart';
>>>>>>> 952a636d28d4d48590e7b09e416970bf25bba5ea

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
                    <Route path="/profileEditENG" element={<ProfileEditENG />} /> 
                    <Route path="/report/inventory-balance" element={<InventoryBalanceReportChart />} />

<<<<<<< HEAD
                    <Route path='/inventoryBalanceReportChart' element={<InventoryBalanceReportChart />}/>

                    <Route path='/userList' element={<UserList />}/>
                    <Route path='/editUser' element={<EditUser />}/>
=======
>>>>>>> 952a636d28d4d48590e7b09e416970bf25bba5ea
                    
                </Routes>
            </BrowserRouter>
        );
    }

    export default App;

                        //<Route path='/lowStockAlert' element={<LowStockAlert />}/>