import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaLock,  FaEye, FaEyeSlash } from "react-icons/fa";
import "./ChangePasswordENG.css"; // ใช้สไตล์เดียวกันเพื่อความสวยงาม

const API_BASE = process.env.REACT_APP_API_URL;

function ChangePassword() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState({ old: false, new: false, confirm: false });
    
    const [formData, setFormData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleView = (field) => {
        setShowPass(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // ตรวจสอบความถูกต้องเบื้องต้น
        if (formData.newPassword !== formData.confirmPassword) {
            return alert("รหัสผ่านใหม่ไม่ตรงกัน");
        }
        if (formData.newPassword.length < 6) {
            return alert("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
        }

        setLoading(true);
        const token = localStorage.getItem('token');

        try {
            const response = await fetch(`${API_BASE}/api/change-passwordENG`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    oldPassword: formData.oldPassword,
                    newPassword: formData.newPassword
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
            }

            alert("เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
            // หลังจากเปลี่ยนรหัสผ่าน แนะนำให้ Logout เพื่อความปลอดภัย
            localStorage.removeItem('token');
            navigate('/login');

        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="profile-center-container fade-in">
            <div className="edit-card-container">
                <div className="edit-header">
                    
                    <h2>เปลี่ยนรหัสผ่าน</h2>
                </div>

                <div className="password-warning-box">
                    <FaLock />
                    <span>รหัสผ่านใหม่ควรประกอบด้วยตัวอักษรและตัวเลขเพื่อความปลอดภัย</span>
                </div>

                <form onSubmit={handleSubmit} className="edit-form-grid">
                    {/* รหัสผ่านเดิม */}
                    <div className="form-group full-width">
                        <label>รหัสผ่านปัจจุบัน</label>
                        <div className="password-input-wrapper">
                            <input 
                                type={showPass.old ? "text" : "password"}
                                name="oldPassword"
                                value={formData.oldPassword}
                                onChange={handleChange}
                                required
                                placeholder="กรอกรหัสผ่านปัจจุบัน"
                            />
                            <button type="button" onClick={() => toggleView('old')} className="view-toggle">
                                {showPass.old ? <FaEyeSlash /> : <FaEye />}
                            </button>
                        </div>
                    </div>

                    {/* รหัสผ่านใหม่ */}
                    <div className="form-group">
                        <label>รหัสผ่านใหม่</label>
                        <div className="password-input-wrapper">
                            <input 
                                type={showPass.new ? "text" : "password"}
                                name="newPassword"
                                value={formData.newPassword}
                                onChange={handleChange}
                                required
                                placeholder="อย่างน้อย 6 ตัวอักษร"
                            />
                            <button type="button" onClick={() => toggleView('new')} className="view-toggle">
                                {showPass.new ? <FaEyeSlash /> : <FaEye />}
                            </button>
                        </div>
                    </div>

                    {/* ยืนยันรหัสผ่านใหม่ */}
                    <div className="form-group">
                        <label>ยืนยันรหัสผ่านใหม่</label>
                        <div className="password-input-wrapper">
                            <input 
                                type={showPass.confirm ? "text" : "password"}
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                            />
                            <button type="button" onClick={() => toggleView('confirm')} className="view-toggle">
                                {showPass.confirm ? <FaEyeSlash /> : <FaEye />}
                            </button>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" onClick={() => navigate(-1)} className="btn-cancel">
                            ยกเลิก
                        </button>
                        <button type="submit" className="btn-save" disabled={loading}>
                            {loading ? 'กำลังบันทึก...' : 'อัปเดตรหัสผ่าน'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ChangePassword;