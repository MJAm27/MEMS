import React, { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { useNavigate, Routes, Route } from "react-router-dom"; 
import axios from "axios";
import {
    FaBars, FaHome, FaSearch, FaHistory, FaSignOutAlt,
    FaBoxOpen, FaReply, FaHandHolding, FaUserEdit, FaCheckCircle,
    FaExclamationTriangle // เพิ่มตัวนี้กลับเข้าไปครับ
} from "react-icons/fa";
import "./EngineerMainPage.css";

// Import Pages
import ProfileENG from './ProfileENG';
import ProfileEditENG from './ProfileEditENG';
import ReturnPartPage from './ReturnPartPage';
import WithdrawPage from './WithdrawPage';
import HistoryPage from "./HistoryPage";
import BorrowPage from "./BorrowPage";

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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
            ...prev,
            [borrowId]: { ...prev[borrowId], [field]: value }
        }));
    };

    const handleConfirmUsage = async (item) => {
        const input = finalizeData[item.borrow_id];
        if (!input?.machineSN) return alert("กรุณากรอกเลขครุภัณฑ์ที่นำอะไหล่ไปใช้");

        const usedQty = parseInt(input.usedQty || item.borrow_qty);
        if (usedQty > item.borrow_qty) return alert(`จำนวนที่ใช้จริง ห้ามเกินจำนวนที่เบิกไป`);

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE}/api/borrow/finalize`, {
                transactionId: item.borrow_id,
                machineSN: input.machineSN,
                usedQty: usedQty,
                totalBorrowed: item.borrow_qty,
                lotId: item.lot_id
            }, { headers: { Authorization: `Bearer ${token}` } });

            alert("บันทึกการใช้งานเรียบร้อยแล้ว");
            fetchPendingBorrows(); 
        } catch (err) {
            alert("เกิดข้อผิดพลาด: " + (err.response?.data?.error || err.message));
        }
    };

    const localHandleLogout = () => {
        localStorage.removeItem("token");
        handleLogout();
    };

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    // เพิ่มฟังก์ชันสำหรับจัดการ Action แยกประเภท
    const handleProcessBorrow = async (item, actionType) => {
        const input = finalizeData[item.borrow_id];
        const qtyInput = parseInt(input?.usedQty || 0);

        try {
            const token = localStorage.getItem('token');
            if (actionType === 'USE') {
                if (!input?.machineSN || qtyInput <= 0) return alert("กรุณากรอกเลขครุภัณฑ์และจำนวน");
                // เรียก API ตัดยอดบางส่วน
                await axios.post(`${API_BASE}/api/borrow/finalize-partial`, {
                    transactionId: item.borrow_id,
                    machineSN: input.machineSN,
                    usedQty: qtyInput,
                    lotId: item.lot_id
                }, { headers: { Authorization: `Bearer ${token}` } });
                } else {
                    // --- กรณี: คืนคลังทั้งหมด ---
                    if (!window.confirm(`ยืนยันการคืนอะไหล่จำนวน ${item.borrow_qty} ชิ้น เข้าสู่คลัง?`)) return;

                    await axios.post(`${API_BASE}/api/borrow/return-all`, {
                        transactionId: item.borrow_id,
                        lotId: item.lot_id,
                        equipmentId: item.equipment_id, // เพิ่มเพื่อให้บันทึกลงประวัติได้ถูกต้อง
                        qtyToReturn: item.borrow_qty
                    }, { headers: { Authorization: `Bearer ${token}` } });
                }

                // ส่วนที่เพิ่มล้างค่าในช่อง input
                setFinalizeData(prev => {
                    const newData = { ...prev };
                    delete newData[item.borrow_id]; // ลบข้อมูลของ ID นี้ทิ้งไป
                    return newData;
                });
            alert("ดำเนินการสำเร็จ");
            fetchPendingBorrows(); // โหลดรายการที่เหลือใหม่
        } catch (err) { alert("เกิดข้อผิดพลาด"); }
    };

    // ปรับปรุง UI ส่วนรายการค้างจ่าย
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
                    {pendingItems.map(item => (
                        <div key={item.borrow_id} className="pending-card">
                            <div className="pending-info">
                                <strong>{item.equipment_name}</strong>
                                <p style={{ margin: '5px 0', fontSize: '0.9rem' }}>
                                    คงเหลือในมือ: <b className="text-pink" style={{ color: 'var(--primary-color)', fontSize: '1.2rem' }}>{item.borrow_qty}</b> ชิ้น
                                </p>
                                <small className="text-muted">วันที่เบิก: {new Date(item.borrow_date).toLocaleDateString('th-TH')}</small>
                            </div>

                            <div className="finalize-form">
                                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>ระบุเลขครุภัณฑ์:</label>
                                <input 
                                    type="text" 
                                    placeholder="เช่น C-001..."
                                    value={finalizeData[item.borrow_id]?.machineSN || ''} 
                                    onChange={(e) => handleInputChange(item.borrow_id, 'machineSN', e.target.value)}
                                />
                                
                                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>จำนวนที่ใช้จริง:</label>
                                <div className="action-row">
                                    <input 
                                        type="number" 
                                        placeholder="จำนวน..."
                                        min="1"
                                        max={item.borrow_qty}
                                        value={finalizeData[item.borrow_id]?.usedQty || ''}
                                        onChange={(e) => handleInputChange(item.borrow_id, 'usedQty', e.target.value)}
                                    />
                                    <button className="btn-use-part" onClick={() => handleProcessBorrow(item, 'USE')}>
                                        <FaCheckCircle /> บันทึกการใช้
                                    </button>
                                </div>

                                <button className="btn-return-part" onClick={() => handleProcessBorrow(item, 'RETURN')} style={{ marginTop: '5px', width: '100%' }}>
                                    <FaReply /> คืนคลังทั้งหมด ({item.borrow_qty} ชิ้น)
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
    // --- 2. ส่วนของ HomeContent ที่เรียกใช้ UI ผ่านปีกกา { } ---
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
                <div className="sidebar-header"><div className="brand"><h2>MEMS</h2></div></div>
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
                                <img src={`${API_BASE}/profile-img/${user.profile_img}`} alt="Profile" className="profile-img-circle" />
                            ) : (
                                user.fullname?.charAt(0).toUpperCase()
                            )}
                        </div>
                    </div>
                </header>

                <div className="content-body">
                    <Routes>
                        <Route index element={HomeContent} />
                        <Route path="engineer/home" element={HomeContent} />
                        <Route path="engineer/withdraw" element={<WithdrawPage user={user} />} />
                        <Route path="engineer/return" element={<ReturnPartPage user={user} />} />
                        <Route path="engineer/history" element={<HistoryPage user={user} />} />
                        <Route path="engineer/borrow" element={<BorrowPage user={user} />} />
                        <Route path="engineer/profile" element={<ProfileENG user={user} handleLogout={handleLogout} refreshUser={refreshUser} />}>
                            <Route path="edit" element={<ProfileEditENG user={user} refreshUser={refreshUser} />} />
                        </Route>
                        <Route path="engineer/search" element={<h2>หน้าค้นหาอะไหล่</h2>} />
                        <Route path="*" element={<h2>ไม่พบหน้าที่คุณต้องการ</h2>} />
                    </Routes>
                </div>
            </main>
        </div>
    );
}

export default EngineerMainPage;