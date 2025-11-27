// ที่ไฟล์ MEMS/client/src/components/RegisterPage.js

import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

function RegisterPage() {
    const [formData, setFormData] = useState({
        fullname: '',
        email: '',
        password: '',
        position: '', // ค่าเริ่มต้นจะเป็น '' (ซึ่งจะตรงกับ "กรุณาเลือกตำแหน่ง")
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
            setError('กรุณากรอก Email, Password, Fullname, Role');
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
        <div>
            <h2>Register New Account</h2>
            <form onSubmit={handleSubmit}>
                <input type="text" name="fullname" placeholder="ชื่อ-นามสกุล (บังคับ)" onChange={handleChange} required />
                <input type="email" name="email" placeholder="Email (บังคับ)" onChange={handleChange} required />
                <input type="password" name="password" placeholder="Password (บังคับ)" onChange={handleChange} required />
                
                {/* --- นี่คือส่วนที่แก้ไข --- */}
                <select 
                    name="role_id" 
                    value={formData.role_id} 
                    onChange={handleChange}
                >
                    <option value="">-- กรุณาเลือกตำแหน่ง --</option>
                    <option value="R-ENG">Engineer</option>
                    <option value="R-ADM">Admin</option> {/* <-- แก้ไข value ให้ตรงกับชื่อ */}
                    <option value="R-MGR">Manager</option>
                </select>
                {/* --- จบส่วนที่แก้ไข --- */}

                <input type="text" name="phone_number" placeholder="เบอร์โทร (ไม่บังคับ)" onChange={handleChange} />
                
                <button type="submit">Register</button>
            </form>

            {error && <p style={{ color: 'red' }}>{error}</p>}
            {success && <p style={{ color: 'green' }}>{success}</p>}
            
            <hr />

            <p>
                มีบัญชีอยู่แล้ว? 
                <Link to="/login"> เข้าสู่ระบบที่นี่</Link>
            </p>
        </div>
    );
}

export default RegisterPage;