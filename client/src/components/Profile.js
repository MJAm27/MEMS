import React, { useState, useEffect } from "react";
import { useNavigate} from "react-router-dom";
import { 
    FaUserCircle, FaSave, FaArrowLeft 
} from "react-icons/fa";
import "./ProfileENG.css"; 
import "./ProfileEditENG.css"; 

function ProfileEditENG({ user, handleLogout, refreshUser }) { 
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true); 

    const [formData, setFormData] = useState({
        fullname: '',
        email: '',
        phone_number: '',
        position: ''
    });

    useEffect(() => {
        if (user) {
            setFormData({
                fullname: user.fullname || '',
                email: user.email || '',
                phone_number: user.phone_number || '', 
                position: user.position || user.role || '' 
            });
        }
        setInitialLoad(false);
    }, [user]);

    const handleBack = () => {
        navigate('/dashboard/engineer/profile'); 
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const token = localStorage.getItem('token'); 

        try {
            const response = await fetch('/api/profile-edit', { 
                method: 'PUT', 
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData) 
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update profile');
            }

            alert("บันทึกข้อมูลสำเร็จ!");
            
            if (refreshUser) {
                refreshUser(); 
            }
            
            navigate('/dashboard/engineer/profile'); 

        } catch (err) {
            alert("เกิดข้อผิดพลาด: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (initialLoad) return <div className="loading-container"><div className="spinner"></div><p>กำลังโหลด...</p></div>;
    
    return (
        <div className="profile-center-container fade-in">
            <div className="edit-card-container">
                <div className="edit-header">
                    <button onClick={handleBack} className="action-item btn-back"> 
                        <FaArrowLeft /> ย้อนกลับ
                    </button>
                    <h2>แก้ไขข้อมูลส่วนตัว</h2>
                </div>

                <div className="edit-avatar-section">
                    <div className="avatar-wrapper">
                        <FaUserCircle className="avatar-icon" />
                    </div>
                    <p className="avatar-hint">รูปโปรไฟล์จะแสดงตามระบบ</p>
                </div>

                <form onSubmit={handleSubmit} className="edit-form-grid">
                    <div className="form-group full-width">
                        <label>รหัสพนักงาน (แก้ไขไม่ได้)</label>
                        <input 
                            type="text" 
                            name="user_id" 
                            value={user?.userId || 'N/A'} 
                            readOnly 
                            className="input-readonly" 
                        />
                    </div>

                    <div className="form-group">
                        <label>ชื่อ - นามสกุล</label>
                        <input 
                            type="text" 
                            name="fullname" 
                            value={formData.fullname} 
                            onChange={handleChange} 
                            required 
                        />
                    </div>

                    <div className="form-group">
                        <label>ตำแหน่ง</label>
                        <input 
                            type="text" 
                            name="position" 
                            value={formData.position} 
                            onChange={handleChange} 
                        />
                    </div>

                    <div className="form-group">
                        <label>อีเมล</label>
                        <input 
                            type="email" 
                            name="email" 
                            value={formData.email} 
                            onChange={handleChange} 
                            required 
                        />
                    </div>

                    <div className="form-group">
                        <label>เบอร์โทรศัพท์</label>
                        <input 
                            type="tel" 
                            name="phone_number" 
                            value={formData.phone_number} 
                            onChange={handleChange} 
                        />
                    </div>

                    <div className="form-actions">
                        <button type="button" onClick={handleBack} className="btn-cancel">
                            ยกเลิก
                        </button>
                        <button type="submit" className="btn-save" disabled={loading}>
                            <FaSave /> {loading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ProfileEditENG;