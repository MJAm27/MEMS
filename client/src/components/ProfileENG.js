import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom"; // ลบ useNavigate ออกเพราะไม่ได้ใช้แล้ว
import { 
    FaUserCircle, FaChevronRight, FaKey, FaEdit 
} from "react-icons/fa"; 
import "./ProfileENG.css"; 

function ProfileENG({ user }) { 
    const location = useLocation(); 
    const userData = user; 
    
    if (!userData) {
          return <div className="loading-text">กำลังโหลดข้อมูลโปรไฟล์...</div>;
    }

    const displayUserId = user?.user_id ?? "N/A";
    const displayFullname = userData.fullname || "ผู้ใช้งาน";
    const displayRole = userData.role || "R-ENG";

    const isSubPage = location.pathname.includes("edit") || location.pathname.includes("change-password");

    return (
        <>
            <Outlet />
            
            {!isSubPage && (
                <div className="profile-center-container fade-in">
                    <div className="profile-card-detailed">
                        <div className="profile-header-bg"></div>
                        <div className="profile-avatar-large">
                            {user?.profile_img ? (
                                <img 
                                    src={`${process.env.REACT_APP_API_URL}/profile-img/${user.profile_img}`} 
                                    alt="Profile" 
                                    className="img-fluid rounded-circle"
                                    style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                                />
                            ) : (
                                <FaUserCircle />
                            )}
                        </div>
                        
                        <div className="profile-details">
                            <h2>{displayFullname}</h2>
                            <p className="detail-badge">{displayRole}</p>
                            <p className="detail-text">ID: <strong>{displayUserId}</strong></p>
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

                            <Link to="change-password" className="action-item">
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