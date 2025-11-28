import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './VerifyPage.css'; 

function VerifyPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const userId = location.state?.userId;

    // เปลี่ยน token เป็น array สำหรับ input 6 ช่อง
    const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']); 
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const inputRefs = useRef([]); // สำหรับอ้างอิง input แต่ละตัว

    useEffect(() => {
        if (userId === undefined) return;

        if (!userId){
            navigate('/login',{replace:true});
        }
    }, [userId, navigate]);

    const handleChange = (e, index) => {
        const value = e.target.value;
        if (/^\d*$/.test(value) && value.length <= 1) { 
            const newOtpCode = [...otpCode];
            newOtpCode[index] = value;
            setOtpCode(newOtpCode);

            // เลื่อน focus ไปยัง input ถัดไป
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
             // ไม่จำเป็นต้องเรียก navigate อีก เพราะอยู่ใน useEffect แล้ว
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
            
            const loginToken = response.data.token;
            localStorage.setItem('token', loginToken);

            navigate('/dashboard');

        } catch (err) {
            setError(err.response?.data?.message || 'รหัสไม่ถูกต้อง');
            setOtpCode(['', '', '', '', '', '']); // ล้างรหัสเพื่อให้กรอกใหม่
            if(inputRefs.current[0]) inputRefs.current[0].focus(); // ย้าย focus กลับไปที่ช่องแรก
        } finally {
            setLoading(false);
        }
    };
    
    // สำหรับปุ่มกลับ
    const handleGoBack = () => {
        navigate('/login');
    };

    return (
        <div className={styles.background}>
            <div className={styles.card}>
                <h2 className={styles.header}>ยืนยันตัวตน (2FA)</h2>
                <p className={styles.instruction}>กรุณาป้อนรหัส 6 หลักจาก Authenticator App ของคุณ</p>
                
                <form onSubmit={handleSubmit} className={styles.formContainer}>
                    <div className={styles.otpInputGroup}>
                        {otpCode.map((digit, index) => (
                            <input
                                key={index}
                                type="text"
                                maxLength="1"
                                value={digit}
                                onChange={(e) => handleChange(e, index)}
                                onFocus={(e) => e.target.select()}
                                className={styles.otpInputField}
                                ref={(el) => (inputRefs.current[index] = el)}
                                inputMode="numeric"
                                required
                            />
                        ))}
                    </div>
                    
                    <button 
                        type="submit" 
                        className={styles.primaryButton}
                        disabled={loading || otpCode.join('').length !== 6} // ปิดปุ่มจนกว่าจะกรอกครบ
                    >
                        {loading ? 'กำลังยืนยัน...' : 'ยืนยัน'}
                    </button>
                </form>

                {/* ปุ่มกลับไปหน้าเข้าสู่ระบบ */}
                 <button 
                    className={styles.secondaryButton} 
                    onClick={handleGoBack}
                    disabled={loading}
                >
                    กลับไปหน้าเข้าสู่ระบบ
                </button>

                {error && <p className={styles.errorMessage}>{error}</p>}
            </div>
        </div>
    );
}

export default VerifyPage;