import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import './VerifyPage.css'; 

// const API_BASE_URL = "http://localhost:3001"; 
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
            if (value && index < otpCode.length - 1) {
                inputRefs.current[index + 1].focus();
            } else if (!value && index > 0) {
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

        const token = otpCode.join(''); 
        if (token.length !== 6) {
            setError('กรุณากรอกรหัส 6 หลักให้ครบถ้วน');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.post(`${REACT_APP_API_URL}/api/verify-2fa`, { userId, token });
            
            const {token: loginToken} = response.data;
            if (loginToken) {
                localStorage.setItem('token', loginToken);
                axios.defaults.headers.common['Authorization'] = `Bearer ${loginToken}`;
            }else{
                console.warn("Verify successful but no token received.");
            }
            

            navigate('/dashboard', { replace: true });

        } catch (err) {
            setError(err.response?.data?.message || 'รหัสไม่ถูกต้อง');
            setOtpCode(['', '', '', '', '', '']); 
            if(inputRefs.current[0]) inputRefs.current[0].focus(); 
        } finally {
            setLoading(false);
        }
    };

    const handleGoBack = () => {
        navigate('/login');
    };

    return (
        <div className="background"> 
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