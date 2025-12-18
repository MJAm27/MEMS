import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import './LoginPage.css'; 
import logo from './logo/download.jpg'; 
// const API_BASE_URL = "http://localhost:3001";
function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {

            const response = await axios.post(`${REACT_APP_API_URL}/api/login`, { email, password });
            const { status, userId, token } = response.data;
            if (status === '2fa_required') {
                navigate('/verify', { state: { userId: userId } });
            } else if (status === '2fa_setup_required') {
                navigate('/setup-2fa', { state: { userId: userId } });
            } else {
                if (token) {
                    localStorage.setItem('token', token);
                } else {
                    console.warn("Login successful but no token received. Check server response.");
                }

                navigate('/dashboard'); 
            }

        } catch (err) {
            setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการล็อกอิน');
        }
    };

    return (
        <div className="background">
            <div className="loginCard">
                <img 
                    src={logo} 
                    alt="Rajavithi Hospital Logo" 
                    className="logo" 
                />
                <h2 className="header">เข้าสู่ระบบ</h2>
                
                <form onSubmit={handleSubmit} className="formContainer">

                    <input 
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        placeholder="อีเมล" 
                        className="inputField"
                        required 
                    />

                    <input 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="รหัสผ่าน" 
                        className="inputField"
                        required 
                    />
                    <div className="forgotPasswordContainer">
                        <Link to="/forgot-password" className="forgotPasswordLink">
                            ลืมรหัสผ่าน
                        </Link>
                    </div>

                    <button type="submit" className="loginButton">
                        เข้าสู่ระบบ
                    </button>
                    
                </form>
                
                {error && <p className="errorMessage">{error}</p>}
                <div className="register">
                    <Link to="/register" className="registerLink">
                        ลงทะเบียนสมาชิกใหม่
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;