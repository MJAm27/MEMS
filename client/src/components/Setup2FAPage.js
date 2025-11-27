import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

function Setup2FAPage() {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [error, setError] = useState('');
    const location = useLocation();
    const navigate = useNavigate();
    const userId = location.state?.userId;

    useEffect(() => {
        if (!userId) {
            navigate('/login'); 
            return;
        }

        const fetchQRCode = async () => {
            try {
                const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/setup-2fa`, { userId });
                setQrCodeUrl(response.data.qrCodeUrl);
            } catch (err) {
                setError('ไม่สามารถสร้าง QR Code ได้');
            }
        };

        fetchQRCode();
    }, [userId, navigate]);

    const handleNext = () => {
        navigate('/verify', { state: { userId: userId } });
    };

    return (
        <div>
            <h2>ตั้งค่า Two-Factor Authentication</h2>
            <p>นี่คือการเข้าสู่ระบบครั้งแรกของคุณ กรุณาสแกน QR Code นี้ด้วยแอพ Authenticator (เช่น Google Authenticator)</p>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {qrCodeUrl ? (
                <div>
                    <img src={qrCodeUrl} alt="QR Code" />
                    <p>หลังจากสแกนแล้ว กดปุ่ม "ถัดไป" เพื่อยืนยันรหัส 6 หลัก</p>
                    <button onClick={handleNext}>ถัดไป</button>
                </div>
            ) : (
                <p>กำลังโหลด QR Code...</p>
            )}
        </div>
    );
}

export default Setup2FAPage;