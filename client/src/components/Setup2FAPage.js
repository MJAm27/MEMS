import React, { useState, useEffect, useRef } from 'react'; // เพิ่ม useRef
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import styles from './Setup2FA.module.css'; 

// **********************************************
// **** แก้ไข: เปลี่ยนการ Import เป็น Named Export (QRCodeSVG) ****
// **********************************************
import { QRCodeSVG } from 'qrcode.react'; 


function Setup2FA() {
    const navigate = useNavigate();
    const location = useLocation();
    const { userId } = location.state || {}; // รับ userId จากหน้าก่อนหน้า
    
    const [qrCodeData, setQrCodeData] = useState('');
    const [secret, setSecret] = useState('');
    const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']); 
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const inputRefs = useRef([]); // สำหรับอ้างอิง input แต่ละตัว

    useEffect(() => {
        if (!userId) {
            setError('User ID ไม่ถูกต้อง กรุณาลองเข้าสู่ระบบใหม่');
            return;
        }
        // ดึง QR Code และ Secret Key จาก Server เมื่อ Component โหลด
        const fetch2FAData = async () => {
            setLoading(true);
            try {
                // เปลี่ยน endpoint ตาม API ของคุณ
                const response = await axios.post('http://localhost:3001/api/generate-2fa-setup', { userId });
                setQrCodeData(response.data.qrCodeUrl);
                setSecret(response.data.secret);
            } catch (err) {
                setError(err.response?.data?.message || 'ไม่สามารถสร้าง QR Code ได้');
            } finally {
                setLoading(false);
            }
        };
        fetch2FAData();
    }, [userId]);

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

    const handleVerify2FA = async () => {
        setLoading(true);
        setError('');
        setMessage('');
        const code = otpCode.join(''); // รวมรหัส OTP 6 หลัก
        if (code.length !== 6) {
            setError('กรุณากรอกรหัส OTP 6 หลัก');
            setLoading(false);
            return;
        }

        try {
            // เปลี่ยน endpoint ตาม API ของคุณ
            const response = await axios.post('http://localhost:3001/api/verify-2fa-setup', { userId, token: code });
            setMessage(response.data.message || 'ตั้งค่า 2FA สำเร็จแล้ว');
            
            // นำทางไปยังหน้าหลักหลังจากยืนยันสำเร็จ
            navigate('/dashboard'); 
        } catch (err) {
            setError(err.response?.data?.message || 'รหัส OTP ไม่ถูกต้อง');
            setOtpCode(['', '', '', '', '', '']); // ล้างรหัสเพื่อให้กรอกใหม่
            if(inputRefs.current[0]) inputRefs.current[0].focus(); // ย้าย focus กลับไปที่ช่องแรก
        } finally {
            setLoading(false);
        }
    };

    const handleGoBack = () => {
        navigate(-1); // กลับไปยังหน้าก่อนหน้า
    };

    if (loading && !qrCodeData && !error) {
        return (
            <div className={styles.background}>
                <div className={styles.card}>
                    <p>กำลังโหลด QR Code...</p>
                </div>
            </div>
        );
    }
    
    // หากมี error เกิดขึ้นก่อนโหลด QR Code
    if (error && !qrCodeData) {
        return (
            <div className={styles.background}>
                <div className={styles.card}>
                    <p className={styles.errorMessage}>{error}</p>
                    <button 
                        className={styles.secondaryButton} 
                        onClick={handleGoBack}
                    >
                        กลับไปหน้าเข้าสู่ระบบ
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.background}>
            <div className={styles.card}>
                <h2 className={styles.header}>ตั้งค่า QR Code สำหรับเชื่อมต่อ Microsoft Authenticator</h2>
                {qrCodeData && ( // แสดงเมื่อมีข้อมูล QR Code
                    <>
                        <div className={styles.qrCodeContainer}>
                            {/* ********************************************** */}
                            {/* **** ใช้ QRCodeSVG ที่ import มา **** */}
                            {/* ********************************************** */}
                            <QRCodeSVG 
                                value={qrCodeData} 
                                size={200} 
                                level="H" 
                                // เพิ่ม style เพื่อให้ดูดี
                                style={{ display: 'block' }} 
                            />
                        </div>
                        <p className={styles.secretKey}>Secret Key: <span className={styles.secretValue}>{secret}</span></p>
                        <p className={styles.instruction}>สแกน QR Code ด้วย Microsoft Authenticator App หรือป้อน Secret Key ด้านบน</p>
                        
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
                                />
                            ))}
                        </div>
                        {/* ปุ่ม "ยืนยัน" */}
                        <button 
                            className={styles.primaryButton} 
                            onClick={handleVerify2FA} 
                            disabled={loading || otpCode.join('').length !== 6}
                        >
                            {loading ? 'กำลังยืนยัน...' : 'ยืนยัน'}
                        </button>
                    </>
                )}
                
                {/* ปุ่ม "กลับไปหน้าเข้าสู่ระบบ" */}
                <button 
                    className={styles.secondaryButton} 
                    onClick={handleGoBack}
                    disabled={loading}
                >
                    กลับไปหน้าเข้าสู่ระบบ
                </button>
                {error && <p className={styles.errorMessage}>{error}</p>}
                {message && <p className={styles.successMessage}>{message}</p>}
            </div>
        </div>
    );
}

export default Setup2FA;