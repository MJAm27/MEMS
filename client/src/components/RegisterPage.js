import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import './RegisterPage.css';

// *** แก้ไข: Hardcode Base URL ของ Backend ที่รันอยู่พอร์ต 3001 ***
const API_BASE_URL = "http://localhost:3001";
// ******************************************************************

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

        // ตรวจสอบข้อมูลที่จำเป็น
        if (!formData.email || !formData.password || !formData.fullname || !formData.role_id) {
            setError('กรุณากรอก Email, Password, Fullname, และเลือก Role');
            return;
        }

        try {
            // *** แก้ไข: ใช้ API_BASE_URL ที่ถูกกำหนดแล้ว ***
            const response = await axios.post(`${API_BASE_URL}/api/register`, formData);
            setSuccess(response.data.message);

            // หน่วงเวลา 2 วินาที ก่อนนำทางไปหน้า Login
            setTimeout(() => {
                navigate('/login');
            }, 2000);

        } catch (err) {
            setError(err.response?.data?.message || 'การลงทะเบียนล้มเหลว');
        }
    };

    return (
        <div className="registerBackground"> {/* ใช้ class จาก CSS */}
            <div className="registerCard"> {/* ใช้ class จาก CSS */}
                <h2 className="registerHeader">ลงทะเบียนบัญชีใหม่</h2>
                <form onSubmit={handleSubmit} className="registerForm"> {/* ใช้ class จาก CSS */}
                    
                    {/* Fullname */}
                    <input 
                        type="text" 
                        name="fullname" 
                        placeholder="ชื่อ-นามสกุล (บังคับ)" 
                        onChange={handleChange} 
                        required 
                        className="registerInput" // ใช้ class จาก CSS
                    />
                    
                    {/* Email */}
                    <input 
                        type="email" 
                        name="email" 
                        placeholder="Email (บังคับ)" 
                        onChange={handleChange} 
                        required 
                        className="registerInput" // ใช้ class จาก CSS
                    />
                    
                    {/* Password */}
                    <input 
                        type="password" 
                        name="password" 
                        placeholder="Password (บังคับ)" 
                        onChange={handleChange} 
                        required 
                        className="registerInput" // ใช้ class จาก CSS
                    />
                    
                    {/* Role Selection */}
                    <select 
                        name="role_id" 
                        value={formData.role_id} 
                        onChange={handleChange}
                        className="registerSelect" // ใช้ class จาก CSS
                        required // บังคับเลือก
                    >
                        <option value="">-- กรุณาเลือกตำแหน่ง --</option>
                        <option value="R-ENG">Engineer</option>
                        <option value="R-ADM">Admin</option>
                        <option value="R-MGR">Manager</option>
                    </select>
                    
                    {/* Phone Number */}
                    <input 
                        type="text" 
                        name="phone_number" 
                        placeholder="เบอร์โทร (ไม่บังคับ)" 
                        onChange={handleChange} 
                        className="registerInput" // ใช้ class จาก CSS
                    />
                    
                    {/* Position (ถูกลบออกตามโค้ดเดิมที่เหลือเพียง phone_number) */}
                    {/* หากต้องการใช้ Position ให้เพิ่ม <input type="text" name="position" .../> ที่นี่ */}
                    
                    <button type="submit" className="registerButton">ลงทะเบียน</button> {/* ใช้ class จาก CSS */}
                </form>

                {/* Messages */}
                {error && <p className="registerError">{error}</p>}
                {success && <p className="registerSuccess">{success}</p>}
                
                <div className="loginLinkContainer"> {/* ใช้ class จาก CSS */}
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