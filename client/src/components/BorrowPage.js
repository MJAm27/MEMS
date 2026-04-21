import React, { useState, useEffect, useCallback } from "react";
import { 
    FaCheckCircle, FaCamera, FaLockOpen, FaPlus, FaMinus, 
    FaTrash, FaLock, FaClipboardCheck, FaTimes, FaSearch
} from "react-icons/fa"; 
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from "axios";
import io from 'socket.io-client'; // นำมาใช้ใน useEffect ด้านล่าง
import './BorrowPage.css'; 

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const STORAGE_KEY = 'mems_borrow_session';

function BorrowPage({ user, setIsLocked }) {
    const activeUser = user || { fullname: 'ผู้ใช้งาน', user_id: null };
    const [currentStep, setCurrentStep] = useState(1); 
    const [borrowDate] = useState(() => {
        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000; 
        return (new Date(now - tzOffset)).toISOString().slice(0, 10);
    });
    const [borrowItems, setBorrowItems] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [manualPartId, setManualPartId] = useState('');
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [partSuggestions, setPartSuggestions] = useState([]);
    const [cabinetBusy, setCabinetBusy] = useState(false);
    const [busyBy, setBusyBy] = useState('');
    const [previewImage, setPreviewImage] = useState(null); // แก้ไข Error: previewImage is not defined

    // เพิ่มการเชื่อมต่อ Socket เพื่อเช็คสถานะตู้ (แก้ Warning: io, setCabinetBusy, setBusyBy not used)
    useEffect(() => {
        const socket = io(API_BASE);

        socket.on('cabinet_status', (state) => {
            const currentUserId = user?.user_id || user?.userId; 
            if (state.isBusy && state.userId !== currentUserId) {
                setCabinetBusy(true);
                setBusyBy(state.userName);
            } else {
                setCabinetBusy(false);
                setBusyBy('');
            }
        });

        return () => socket.disconnect();
    }, [user?.user_id, user?.userId]);

    // Persistence Logic
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            if (window.confirm("คุณมีรายการเบิกล่วงหน้าที่ค้างอยู่ ต้องการทำต่อหรือไม่?")) {
                setCurrentStep(data.currentStep);
                setBorrowItems(data.borrowItems);
                if (setIsLocked) setIsLocked(true);
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    }, [setIsLocked]);

    useEffect(() => {
        if (currentStep > 1 && currentStep < 5) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ currentStep, borrowItems }));
        }
    }, [currentStep, borrowItems]);

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (currentStep > 1 && currentStep < 5) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [currentStep]);

    const handleResetForm = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setCurrentStep(1);
        setBorrowItems([]);
        setManualPartId('');
        setError('');
        setIsScanning(false);
    }, []);

    const handleOpenDoor = async () => {
        setIsProcessing(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const checkRes = await axios.get(`${API_BASE}/api/device-check`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });

            if (checkRes.data.status === "online") {
                await axios.get(`${API_BASE}/api/open`, { 
                    headers: { Authorization: `Bearer ${token}` } 
                });
                setCurrentStep(2);
                if (setIsLocked) setIsLocked(true);
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'ตู้ไม่มีไฟเลี้ยง กรุณาตรวจสอบการเชื่อมต่อ';
            setError(msg);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCloseDoor = async () => {
        setIsProcessing(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE}/api/close-box`, {}, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            handleResetForm();
            if (setIsLocked) setIsLocked(false);
        } catch (err) {
            setError('คำสั่งปิดประตูขัดข้อง');
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePartSearch = async (val) => {
        setManualPartId(val);
        if (val.length > 0) {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_BASE}/api/search/parts?term=${val}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setPartSuggestions(res.data);
            } catch (err) { console.error(err); }
        } else {
            setPartSuggestions([]);
        }
    };

    const handleAddItem = useCallback(async (scannedId, quantity = 1) => {
        if (isProcessing) return;
        const idToSearch = scannedId || manualPartId;
        if (!idToSearch) return;

        setIsProcessing(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_BASE}/api/withdraw/partInfo`, 
                { partId: idToSearch },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const partInfo = response.data;

            setBorrowItems(prev => {
                const existing = prev.find(item => item.lotId === partInfo.lotId);
                const currentQtyInCart = existing ? existing.quantity : 0;

                if (currentQtyInCart + quantity > partInfo.currentStock) {
                    setTimeout(() => setError(`ไม่สามารถเพิ่มได้! สต๊อกคงเหลือเพียง ${partInfo.currentStock} ${partInfo.unit || 'ชิ้น'}`), 0);
                    return prev; 
                }

                if (existing) {
                    return prev.map(item => item.lotId === partInfo.lotId 
                        ? { ...item, quantity: item.quantity + quantity } : item);
                }
                return [...prev, { ...partInfo, quantity: quantity }];
            });
            setManualPartId('');
            setPartSuggestions([]);
            setIsScanning(false);
        } catch (err) {
            setError('ไม่พบข้อมูลอะไหล่รหัสนี้ในระบบ');
        } finally {
            setIsProcessing(false);
        }
    }, [manualPartId, isProcessing]);

    const updateQty = (index, delta) => {
        setBorrowItems(prev => {
            const newItems = [...prev];
            const item = newItems[index];
            const newQty = item.quantity + delta;
            if (delta > 0 && newQty > item.currentStock) {
                setTimeout(() => setError(`สต๊อกไม่พอ! อะไหล่นี้มีคงเหลือเพียง ${item.currentStock} ${item.unit || 'ชิ้น'}`), 0);
                return prev; 
            }

            setTimeout(() => setError(''), 0); 

            if (newQty > 0) newItems[index] = { ...item, quantity: newQty };
            return newItems;
        });
    };

    useEffect(() => {
        let scanner = null;
        if (isScanning) {
            scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 350, height: 150 } });
            scanner.render((decodedText) => {
                handleAddItem(decodedText);
                scanner.clear();
            }, () => {});
        }
        return () => { if (scanner) scanner.clear().catch(e => {}); };
    }, [isScanning, handleAddItem]);

    const handleFinalConfirm = async () => {
        if (borrowItems.length === 0) return;
        setIsProcessing(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE}/api/borrow/pending`, {
                userId: activeUser.user_id,
                borrowDate: borrowDate,
                items: borrowItems.map(item => ({
                    lotId: item.lotId,
                    quantity: item.quantity
                }))
            }, { headers: { Authorization: `Bearer ${token}` } });
            setCurrentStep(5);
        } catch (err) {
            setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกรายการ');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="borrow-page-container">
            <div className="withdraw-title-section">
                <h2 className="text-2xl font-bold text-center w-full">เบิกอะไหล่ล่วงหน้า</h2>
                <div className="step-progress-bar">
                    {[1, 2, 3, 4, 5].map((step) => (
                        <React.Fragment key={step}>
                            <div className={`step-item ${currentStep >= step ? 'active' : ''}`}>
                                <div className="step-circle">{currentStep > step ? <FaCheckCircle /> : step}</div>
                            </div>
                            {step < 5 && <div className={`step-line ${currentStep > step ? 'active' : ''}`}></div>}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="withdraw-card">
                {currentStep === 1 && (
                    <div className="step-content-unlock">
                        <div className="unlock-icon-container"><FaLockOpen size={48} /></div>
                        <h3 className="unlock-title">1. เปิดประตูกล่อง</h3>
                        <p className="unlock-subtitle">กดยืนยันเพื่อเปิดกล่องและหยิบอะไหล่</p>
                        <button onClick={handleOpenDoor} disabled={isProcessing} className="btn-unlock-gate">
                            {isProcessing ? <span className="loader"></span> : <><FaLockOpen /> เปิดประตูตู้</>}
                        </button>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="step-content-identify">
                        <div className="identify-header">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">2. ระบุอะไหล่</h3>
                        </div>
                        
                        <div className="scanner-action-area">
                            {isScanning ? <div id="reader"></div> : (
                                <button onClick={() => setIsScanning(true)} className="btn-modern-scanner">
                                    <FaCamera /> สแกนบาร์โค้ดอะไหล่
                                </button>
                            )}
                        </div>
                        
                        <div className="divider-with-text"><span>หรือค้นหารหัส</span></div>
                        
                        <div className="input-group-modern">
                            <div className="part-input-row">
                                <div className="flex-grow-input relative">
                                    <div className="input-with-icon">
                                        <FaSearch className="icon-prefix" />
                                        <input 
                                            type="text" 
                                            className="withdraw-input-modern" 
                                            value={manualPartId} 
                                            onChange={(e) => handlePartSearch(e.target.value)} 
                                            placeholder="พิมพ์รหัสอะไหล่..." 
                                        />
                                    </div>
                                    {partSuggestions.length > 0 && (
                                        <ul className="search-suggestions-list">
                                            {partSuggestions.map((p) => (
                                                <li key={p.equipment_id} onClick={() => { handleAddItem(p.equipment_id); setPartSuggestions([]); }}>
                                                    <div className="flex justify-between w-full">
                                                        <span>{p.equipment_name}</span>
                                                        <span className="text-pink-500 font-bold">{p.equipment_id}</span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <button onClick={() => handleAddItem()} className="btn-add-part-modern"><FaPlus size={20} /></button>
                            </div>
                        </div>

                        {borrowItems.length > 0 && (
                            <div className="cart-section animate-fadeIn">
                                <h4 className="cart-header">รายการที่เลือก ({borrowItems.length})</h4>
                                <div className="cart-list">
                                    {borrowItems.map((item, idx) => (
                                        <div key={idx} className="new-cart-item">
                                            <div className="item-thumb" onClick={() => item.imageUrl && setPreviewImage(`${API_BASE}/uploads/${item.imageUrl}`)}>
                                                {item.imageUrl ? <img src={`${API_BASE}/uploads/${item.imageUrl}`} alt="img" /> : <FaPlus />}
                                            </div>
                                            <div className="item-info">
                                                <div className="item-name">{item.partName}</div>
                                                <div className="item-lot">Lot: {item.lotId}</div>
                                            </div>
                                            <div className="item-controls">
                                                <div className="qty-stepper">
                                                    <button onClick={() => updateQty(idx, -1)}><FaMinus /></button>
                                                    <span>{item.quantity}</span>
                                                    <button onClick={() => updateQty(idx, 1)}><FaPlus /></button>
                                                </div>
                                                <button onClick={() => setBorrowItems(borrowItems.filter((_, i) => i !== idx))} className="btn-delete-small">
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-center w-full mt-4">
                                    <button onClick={() => setCurrentStep(3)} className="btn-review-confirm" style={{ maxWidth: '320px' }}>
                                        ตรวจสอบรายการ
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="footer-actions">
                            <button onClick={() => { if(window.confirm("ยกเลิกรายการ?")) setCurrentStep(5); }} className="btn-cancel-step2">ยกเลิกการทำรายการ</button>
                        </div>
                        {error && <p className="error-badge mt-4">{error}</p>}
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="step-content-review animate-fadeIn">
                        <div className="review-header-group">
                            <h3 className="text-2xl font-bold mb-4">3. ตรวจสอบข้อมูล</h3>
                        </div>

                        <div className="asset-info-banner">
                            <span className="label">รายละเอียดการเบิกยืมล่วงหน้า</span>
                            <div className="info-row-summary">
                                <span className="info-label">ประเภทรายการ :</span>
                                <span className="info-value">เบิกอะไหล่ล่วงหน้า </span>
                            </div>
                            <div className="info-row-summary">
                                <span className="info-label">วันที่ทำรายการ :</span>
                                <span className="info-value">{new Date(borrowDate).toLocaleDateString('th-TH')}</span>
                            </div>
                        </div>

                        <div className="review-list-container">
                            {borrowItems.map((item, idx) => (
                                <div key={idx} className="review-item-card">
                                    <div className="item-img-box">
                                        <img 
                                            src={item.imageUrl ? `${API_BASE}/uploads/${item.imageUrl}` : "https://placehold.co/60"} 
                                            alt="part" 
                                        />
                                    </div>
                                    <div className="item-main-info">
                                        <div className="item-name-row">
                                            <span className="name">{item.partName}</span>
                                            <div className="qty-display-group">
                                                <span className="qty-val">x {item.quantity}</span>
                                                <span className="unit-val">{item.unit || 'ชิ้น'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 mt-8 w-full">
                            <button onClick={() => setCurrentStep(2)} className="btn-review-edit flex-1">แก้ไขรายการ</button>
                            <button onClick={() => setCurrentStep(4)} className="btn-review-confirm flex-2">ตรวจสอบเรียบร้อย</button>
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="step-content-confirmation">
                        <FaClipboardCheck size={64} className="text-blue-500 mb-4" />
                        <h3 className="text-2xl font-bold text-gray-800">4. ยืนยันการบันทึก</h3>
                        <div className="confirmation-summary-card">
                            <span className="summary-header-label" style={{ color: '#3b82f6' }}>สรุปการเบิกล่วงหน้า</span>
                            <div className="info-row-summary">
                                <span className="info-label">วันที่เบิก:</span>
                                <span className="info-value">{new Date(borrowDate).toLocaleDateString('th-TH')}</span>
                            </div>
                            <div className="summary-total-footer mt-4">
                                <span>รวมอะไหล่ทั้งสิ้น</span>
                                <div className="total-count-badge">
                                    {borrowItems.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-4 w-full mt-2">
                            <button onClick={handleFinalConfirm} disabled={isProcessing} className="btn-action-primary" style={{ width: '100%', maxWidth: '320px' }}>
                                {isProcessing ? "กำลังบันทึก..." : "ยืนยันการเบิกยืม"}
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 5 && (
                    <div className="step-content-success">
                        <div className="success-banner-modern">
                            <div className="success-icon-circle"><FaCheckCircle /></div>
                            <span className="success-text-main">บันทึกข้อมูลสำเร็จ!</span>
                        </div>
                        <button onClick={handleCloseDoor} disabled={isProcessing} className="btn-close-gate-final">
                            {isProcessing ? <span className="loader"></span> : <><FaLock /> ปิดประตูกล่อง</>}
                        </button>
                    </div>
                )} 
            </div>

            {/* ส่วนแสดงรูปภาพขนาดใหญ่ */}
            {previewImage && (
                <div className="image-viewer-overlay" onClick={() => setPreviewImage(null)}>
                    <div className="image-viewer-content">
                        <img src={previewImage} alt="Preview" />
                        <button className="close-image-btn" onClick={() => setPreviewImage(null)}><FaTimes /></button>
                    </div>
                </div>
            )}

            {/* ส่วนแสดงสถานะตู้ไม่ว่าง */}
            {cabinetBusy && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[9999] flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-md w-full mx-4">
                        <div className="text-yellow-500 mb-4 flex justify-center">
                            <FaLock size={60} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">ตู้กำลังถูกใช้งาน</h2>
                        <p className="text-gray-600 mb-6">
                            ขณะนี้ <b>{busyBy || 'พนักงานท่านอื่น'}</b> กำลังทำรายการอยู่ที่หน้าตู้<br/>
                            โปรดรอสักครู่ เมื่อทำรายการเสร็จสิ้นหน้าต่างนี้จะหายไปเอง
                        </p>
                        <div className="flex justify-center">
                            <span className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default BorrowPage;