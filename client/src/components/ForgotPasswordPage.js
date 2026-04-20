import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import {  FaArrowLeft } from 'react-icons/fa';
import './LoginPage.css'; 
import logo from './logo/download.jpg'; 

function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
    const [step, setStep] = useState(1); // Step 1: Email, Step 2: OTP
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const inputRefs = useRef([]);

    const handleOtpChange = (e, index) => {
        const value = e.target.value;
        const newOtp = [...otpCode];

        if (/^\d?$/.test(value)) {
            newOtp[index] = value;
            setOtpCode(newOtp);
            
            if (value && index < 5) {
                inputRefs.current[index + 1].focus();
            }
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
            inputRefs.current[index - 1].focus();
        }
    };

    const handleCheckEmail = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await axios.post(`${process.env.REACT_APP_API_URL}/api/forgot-password/check`, { email });
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.message || 'ไม่พบอีเมลนี้ในระบบ');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        const code = otpCode.join('');
        if (code.length !== 6) return setError('กรุณากรอก OTP ให้ครบ 6 หลัก');

        setLoading(true);
        try {
            const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/forgot-password/verify-otp`, { 
                email, 
                token: code 
            });
            navigate(`/reset-password?token=${response.data.resetToken}`);
        } catch (err) {
            setError(err.response?.data?.message || 'รหัส OTP ไม่ถูกต้อง');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="background">
            <div className="loginCard animate-fadeIn">
                <img src={logo} alt="Logo" className="logo" />
                <h2 className="header">รีเซตรหัสผ่าน</h2>
                
                {step === 1 ? (
                    <form onSubmit={handleCheckEmail} className="formContainer">
                        <p className="text-muted mb-4">ระบุอีเมลเพื่อยืนยันตัวตนด้วย OTP</p>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} 
                               placeholder="อีเมล" className="inputField" required />
                        <button type="submit" className="loginButton" disabled={loading}>
                            {loading ? 'กำลังตรวจสอบ...' : 'ถัดไป'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOtp} className="formContainer">
                        <p className="text-muted mb-4">กรอกรหัส 6 หลักจากแอป Authenticator</p>
                        <div className="otpInputContainer" style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
                            {otpCode.map((digit, index) => (
                                <input 
                                    key={index} 
                                    type="text" 
                                    maxLength="1" 
                                    value={digit}
                                    onChange={(e) => handleOtpChange(e, index)}
                                    onKeyDown={(e) => handleKeyDown(e, index)} 
                                    ref={(el) => (inputRefs.current[index] = el)}
                                    className="otpInputField" 
                                    style={{ width: '40px', height: '50px', textAlign: 'center' }} 
                                />
                            ))}
                        </div>
                        <button type="submit" className="loginButton" disabled={loading}>
                            {loading ? 'กำลังยืนยัน...' : 'ยืนยันรหัส OTP'}
                        </button>
                        <button type="button" onClick={() => setStep(1)} className="registerLink" style={{ border: 'none', background: 'none', marginTop: '10px' }}>
                            แก้ไขอีเมล
                        </button>
                    </form>
                )}
                
                {error && <p className="errorMessage">{error}</p>}
                <div className="register">
                    <Link to="/login" className="registerLink"><FaArrowLeft /> กลับไปหน้าเข้าสู่ระบบ</Link>
                </div>
            </div>
        </div>
    );
}

export default ForgotPasswordPage;