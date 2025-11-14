import React, { useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

function VerifyPage() {
    const [token, setToken] = useState(''); // รหัส 6 หลัก
    const [error, setError] = useState('');
    const location = useLocation();
    const navigate = useNavigate();
    const userId = location.state?.userId;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!userId) {
            navigate('/login');
            return;
        }

        try {
            const response = await axios.post('http://localhost:3001/api/verify-2fa', { userId, token });
            
            const loginToken = response.data.token;
            localStorage.setItem('authToken', loginToken);

            navigate('/dashboard');

        } catch (err) {
            setError(err.response?.data?.message || 'รหัสไม่ถูกต้อง');
        }
    };

    return (
        <div>
            <h2>ยืนยันตัวตน (2FA)</h2>
            <p>กรุณากรอกรหัส 6 หลักจากแอพ Authenticator ของคุณ</p>
            <form onSubmit={handleSubmit}>
                <input 
                    type="text" 
                    value={token} 
                    onChange={(e) => setToken(e.target.value)} 
                    placeholder="รหัส 6 หลัก" 
                    maxLength={6} 
                    required 
                />
                <button type="submit">ยืนยัน</button>
            </form>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    );
}

export default VerifyPage;