import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
// import styles from './VerifyPage.css'; // ตรวจสอบให้แน่ใจว่า import ถูกต้องตามชื่อไฟล์ CSS ของคุณ

function VerifyPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const userId = location.state?.userId;

    const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']); 
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const inputRefs = useRef([]); 

    useEffect(() => {
        // ตรวจสอบ userId ก่อนเริ่ม
        if (userId === undefined || userId === null){
            navigate('/login',{replace:true});
        }
    }, [userId, navigate]);

    const handleChange = (e, index) => {
        const value = e.target.value;
        if (/^\d*$/.test(value) && value.length <= 1) { 
            const newOtpCode = [...otpCode];
            newOtpCode[index] = value;
            setOtpCode(newOtpCode);

            // เลื่อน focus
            if (value && index < otpCode.length - 1) {
                inputRefs.current[index + 1].focus();
            } else if (!value && index > 0) {
                // ถ้าลบตัวเลข ให้ย้อนกลับไป input ก่อนหน้า
                inputRefs.current[index - 1].focus();
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!userId) {
             setLoading(false);
             return; 
        }

        const token = otpCode.join(''); // รวมรหัส OTP 6 หลัก
        if (token.length !== 6) {
            setError('กรุณากรอกรหัส 6 หลักให้ครบถ้วน');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/verify-2fa`, { userId, token });
            
            // 💡 โค้ดที่แก้ไข: บันทึก Token และตั้งค่า Header
            const loginToken = response.data.token;
            if (loginToken) {
                localStorage.setItem('token', loginToken);
                axios.defaults.headers.common['Authorization'] = `Bearer ${loginToken}`;
            }

            navigate('/dashboard'); // ✅ Redirect สำเร็จ

        } catch (err) {
            setError(err.response?.data?.message || 'รหัสไม่ถูกต้อง');
            setOtpCode(['', '', '', '', '', '']); 
            if(inputRefs.current[0]) inputRefs.current[0].focus(); 
        } finally {
            setLoading(false);
        }
    };
    
    // สำหรับปุ่มกลับ
    const handleGoBack = () => {
        navigate('/login');
    };

    return (
        <div className="background"> {/* ใช้ className ตามไฟล์ CSS ของคุณ */}
            <div className="card">
                <h2>ยืนยันตัวตน (2FA)</h2>
                <p>กรุณาป้อนรหัส 6 หลักจาก Authenticator App ของคุณ</p>
                
                <form onSubmit={handleSubmit} className="formContainer">
                    <div className="otpInputGroup">
                        {otpCode.map((digit, index) => (
                            <input
                                key={index}
                                type="text"
                                maxLength="1"
                                value={digit}
                                onChange={(e) => handleChange(e, index)}
                                onFocus={(e) => e.target.select()}
                                className="otpInputField"
                                ref={(el) => (inputRefs.current[index] = el)}
                                inputMode="numeric"
                                required
                            />
                        ))}
                    </div>
                    
                    <button 
                        type="submit" 
                        className="primaryButton"
                        disabled={loading || otpCode.join('').length !== 6} 
                    >
                        {loading ? 'กำลังยืนยัน...' : 'ยืนยัน'}
                    </button>
                </form>

                {/* ปุ่มกลับไปหน้าเข้าสู่ระบบ */}
                   <button 
                        className="secondaryButton" 
                        onClick={handleGoBack}
                        disabled={loading}
                    >
                        กลับไปหน้าเข้าสู่ระบบ
                    </button>

                {error && <p className="errorMessage">{error}</p>}
            </div>
        </div>
    );
}

export default VerifyPage;