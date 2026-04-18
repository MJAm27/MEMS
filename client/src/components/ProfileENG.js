import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom"; 
import { 
    FaUserCircle, FaChevronRight, FaKey, FaEdit 
} from "react-icons/fa"; 
import "./ProfileENG.css"; 

function ProfileENG({ user }) { 
    const location = useLocation(); 
    
    if (!user) {
          return <div className="loading-text">กำลังโหลดข้อมูลโปรไฟล์...</div>;
    }

    const API_URL = process.env.REACT_APP_API_URL ;
    const displayUserId = user.user_id ?? "N/A";
    const displayFullname = user.fullname ;
    const displayRole = user.role_name || user.role;

    const isSubPage = location.pathname.includes("edit") || location.pathname.includes("change-password");

    return (
        <>
            {isSubPage ? (
                <Outlet />
            ) : (
                <div className="profile-center-container fade-in">
                    <div className="profile-card-detailed">
                        <div className="profile-header-bg"></div>
                        
                        <div className="profile-avatar-section">
                            {user.profile_img ? (
                                <img 
                                    src={`${API_URL}/profile-img/${user.profile_img}`} 
                                    alt="Profile" 
                                    className="profile-img-large" 
                                />
                            ) : (
                                <FaUserCircle className="profile-icon-placeholder" style={{width:"100px" ,height:"100px", marginTop:"10px"}} />
                            )}
                            <h2 className="profile-name">{displayFullname}</h2>
                            <span className="profile-badge">{displayRole}</span>
                            <p className="detail-text">รหัสพนักงาน: <strong>{displayUserId}</strong></p>
                        </div>

                        <div className="profile-actions-list">
                            <Link to="edit" className="action-item"> 
                                <div className="action-icon-box pink"><FaEdit /></div>
                                <div className="action-text">
                                    <span>แก้ไขข้อมูลส่วนตัว</span>
                                    <small>ปรับปรุงชื่อ หรือข้อมูลติดต่อ</small>
                                </div>
                                <FaChevronRight className="arrow-icon" />
                            </Link>

                            <Link to="change-passwordENG" className="action-item">
                                <div className="action-icon-box purple"><FaKey /></div>
                                <div className="action-text">
                                    <span>เปลี่ยนรหัสผ่าน</span>
                                    <small>เพื่อความปลอดภัยของบัญชี</small>
                                </div>
                                <FaChevronRight className="arrow-icon" />
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ProfileENG;