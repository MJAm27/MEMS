import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

// 1. แก้ไขเส้นทาง CSS: ใช้ './' หากไฟล์อยู่ในโฟลเดอร์เดียวกัน
import './LoginPage.css'; 

// 2. แก้ไขเส้นทางโลโก้: ใช้ './' หากโฟลเดอร์ logo อยู่ใน src/components/ เหมือนกัน
import logo from './logo/download.jpg'; 

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            // ส่งข้อมูลล็อกอินไปยัง Backend
            const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/login`, { email, password });
            
            // ************************************************************
            // ✅ แก้ไข: ต้องดึง 'token' ออกมาจาก response.data ด้วย
            // ************************************************************
            const { status, userId, token } = response.data;

            // ตรวจสอบเงื่อนไขการนำทางตามสถานะจาก Server
            if (status === '2fa_required') {
                // ต้องยืนยัน 2FA
                navigate('/verify', { state: { userId: userId } });
            } else if (status === '2fa_setup_required') {
                // ต้องตั้งค่า 2FA ก่อน
                navigate('/setup-2fa', { state: { userId: userId } });
            } else {
                // กรณีล็อกอินสำเร็จสมบูรณ์ (ไม่มี 2FA หรือผ่าน 2FA แล้ว)
                
                // ************************************************************
                // ✅ แก้ไขที่สำคัญที่สุด: จัดเก็บ Token ก่อนนำทางไปยัง Dashboard
                // ************************************************************
                if (token) {
                    localStorage.setItem('token', token);
                } else {
                    console.warn("Login successful but no token received. Check server response.");
                }

                navigate('/dashboard'); 
            }

        } catch (err) {
            // จัดการข้อผิดพลาดในการล็อกอิน
            setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการล็อกอิน');
        }
    };

    return (
        <div className="background">
            <div className="loginCard">
                
                {/* โลโก้ */}
                <img 
                    src={logo} 
                    alt="Rajavithi Hospital Logo" 
                    className="logo" 
                />
                
                {/* หัวข้อ */}
                <h2 className="header">เข้าสู่ระบบ</h2>
                
                <form onSubmit={handleSubmit} className="formContainer">
                    
                    {/* ช่องกรอกอีเมล */}
                    <input 
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        placeholder="อีเมล" 
                        className="inputField"
                        required 
                    />
                    
                    {/* ช่องกรอกรหัสผ่าน */}
                    <input 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="รหัสผ่าน" 
                        className="inputField"
                        required 
                    />

                    {/* ลิงก์ "ลืมรหัสผ่าน" */}
                    <div className="forgotPasswordContainer">
                        <Link to="/forgot-password" className="forgotPasswordLink">
                            ลืมรหัสผ่าน
                        </Link>
                    </div>

                    {/* ปุ่ม "เข้าสู่ระบบ" */}
                    <button type="submit" className="loginButton">
                        เข้าสู่ระบบ
                    </button>
                    
                </form>
                
                {/* แสดงข้อผิดพลาด */}
                {error && <p className="errorMessage">{error}</p>}
                <div className="register">
                    <Link to="/register" className="registerLink">
                        ลงทะเบียนสมาชิกใหม่
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;