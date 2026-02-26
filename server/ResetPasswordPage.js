import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import './LoginPage.css'; 
import logo from './logo/download.jpg'; 

function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token'); 
    const [passwords, setPasswords] = useState({ new: '', confirm: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // ตรวจสอบว่ามี Token หรือไม่เมื่อเข้าหน้านี้
    useEffect(() => {
        if (!token) {
            setError('ไม่พบลิงก์กู้คืนรหัสผ่านที่ถูกต้อง');
        }
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!token) return setError('ลิงก์ไม่ถูกต้องหรือหมดอายุ');
        if (passwords.new.length < 6) return setError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
        if (passwords.new !== passwords.confirm) return setError('รหัสผ่านไม่ตรงกัน');
        
        setLoading(true);
        setError('');

        try {
            const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/reset-password`, {
                token: token,
                newPassword: passwords.new
            });
            
            setMessage('เปลี่ยนรหัสผ่านสำเร็จแล้ว กำลังพากลับไปหน้าเข้าสู่ระบบ...');
            // หน่วงเวลาเพื่อให้ User อ่านข้อความสำเร็จก่อน
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้ ลิงก์อาจหมดอายุ');
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
                        <div style={{ position: 'relative', width: '100%' }}>
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
                                style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#6c757d' }}
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

                        <button type="submit" className="loginButton" disabled={loading || !token}>
                            {loading ? 'กำลังบันทึก...' : 'ยืนยันรหัสผ่านใหม่'}
                        </button>
                    </form>
                ) : (
                    <div className="success-badge" style={{ backgroundColor: '#f0fff4', color: '#2f855a', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                        {message}
                    </div>
                )}

                {error && <p className="errorMessage" style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
            </div>
        </div>
    );
}

export default ResetPasswordPage;