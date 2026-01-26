import React from 'react';
    import { BrowserRouter, Routes, Route } from 'react-router-dom';
    import LoginPage from './components/LoginPage';
    import VerifyPage from './components/VerifyPage';
    import Setup2FAPage from './components/Setup2FAPage';
    import DashboardPage from './components/DashboardPage';
    import RegisterPage from './components/RegisterPage';
    import InventoryBalanceReportChart from './components/InventoryBalanceReportChart'
    //import LowStockAlert from './components/LowStockAlert'
    import UserList from './components/UserList'
    import EditUser from './components/EditUser'
    

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

                    <Route path='/inventoryBalanceReportChart' element={<InventoryBalanceReportChart />}/>

                    <Route path='/userList' element={<UserList />}/>
                    <Route path='/editUser' element={<EditUser />}/>
                    
                </Routes>
            </BrowserRouter>
        );
    }

    export default App;

                        //<Route path='/lowStockAlert' element={<LowStockAlert />}/>