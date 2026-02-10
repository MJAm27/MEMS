import React, { useState, useLayoutEffect, useCallback, useEffect } from "react";
import { useNavigate, Routes, Route } from "react-router-dom"; 
import axios from "axios";
import {
    FaBars, FaHome, FaSearch, FaHistory, FaSignOutAlt,
    FaBoxOpen, FaReply, FaHandHolding, FaUserEdit, FaCheckCircle,
    FaExclamationTriangle 
} from "react-icons/fa";
import "./EngineerMainPage.css";

// Import Pages
import ProfileENG from './ProfileENG';
import ProfileEditENG from './ProfileEditENG';
import ReturnPartPage from './ReturnPartPage';
import WithdrawPage from './WithdrawPage';
import HistoryPage from "./HistoryPage";
import BorrowPage from "./BorrowPage";
import ChangePasswordENG from './ChangePasswordENG';
import SearchPartPageENG from './SearchPartPageENG';
const API_BASE = process.env.REACT_APP_API_URL;
function EngineerMainPage({ user, handleLogout, refreshUser }) {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [pendingItems, setPendingItems] = useState([]); 
    const [finalizeData, setFinalizeData] = useState({}); 

    useLayoutEffect(() => {
        const handleResize = () => setSidebarOpen(window.innerWidth > 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchPendingBorrows = useCallback(async () => {
        if (!user?.user_id) return;
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE}/api/borrow/pending/${user.user_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPendingItems(res.data);
        } catch (err) {
            console.error("Fetch pending error:", err);
        }
    }, [user?.user_id]);

    useEffect(() => {
        fetchPendingBorrows();
    }, [fetchPendingBorrows]);

    const handleInputChange = (borrowId, field, value) => {
        setFinalizeData(prev => ({
            ...prev, // เก็บค่าของรายการอื่นไว้
            [borrowId]: { 
                ...(prev[borrowId] || {}), // เก็บค่า field อื่นของรายการนี้ไว้ (เช่น พิมพ์ SN อยู่ แต่ usedQty มีค่าอยู่แล้ว)
                [field]: value      // อัปเดตเฉพาะ field ที่พิมพ์
            }
        }));
    };

    const localHandleLogout = () => {
        if (window.confirm("ต้องการออกจากระบบใช่หรือไม่?")) {
            localStorage.removeItem("token");
            handleLogout();
        }
    };

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const handleProcessBorrow = async (item, actionType, uniqueKey) => {
        // 1. ดึงข้อมูลจาก State โดยใช้ uniqueKey เพื่อให้ได้ข้อมูลของช่อง Input นั้นๆ อย่างถูกต้อง
        const input = finalizeData[uniqueKey] || {}; 
        const snInput = input.machineSN ? input.machineSN.trim() : "";
        const qtyInput = parseInt(input.usedQty || 0);

        try {
            const token = localStorage.getItem('token');
            
            if (actionType === 'USE') {
                // --- กรณี: บันทึกการใช้งานจริง ---
                // ตรวจสอบความถูกต้องของข้อมูลก่อนส่ง
                if (!snInput || qtyInput <= 0) {
                    return alert("กรุณากรอกเลขครุภัณฑ์และจำนวนที่ใช้จริงให้ถูกต้อง");
                }
                if (qtyInput > item.borrow_qty) {
                    return alert(`จำนวนที่ใช้จริง (${qtyInput}) ห้ามเกินจำนวนที่มีอยู่ในมือ (${item.borrow_qty})`);
                }

                // ส่งข้อมูลไป API เพื่อบันทึกประวัติการใช้และตัดยอดในมือ
                await axios.post(`${API_BASE}/api/borrow/finalize-partial`, {
                    transactionId: item.borrow_id,  // ID ใบเบิกหลัก
                    equipmentId: item.equipment_id, // ระบุชนิดอะไหล่
                    machineSN: snInput,             // เลขครุภัณฑ์ที่นำไปใช้
                    usedQty: qtyInput,              // จำนวนที่ใช้จริง
                    lotId: item.lot_id              // รหัส Lot ของอะไหล่
                }, { headers: { Authorization: `Bearer ${token}` } });

            } else {
                // --- กรณี: คืนคลังทั้งหมด (เฉพาะรายการนี้) ---
                if (!window.confirm(`ยืนยันการคืนอะไหล่ ${item.equipment_name} จำนวน ${item.borrow_qty} ชิ้น เข้าสู่คลัง?`)) {
                    return;
                }

                // ส่งข้อมูลไป API เพื่อบันทึกประวัติการคืนและล้างยอดในมือเฉพาะรายการนี้
                await axios.post(`${API_BASE}/api/borrow/return-all`, {
                    transactionId: item.borrow_id,
                    equipmentId: item.equipment_id,
                    lotId: item.lot_id,
                    qtyToReturn: item.borrow_qty
                }, { headers: { Authorization: `Bearer ${token}` } });
            }

            // 2. ล้างข้อมูลในช่อง Input เฉพาะของ uniqueKey นี้ออกจาก State หลังจากสำเร็จ
            setFinalizeData(prev => {
                const newData = { ...prev };
                delete newData[uniqueKey];
                return newData;
            });

            alert("ดำเนินการสำเร็จและบันทึกประวัติเรียบร้อยแล้ว");
            
            // 3. รีเฟรชรายการค้างสรุปใหม่จาก Server เพื่ออัปเดตยอดคงเหลือล่าสุดบนหน้าจอ
            fetchPendingBorrows(); 
            
        } catch (err) { 
            // แสดง Error จาก Backend (เช่น เลขครุภัณฑ์ไม่มีอยู่จริง หรือปัญหา Database)
            alert("เกิดข้อผิดพลาด: " + (err.response?.data?.error || err.message)); 
        }
    };

    const pendingBorrowListUI = (
        <div className="pending-container fade-in">
            <div className="section-title">
                <FaExclamationTriangle className="warn-icon" />
                <h3>รายการยืมล่วงหน้าที่รอการสรุป</h3>
            </div>
            
            {pendingItems.length === 0 ? (
                <div className="empty-pending-card" style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '16px', color: '#999' }}>
                    ไม่มีรายการอะไหล่ค้างจ่าย
                </div>
            ) : (
                <div className="pending-grid">
                {pendingItems.map((item, index) => {
                    // สร้าง Unique ID สำหรับใช้งานภายใน UI (กันเหนียวกรณี borrow_id ซ้ำ)
                    const uniqueKey = `${item.borrow_id}-${index}`;
                    
                    return (
                        <div key={uniqueKey} className="pending-card">
                            <div className="pending-info">
                                <strong>{item.equipment_name}</strong>
                                <p>คงเหลือในมือ: <b style={{ color: '#e91e63' }}>{item.borrow_qty}</b> ชิ้น</p>
                                <small>วันที่เบิก: {new Date(item.borrow_date).toLocaleDateString('th-TH')}</small>
                            </div>

                            <div className="finalize-form">
                                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>ระบุเลขครุภัณฑ์:</label>
                                <input 
                                    type="text" 
                                    placeholder="เช่น C-001..."
                                    // ใช้ uniqueKey เป็นที่เก็บข้อมูล เพื่อให้แยกกล่องกันแน่นอน 100%
                                    value={finalizeData[uniqueKey]?.machineSN || ''} 
                                    onChange={(e) => handleInputChange(uniqueKey, 'machineSN', e.target.value)}
                                />
                                
                                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>จำนวนที่ใช้จริง:</label>
                                <div className="action-row">
                                    <input 
                                        type="number" 
                                        placeholder="จำนวน..."
                                        min="1"
                                        max={item.borrow_qty}
                                        value={finalizeData[uniqueKey]?.usedQty || ''}
                                        onChange={(e) => handleInputChange(uniqueKey, 'usedQty', e.target.value)}
                                    />
                                    <button className="btn-use-part" onClick={() => handleProcessBorrow(item, 'USE', uniqueKey)}>
                                        <FaCheckCircle /> บันทึกการใช้
                                    </button>
                                </div>

                                <button 
                                    className="btn-return-part" 
                                    onClick={() => handleProcessBorrow(item, 'RETURN', uniqueKey)} 
                                    style={{ marginTop: '5px', width: '100%' }}
                                >
                                    <FaReply /> คืนคลังทั้งหมด ({item.borrow_qty} ชิ้น)
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            )}
        </div>
    );

    const HomeContent = (
        <div className="engineer-home-wrapper">
            <div className="welcome-banner fade-in">
                <h1>หน้าหลักวิศวกร</h1>
                <p>เลือกเมนูเพื่อดำเนินการจัดการอะไหล่</p>
            </div>

            <div className="main-actions-container">
                <button className="action-button secondary-action" onClick={() => navigate("/dashboard/engineer/withdraw")}>
                    <FaBoxOpen className="action-icon" /> <span>เบิกอะไหล่</span>
                </button>
                
                <button className="action-button secondary-action" onClick={() => navigate("/dashboard/engineer/return")}>
                    <FaReply className="action-icon" /> <span>คืนอะไหล่</span>
                </button>
                
                <button className="action-button secondary-action" onClick={() => navigate("/dashboard/engineer/borrow")}>
                    <FaHandHolding className="action-icon" /> <span>เบิกอะไหล่ล่วงหน้า</span>
                </button>
            </div>

            {pendingBorrowListUI} 
        </div>
    );

    if (!user) return <div className="loading-screen"><div className="spinner"></div></div>;

    return (
        <div className={`layout-wrapper ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
            <aside className="sidebar-container" style={{ left: sidebarOpen ? 0 : "-260px", transition: "0.3s" }}>
                <div className="sidebar-header"><div className="brand"><h2>MEMS ENGINEER</h2></div></div>
                <nav className="sidebar-nav">
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/home")}><FaHome /> <span>หน้าหลัก</span></button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/search")}><FaSearch /> <span>ค้นหาอะไหล่</span></button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/history")}><FaHistory /> <span>ประวัติการทำรายการ</span></button>
                    <button className="nav-link" onClick={() => navigate("/dashboard/engineer/profile")}><FaUserEdit /> <span>แก้ไขโปรไฟล์</span></button>
                    <div className="nav-divider"></div>
                    <button className="nav-link withdraw-link" onClick={() => navigate("/dashboard/engineer/withdraw")}><FaBoxOpen /> <span>เบิกอะไหล่</span></button>
                    <button className="nav-link return-link" onClick={() => navigate("/dashboard/engineer/return")}><FaReply /> <span>คืนอะไหล่</span></button>
                    <button className="nav-link borrow-link" onClick={() => navigate("/dashboard/engineer/borrow")}><FaHandHolding /> <span>เบิกอะไหล่ล่วงหน้า</span></button>
                </nav>
                <button className="logout-btn-sidebar" onClick={localHandleLogout}><FaSignOutAlt /> ออกจากระบบ</button>
            </aside>

            <main className="main-content-wrapper" style={{ marginLeft: sidebarOpen && window.innerWidth > 768 ? "260px" : "0" }}>
                <header className="top-navbar">
                    <button className="sidebar-toggle-btn" onClick={toggleSidebar}><FaBars /></button>
                    <div className="user-profile-nav">
                        <span className="user-name">{user?.fullname}</span>
                        <div className="avatar-circle">
                            {user?.profile_img ? (
                                <img 
                                    src={`${API_BASE}/profile-img/${user.profile_img}`} 
                                    alt="Profile" 
                                    className="profile-img-circle" 
                                />
                            ) : (
                                user.fullname?.charAt(0).toUpperCase()
                            )}
                        </div>
                    </div>
                </header>

                <div className="content-body">
                    <Routes>
                        {/* หน้าแรกเมื่อเข้ามาที่ /dashboard/engineer */}
                        <Route index element={HomeContent} />
                        
                        {/* ระบุ path เต็มเพื่อให้ตรงกับ URL ใน Browser */}
                        <Route path="engineer/home" element={HomeContent} />
                        <Route path="engineer/withdraw" element={<WithdrawPage user={user} />} />
                        <Route path="engineer/return" element={<ReturnPartPage user={user} />} />
                        <Route path="engineer/history" element={<HistoryPage user={user} />} />
                        <Route path="engineer/borrow" element={<BorrowPage user={user} />} />
                        
                        {/* Profile และ Sub-route สำหรับแก้ไข */}
                        <Route path="engineer/profile" element={<ProfileENG user={user} handleLogout={handleLogout} refreshUser={refreshUser} />}>
                            <Route path="edit" element={<ProfileEditENG user={user} refreshUser={refreshUser} />} />
                            <Route path="change-passwordENG" element={<ChangePasswordENG />} />
                        </Route>
                        
                        <Route path="engineer/search" element={< SearchPartPageENG/>} />
                        
                        {/* กรณีไม่พบหน้า */}
                        <Route path="*" element={<h2>ไม่พบหน้าที่คุณต้องการ</h2>} />
                    </Routes>
                </div>
            </main>
        </div>
    );
}

export default EngineerMainPage;