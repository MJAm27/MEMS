import React, { useState, useEffect, useCallback } from "react";
import { 
    FaCheckCircle, FaCamera, FaLockOpen, FaPlus, FaMinus, 
    FaTrash, FaLock, FaClipboardCheck, FaTimes
} from "react-icons/fa"; 
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from "axios";
import './BorrowPage.css'; 

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function BorrowPage({ user }) {
    // กำหนดค่าเริ่มต้นให้กับ activeUser เพื่อป้องกัน error กรณี user เป็น null
    const activeUser = user || { fullname: 'ผู้ใช้งาน', user_id: null };
    
    const [currentStep, setCurrentStep] = useState(1); 
    const [borrowDate, setBorrowDate] = useState(() => {
        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000; 
        const localISOTime = (new Date(now - tzOffset)).toISOString().slice(0, 10);
        return localISOTime;
    });
    const [borrowItems, setBorrowItems] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [manualPartId, setManualPartId] = useState('');
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [partSuggestions, setPartSuggestions] = useState([]);

    // --- 1. ฟังก์ชันจัดการจำนวน (วางไว้ใน Component เพื่อแก้ eslint no-undef) ---
    const updateQty = (index, delta) => {
        setBorrowItems(prev => prev.map((item, i) => 
            i === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
        ));
    };

    // --- 2. ควบคุมฮาร์ดแวร์ ---
    const handleOpenDoor = async () => {
        setIsProcessing(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            await axios.get(`${API_BASE}/api/open`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            setCurrentStep(2);
        } catch (err) {
            setError('ไม่สามารถติดต่อตู้เพื่อเปิดได้');
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
            window.location.reload();
        } catch (err) {
            setError('คำสั่งปิดประตูขัดข้อง');
        } finally {
            setIsProcessing(false);
        }
    };

    // --- 3. ระบบค้นหาและจัดการตะกร้า ---
    const handlePartSearch = async (val) => {
        setManualPartId(val);
        if (val.length > 0) {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_BASE}/api/search/parts?term=${val}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setPartSuggestions(res.data);
            } catch (err) { 
                console.error("Search error:", err); 
            }
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

    // ระบบ QR Scanner
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

    // บันทึกข้อมูลลงฐานข้อมูล
    const handleFinalConfirm = async () => {
        if (borrowItems.length === 0) return;
        if (!activeUser.user_id) {
            setError('ไม่พบข้อมูลผู้ใช้งาน กรุณาลองเข้าสู่ระบบใหม่');
            return;
        }

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

    const handleCancelStep2 = () => {
        if (window.confirm("คุณต้องการยกเลิกการทำรายการและปิดตู้ใช่หรือไม่?")) {
            setCurrentStep(5);
        }
    };

    return (
        <div className="borrow-page-container">
            <div className="return-header-section text-center">
                <h2 className="text-2xl font-bold mb-4">เบิกอะไหล่ล่วงหน้า</h2>
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

            <div className="return-card mt-2">
                {currentStep === 1 && (
                    <div className="step-content animate-fade text-center py-4">
                        <div className="status-icon-wrapper mb-6"><FaLockOpen size={50} className="text-pink-500" /></div>
                        <h3 className="step-title font-bold text-2xl mb-2">1. เปิดประตูกล่อง</h3>
                        <p className="step-desc text-gray-400 mb-8">กดยืนยันเพื่อเปิดกล่องและหยิบอะไหล่</p>
                        <div className="input-group-modern mb-8">
                            <label className="input-label">วันที่เบิกล่วงหน้า</label>
                            <input 
                                type="date" 
                                className="modern-input" 
                                value={borrowDate} 
                                disabled
                            />
                        </div>
                        <button onClick={handleOpenDoor} disabled={isProcessing} className="btn-action btn-open-gate">
                            {isProcessing ? <span className="loader"></span> : <><FaLockOpen /> เปิดประตู</>}
                        </button>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="step-content animate-fade">
                        <h3 className="text-lg font-bold mb-4">2. ระบุอะไหล่ที่หยิบ</h3>
                        
                        <div className="scanner-section mb-6">
                            {isScanning ? (
                                <div className="scanner-container">
                                    <div id="reader"></div>
                                    <button onClick={() => setIsScanning(false)} className="btn-cancel-scan mt-4">ยกเลิกสแกน</button>
                                </div>
                            ) : (
                                <button onClick={() => setIsScanning(true)} className="btn-scanner-trigger">
                                    <FaCamera /> สแกนบาร์โค้ดอะไหล่
                                </button>
                            )}
                        </div>
                        <div className="divider-text mb-6"><span>หรือค้นหารหัส</span></div>
                        <div className="relative mb-6">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    className="modern-input flex-grow" 
                                    value={manualPartId} 
                                    onChange={(e) => handlePartSearch(e.target.value)}
                                    placeholder="รหัสอะไหล่..." 
                                />
                                <button onClick={() => handleAddItem()} className="btn-add-square"><FaPlus /></button>
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
                        {borrowItems.length > 0 && (
                            <div className="cart-section mt-8">
                                <h4 className="section-title-sm mb-4">รายการในตะกร้า ({borrowItems.length})</h4>
                                <div className="modern-items-list">
                                    {borrowItems.map((item, index) => (
                                        <div key={index} className="modern-part-card">
                                            <div className="part-img" onClick={() => item.imageUrl && setPreviewImage(`${API_BASE}/uploads/${item.imageUrl}`)}>
                                                {item.imageUrl ? <img src={`${API_BASE}/uploads/${item.imageUrl}`} alt="img" /> : <FaPlus />}
                                            </div>
                                            <div className="part-details">
                                                <span className="part-name">{item.partName}</span>
                                                <span className="part-lot">Lot: {item.lotId}</span>
                                            </div>
                                            <div className="part-actions">
                                                <div className="modern-qty-control">
                                                    <button onClick={() => updateQty(index, -1)}><FaMinus size={10}/></button>
                                                    <span className="qty-number">{item.quantity}</span>
                                                    <button onClick={() => updateQty(index, 1)}><FaPlus size={10}/></button>
                                                </div>
                                                <button className="btn-delete-item" onClick={() => setBorrowItems(borrowItems.filter((_, i) => i !== index))}>
                                                    <FaTrash size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => setCurrentStep(3)} className="btn-action-primary w-full mt-6 shadow-pink">ตรวจสอบรายการ</button>
                            </div>
                        )}
                        <div className="cancel-step2-wrapper">
                            <button 
                                onClick={handleCancelStep2}
                                className="btn-cancel-step2"
                            >
                                ยกเลิกการทำรายการ
                            </button>
                        </div>
                        {error && <p className="error-badge mt-4">{error}</p>}
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="step-content animate-fade">
                        <div className="text-center mb-6">
                             <h3 className="font-bold text-2xl">3. ตรวจสอบข้อมูล</h3>
                             <p className="text-gray-400 text-sm">กรุณาตรวจสอบรายละเอียดก่อนบันทึก</p>
                        </div>
                        <div className="asset-info-banner mb-6">
                            <div className="label">วันที่เบิกยืมล่วงหน้า</div>
                            <div className="value">{new Date(borrowDate).toLocaleDateString('th-TH')}</div>
                        </div>
                        <div className="review-list-container mb-8">
                            <h4 className="text-sm font-bold mb-3 text-gray-500 uppercase">รายการอะไหล่</h4>
                            {borrowItems.map((item, idx) => (
                                <div key={idx} className="review-item-card">
                                    <div className="item-img-box">
                                        {item.imageUrl ? <img src={`${API_BASE}/uploads/${item.imageUrl}`} alt="part" /> : <FaPlus size={16} className="text-gray-300" />}
                                    </div>
                                    <div className="item-main-info">
                                        <div className="item-name-row">
                                            <span className="name">{item.partName}</span>
                                            <div className="qty-display-group">
                                                <span className="qty-val">x {item.quantity}</span>
                                                <span className="unit-val">{item.unit || 'ชิ้น'}</span>
                                            </div>
                                        </div>
                                        <div className="item-sub-info"><span className="tag-lot">Lot: {item.lotId}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setCurrentStep(2)} className="btn-review-edit flex-1">แก้ไขรายการ</button>
                            <button onClick={() => setCurrentStep(4)} className="btn-review-confirm flex-2">ไปหน้ายืนยัน</button>
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="text-center py-4 space-y-6 animate-fade">
                        <FaClipboardCheck size={60} className="mx-auto text-blue-500 mb-2" />
                        <h3 className="text-2xl font-bold">4. ยืนยันการบันทึก</h3>
                        <div className="summary-box-blue bg-blue-50 p-6 rounded-3xl border border-blue-100 text-left">
                            <p className="text-xs text-blue-600 font-bold uppercase mb-1">สรุปการเบิกยืมล่วงหน้า</p>
                            <p className="text-sm text-gray-700"><b>ผู้เบิก:</b> {activeUser.fullname}</p>
                            <p className="text-sm text-gray-700"><b>จำนวนรายการ:</b> {borrowItems.length} รายการ</p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setCurrentStep(3)} className="btn-review-edit flex-1">กลับ</button>
                            <button onClick={handleFinalConfirm} disabled={isProcessing} className="btn-action-primary flex-2">
                                {isProcessing ? <span className="loader"></span> : 'ยืนยันการเบิกยืม'}
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 5 && (
                    <div className="text-center py-6 animate-fadeIn">
                        <div className="success-badge bg-green-100 text-green-700 p-4 rounded-2xl mb-8 flex items-center gap-3 justify-center">
                            <FaCheckCircle size={24} /> <p className="font-bold">บันทึกสำเร็จ!</p>
                        </div>
                        <h3 className="font-bold text-2xl mb-3">5. สั่งปิดประตู</h3>
                        <p className="text-gray-500 mb-8">ตรวจสอบสิ่งกีดขวางแล้วกดปุ่มเพื่อล็อกตู้</p>
                        <button onClick={handleCloseDoor} disabled={isProcessing} className="btn-action-dark w-full">
                            {isProcessing ? <span className="loader"></span> : <><FaLock className="mr-2" /> สั่งปิดประตูกล่อง</>}
                        </button>
                    </div>
                )}
            </div>

            {previewImage && (
                <div className="image-viewer-overlay" onClick={() => setPreviewImage(null)}>
                    <div className="image-viewer-content">
                        <img src={previewImage} alt="Preview" />
                        <button className="close-image-btn" onClick={() => setPreviewImage(null)}><FaTimes /></button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default BorrowPage;