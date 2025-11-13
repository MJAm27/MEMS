import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom'; // 1. Import 'Link' เพิ่ม

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const response = await axios.post('http://localhost:3001/api/login', { email, password });
            const { status, userId } = response.data;

            if (status === '2fa_required') {
                navigate('/verify', { state: { userId: userId } });
            } else if (status === '2fa_setup_required') {
                navigate('/setup-2fa', { state: { userId: userId } });
            }

        } catch (err) {
            setError(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        }
    };

    return (
        <div>
            <h2>Login</h2>
            <form onSubmit={handleSubmit}>
                <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="Email" 
                    required 
                />
                <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Password" 
                    required 
                />
                <button type="submit">Login</button>
            </form>
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {/* 2. นี่คือส่วนที่เพิ่มเข้ามา */}
            <hr />
            <p>
                ยังไม่มีบัญชี? 
                <Link to="/register"> สร้างบัญชีใหม่</Link>
            </p>
        </div>
    );
}

export default LoginPage;