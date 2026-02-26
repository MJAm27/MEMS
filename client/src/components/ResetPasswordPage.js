import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import './LoginPage.css'; // ใช้ CSS หลัก
import logo from './logo/download.jpg'; 

function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token'); // รับ Token จาก URL ที่ได้จากหน้า ForgotPassword
    const [passwords, setPasswords] = useState({ new: '', confirm: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            return setError('รหัสผ่านไม่ตรงกัน');
        }
        
        setLoading(true);
        setError('');

        try {
            // แก้ไข: ลบ 'const res =' ออกเนื่องจากไม่ได้ใช้งาน เพื่อไม่ให้เกิด Warning
            await axios.post(`${process.env.REACT_APP_API_URL}/api/reset-password`, {
                token,
                newPassword: passwords.new
            });
            
            setMessage('เปลี่ยนรหัสผ่านสำเร็จแล้ว กำลังพากลับไปหน้าเข้าสู่ระบบ...');
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'ลิงก์หมดอายุหรือเกิดข้อผิดพลาดในการบันทึก');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="background">
            <div className="loginCard animate-fadeIn">
                <img src={logo} alt="Logo" className="logo" />
                <h2 className="header">ตั้งรหัสผ่านใหม่</h2>
                
                {!message ? (
                    <form onSubmit={handleSubmit} className="formContainer">
                        <div className="input-with-icon" style={{ position: 'relative' }}>
                            <input 
                                type={showPassword ? "text" : "password"}
                                value={passwords.new}
                                onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                                placeholder="รหัสผ่านใหม่" 
                                className="inputField"
                                required 
                            />
                            <div 
                                onClick={() => setShowPassword(!showPassword)}
                                style={{ position: 'absolute', right: '15px', top: '15px', cursor: 'pointer', color: '#6c757d' }}
                            >
                                {showPassword ? <FaEyeSlash /> : <FaEye />}
                            </div>
                        </div>

                        <input 
                            type="password"
                            value={passwords.confirm}
                            onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                            placeholder="ยืนยันรหัสผ่านใหม่" 
                            className="inputField"
                            required 
                        />

                        <button type="submit" className="loginButton" disabled={loading}>
                            {loading ? 'กำลังบันทึก...' : 'ยืนยันรหัสผ่านใหม่'}
                        </button>
                    </form>
                ) : (
                    <div className="success-badge bg-green-50 text-green-600 p-4 rounded-xl">
                        {message}
                    </div>
                )}

                {error && <p className="errorMessage">{error}</p>}
            </div>
        </div>
    );
}

export default ResetPasswordPage;