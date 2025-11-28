import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './Setup2FA.css';
import { QRCodeSVG } from 'qrcode.react';
//**** */
function Setup2FA() {
    const navigate = useNavigate();
    const location = useLocation();
    const { userId } = location.state || {};

    const [qrCodeData, setQrCodeData] = useState('');
    const [secret, setSecret] = useState('');
    const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const inputRefs = useRef([]);

    /* ==================== Fetch QR Code ==================== */
    useEffect(() => {
        if (!userId) {
            setError('User ID ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่');
            return;
        }

        const fetch2FA = async () => {
            setLoading(true);
            try {
                const response = await axios.post(
                    `${process.env.REACT_APP_API_URL}/api/setup-2fa`,
                    { userId }
                );
                setQrCodeData(response.data.qrCodeUrl);
                setSecret(response.data.secret);
            } catch (err) {
                setError(err.response?.data?.message || 'ไม่สามารถโหลด QR Code ได้');
            } finally {
                setLoading(false);
            }
        };

        fetch2FA();
    }, [userId]);

    /* ==================== OTP Input Logic ==================== */
    const handleChange = (e, index) => {
        const value = e.target.value;
        if (/^\d*$/.test(value) && value.length <= 1) {
            const newOtp = [...otpCode];
            newOtp[index] = value;
            setOtpCode(newOtp);

            if (value && index < 5) inputRefs.current[index + 1].focus();
            if (!value && index > 0) inputRefs.current[index - 1].focus();
        }
    };

    /* ==================== Verify OTP ==================== */
    const handleVerify = async () => {
        const code = otpCode.join('');

        if (code.length !== 6) {
            setError('กรุณากรอก OTP ให้ครบ 6 หลัก');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL}/api/verify-2fa`,
                { userId, token: code }
            );

            setMessage(response.data.message || 'ตั้งค่า 2FA สำเร็จแล้ว');
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'รหัสไม่ถูกต้อง');
            setOtpCode(['', '', '', '', '', '']);
            inputRefs.current[0].focus();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="setupContainer">
            <div className="authCard">
                <h2>ตั้งค่า Two-Factor Authentication (2FA)</h2>

                {/* Loading */}
                {loading && !qrCodeData && (
                    <p>กำลังโหลด QR Code ...</p>
                )}

                {/* Error Before QR */}
                {error && !qrCodeData && (
                    <>
                        <p className="errorText">{error}</p>
                        <button className="nextButton" onClick={() => navigate(-1)}>
                            กลับไปหน้าเข้าสู่ระบบ
                        </button>
                    </>
                )}

                {/* QR CODE AREA */}
                {qrCodeData && (
                    <>
                        <div className="qrCodeContainer">
                            <QRCodeSVG value={qrCodeData} size={200} level="H" />

                            <p>
                                Secret Key: <b>{secret}</b>
                            </p>

                            <p>สแกน QR ด้วย Microsoft Authenticator หรือกรอก Secret Key</p>
                        </div>

                        {/* OTP Boxes */}
                        <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "20px" }}>
                            {otpCode.map((digit, index) => (
                                <input
                                    key={index}
                                    type="text"
                                    maxLength="1"
                                    value={digit}
                                    onChange={(e) => handleChange(e, index)}
                                    onFocus={(e) => e.target.select()}
                                    ref={(el) => (inputRefs.current[index] = el)}
                                    inputMode="numeric"
                                    className="otpInputField"
                                />
                            ))}
                        </div>

                        {/* Verify Button */}
                        <button
                            className="nextButton"
                            disabled={loading || otpCode.join('').length !== 6}
                            onClick={handleVerify}
                        >
                            {loading ? 'กำลังยืนยัน...' : 'ยืนยัน'}
                        </button>
                    </>
                )}

                {/* Back Button */}
                <button className="nextButton" style={{ marginTop: "10px" }} onClick={() => navigate(-1)}>
                    กลับ
                </button>

                {/* Error / Success Messages */}
                {error && <p className="errorText">{error}</p>}
                {message && <p style={{ color: "green", marginTop: "15px" }}>{message}</p>}
            </div>
        </div>
    );
}

export default Setup2FA;
