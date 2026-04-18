import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import './RegisterPage.css';

function RegisterPage() {
    const [formData, setFormData] = useState({
        fullname: '',
        email: '',
        password: '',
        position: '', 
        phone_number: '',
        role_id: ''
    });
    
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!formData.email || !formData.password || !formData.fullname || !formData.role_id) {
            setError('กรุณากรอก Email, Password, Fullname, และเลือก Role');
            return;
        }

        try {
            const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/register`, formData);
            setSuccess(response.data.message);

            setTimeout(() => {
                navigate('/login');
            }, 2000);

        } catch (err) {
            setError(err.response?.data?.message || 'การลงทะเบียนล้มเหลว');
        }
    };

    return (
        <div className="registerBackground"> 
            <div className="registerCard"> 
                <h2 className="registerHeader">ลงทะเบียนบัญชีใหม่</h2>
                <form onSubmit={handleSubmit} className="registerForm">
                    
                    <input 
                        type="text" 
                        name="fullname" 
                        placeholder="ชื่อ-นามสกุล (บังคับ)" 
                        onChange={handleChange} 
                        required 
                        className="registerInput" 
                    />
                    
                    <input 
                        type="email" 
                        name="email" 
                        placeholder="Email (บังคับ)" 
                        onChange={handleChange} 
                        required 
                        className="registerInput" 
                    />
                    
                    <input 
                        type="password" 
                        name="password" 
                        placeholder="Password (บังคับ)" 
                        onChange={handleChange} 
                        required 
                        className="registerInput" 
                    />
                    
                    <select 
                        name="role_id" 
                        value={formData.role_id} 
                        onChange={handleChange}
                        className="registerSelect" 
                        required
                    >
                        <option value="">-- กรุณาเลือกตำแหน่ง --</option>
                        <option value="R-ENG">Engineer</option>
                        <option value="R-ADM">Admin</option>
                        <option value="R-MGR">Manager</option>
                    </select>
                    
                    <input 
                        type="text" 
                        name="phone_number" 
                        placeholder="เบอร์โทร (ไม่บังคับ)" 
                        onChange={handleChange} 
                        className="registerInput" 
                    />
                    
                    
                    <button type="submit" className="registerButton">ลงทะเบียน</button> 
                </form>

                {error && <p className="registerError">{error}</p>}
                {success && <p className="registerSuccess">{success}</p>}
                
                <div className="loginLinkContainer"> 
                    <p>
                        มีบัญชีอยู่แล้ว? 
                        <Link to="/login" className="loginLink"> เข้าสู่ระบบที่นี่</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default RegisterPage;