import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
    FaUserCircle, FaSave, FaCamera
} from "react-icons/fa";
import "./ProfileENG.css"; 
import "./ProfileEditENG.css"; 

const API_BASE = process.env.REACT_APP_API_URL;
function ProfileEditENG({ user, refreshUser }) { 
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [initialLoad, setInitialLoad] = useState(true); 

    const [formData, setFormData] = useState({
        fullname: '',
        email: '',
        phone_number: '',
        position: '',
        profile_img: '' // สำหรับเก็บชื่อไฟล์รูปภาพจากเซิร์ฟเวอร์
    });

    useEffect(() => {
        if (user) {
            setFormData({
                fullname: user.fullname || '',
                email: user.email || '',
                phone_number: user.phone_number || '', 
                position: user.position || user.role || '',
                profile_img: user.profile_img || ''
            });
            
            // ถ้าผู้ใช้มีรูปเดิมในระบบ ให้แสดงผล
            if (user.profile_img) {
                setPreviewUrl(`${API_BASE}/profile-img/${user.profile_img}`);
            }
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

    // ฟังก์ชันจัดการการเปลี่ยนรูปภาพ
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // 1. สร้างภาพตัวอย่างให้ User เห็นทันที
        setPreviewUrl(URL.createObjectURL(file));
        
        // 2. ส่งไฟล์ไปยัง Server เพื่ออัปโหลด
        const uploadData = new FormData();
        uploadData.append('image', file);

        setUploading(true);
        try {
            const res = await fetch(`${API_BASE}/api/upload`, {
                method: 'POST',
                body: uploadData
            });
            const data = await res.json();
            
            // 3. บันทึกชื่อไฟล์ที่ได้จาก Server ลงใน State
            setFormData(prev => ({ ...prev, profile_img: data.filename }));
        } catch (err) {
            alert("อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const token = localStorage.getItem('token'); 

        try {
            const response = await fetch(`${API_BASE}/api/profile-edit`, { 
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
            if (refreshUser) refreshUser(); 
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
                    
                    <h2>แก้ไขข้อมูลส่วนตัว</h2>
                </div>

                {/* ส่วนจัดการรูปโปรไฟล์ */}
                <div className="edit-avatar-section">
                    <div className="avatar-upload-wrapper">
                        {previewUrl ? (
                            <img src={previewUrl} alt="Profile" className="avatar-preview-img" />
                        ) : (
                            <FaUserCircle className="avatar-icon" />
                        )}
                        <label htmlFor="file-input" className="camera-badge">
                            <FaCamera />
                        </label>
                        <input 
                            id="file-input" 
                            type="file" 
                            accept="image/*" 
                            onChange={handleFileChange} 
                            style={{ display: 'none' }}
                        />
                    </div>
                    <p className="avatar-hint">
                        {uploading ? 'กำลังอัปโหลด...' : 'คลิกไอคอนกล้องเพื่อเปลี่ยนรูปโปรไฟล์'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="edit-form-grid">
                    <div className="form-group full-width">
                        <label>รหัสพนักงาน (แก้ไขไม่ได้)</label>
                        <input 
                            type="text" 
                            value={user?.user_id || 'N/A'} 
                            readOnly 
                            className="input-readonly" 
                            style={{ backgroundColor: '#f5f5f5', color: '#888', cursor: 'not-allowed' }}
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
                        <button type="submit" className="btn-save" disabled={loading || uploading}>
                            <FaSave /> {loading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ProfileEditENG;