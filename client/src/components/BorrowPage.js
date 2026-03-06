import React, { useState, useEffect, useCallback } from "react";
import { 
    FaCheckCircle, FaCamera, FaLockOpen, FaPlus, FaMinus, 
    FaTrash, FaLock, FaClipboardCheck, FaTimes, FaSearch
} from "react-icons/fa"; 
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from "axios";
import './BorrowPage.css'; 

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function BorrowPage({ user }) {
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
    const [previewImage, setPreviewImage] = useState(null);
    const [partSuggestions, setPartSuggestions] = useState([]);

    const handleResetForm = () => {
        setCurrentStep(1);
        setBorrowItems([]);
        setManualPartId('');
        setError('');
        setIsScanning(false);
    };

    const handleOpenDoor = async () => {
        setIsProcessing(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            
            // 🚩 1. เช็คสถานะบอร์ดจาก API ก่อน
            const checkRes = await axios.get(`${API_BASE}/api/device-check`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });

            // 🚩 2. ถ้าออนไลน์ ค่อยสั่งเปิดประตู
            if (checkRes.data.status === "online") {
                await axios.get(`${API_BASE}/api/open`, { 
                    headers: { Authorization: `Bearer ${token}` } 
                });
                setCurrentStep(2); // ไปต่อ Step 2 ได้
            }
        } catch (err) {
            // ดักจับข้อความ Error จาก Backend (เช่น ตู้ไม่พร้อมใช้งาน)
            setError(err.response?.data?.message || 'ไม่สามารถติดต่อตู้เพื่อเปิดได้');
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
        setBorrowItems(prev => prev.map((item, i) => 
            i === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
        ));
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
                        <div className="input-group-modern mb-6" style={{maxWidth: '320px'}}>
                            <label className="input-label-modern">วันที่เบิกล่วงหน้า</label>
                            <input type="date" className="withdraw-input-modern" value={borrowDate} disabled />
                        </div>
                        <button onClick={handleOpenDoor} disabled={isProcessing} className="btn-unlock-gate">
                            {isProcessing ? <span className="loader"></span> : <><FaLockOpen /> เปิดประตูตู้</>}
                        </button>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="step-content-identify">
                        <div className="identify-header"><h3 className="text-2xl font-bold text-gray-800">2. ระบุอะไหล่</h3></div>
                        <div className="scanner-action-area">
                            {isScanning ? <div id="reader"></div> : 
                            <button onClick={() => setIsScanning(true)} className="btn-modern-scanner"><FaCamera /> สแกนบาร์โค้ดอะไหล่</button>}
                        </div>
                        <div className="divider-with-text"><span>หรือค้นหารหัส</span></div>
                        <div className="input-group-modern">
                            <div className="part-input-row">
                                <div className="flex-grow-input relative">
                                    <div className="input-with-icon">
                                        <FaSearch className="icon-prefix" />
                                        <input type="text" className="withdraw-input-modern" value={manualPartId} onChange={(e) => handlePartSearch(e.target.value)} placeholder="พิมพ์รหัสอะไหล่..." />
                                    </div>
                                    {partSuggestions.length > 0 && (
                                        <ul className="search-suggestions-list">
                                            {partSuggestions.map((p) => (
                                                <li key={p.equipment_id} onClick={() => { handleAddItem(p.equipment_id); setPartSuggestions([]); }}>
                                                    <div className="flex justify-between w-full"><span>{p.equipment_name}</span><span className="text-pink-500 font-bold">{p.equipment_id}</span></div>
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
                                <h4 className="cart-header">รายการในตะกร้า ({borrowItems.length})</h4>
                                <div className="cart-list">
                                    {borrowItems.map((item, idx) => (
                                        <div key={idx} className="new-cart-item">
                                            <div className="item-thumb" onClick={() => item.imageUrl && setPreviewImage(`${API_BASE}/uploads/${item.imageUrl}`)}>
                                                {item.imageUrl ? <img src={`${API_BASE}/uploads/${item.imageUrl}`} alt="img" /> : <FaPlus />}
                                            </div>
                                            <div className="item-info"><div className="item-name">{item.partName}</div><div className="item-lot">Lot: {item.lotId}</div></div>
                                            <div className="item-controls">
                                                <div className="qty-stepper">
                                                    <button onClick={() => updateQty(idx, -1)}><FaMinus /></button>
                                                    <span>{item.quantity}</span>
                                                    <button onClick={() => updateQty(idx, 1)}><FaPlus /></button>
                                                </div>
                                                <button onClick={() => setBorrowItems(borrowItems.filter((_, i) => i !== idx))} className="btn-delete-small"><FaTrash /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => setCurrentStep(3)} className="btn-action-primary mt-4">ตรวจสอบรายการ</button>
                            </div>
                        )}
                        <div className="footer-actions"><button onClick={() => setCurrentStep(5)} className="btn-cancel-step2">ยกเลิกการทำรายการ</button></div>
                        {error && <p className="error-badge mt-4">{error}</p>}
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="step-content-review animate-fadeIn">
                        <div className="review-header-group">
                            <h3 className="text-2xl font-bold">3. ตรวจสอบข้อมูล</h3>
                            <p className="text-gray-400 text-sm">กรุณาตรวจสอบรายละเอียดก่อนบันทึก</p>
                        </div>

                        {/* แบนเนอร์แสดงวันที่เบิกยืมล่วงหน้า */}
                        <div className="asset-info-banner">
                            <div className="label">วันที่เบิกยืมล่วงหน้า</div>
                            <div className="value">{new Date(borrowDate).toLocaleDateString('th-TH')}</div>
                        </div>

                        <div className="review-list-container">
                            <h4 className="text-sm font-bold mb-3 text-gray-500 uppercase text-center">
                                รายการอะไหล่ที่เบิก
                            </h4>
                            {borrowItems.map((item, idx) => (
                                <div key={idx} className="review-item-card">
                                    <div className="item-img-box">
                                        {item.imageUrl ? (
                                            <img src={`${API_BASE}/uploads/${item.imageUrl}`} alt="part" />
                                        ) : (
                                            <FaPlus size={16} className="text-gray-300" />
                                        )}
                                    </div>
                                    <div className="item-main-info">
                                        <div className="item-name-row">
                                            <span className="name">{item.partName}</span>
                                            <div className="qty-display-group">
                                                <span className="qty-val">x {item.quantity}</span>
                                                <span className="unit-val">{item.unit || 'ชิ้น'}</span>
                                            </div>
                                        </div>
                                        <div className="item-sub-info">
                                            <span className="tag-lot">Lot: {item.lotId}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ปุ่มกดจัดวางแบบ Flex กึ่งกลาง */}
                        <div className="flex gap-3 mt-8 w-full justify-center">
                            <button onClick={() => setCurrentStep(2)} className="btn-review-edit">แก้ไขรายการ</button>
                            <button onClick={() => setCurrentStep(4)} className="btn-review-confirm">ไปหน้ายืนยัน</button>
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="step-content-confirmation">
                        <FaClipboardCheck size={64} className="text-blue-500 mb-4" />
                        <h3 className="text-2xl font-bold text-gray-800">4. ยืนยันการบันทึก</h3>
                        <div className="confirmation-summary-card">
                            <span className="summary-header-label">สรุปการเบิกล่วงหน้า</span>
                            <div className="summary-data-row"><span>วันที่:</span><b>{new Date(borrowDate).toLocaleDateString('th-TH')}</b></div>
                            <div className="summary-items-list">
                                {borrowItems.map((item, idx) => (
                                    <div key={idx} className="summary-item-line"><span>{item.partName}</span><b>x {item.quantity} {item.unit || 'ชิ้น'}</b></div>
                                ))}
                            </div>
                            <div className="summary-total-footer"><span>รวมทั้งสิ้น</span><div className="total-count-badge">{borrowItems.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น</div></div>
                        </div>
                        <div className="flex gap-4 w-full mt-2">
                            <button onClick={() => setCurrentStep(3)} className="btn-review-edit flex-1">กลับ</button>
                            <button onClick={handleFinalConfirm} disabled={isProcessing} className="btn-action-primary flex-2">{isProcessing ? "กำลังบันทึก..." : "ยืนยันการเบิกยืม"}</button>
                        </div>
                    </div>
                )}

                {currentStep === 5 && (
                    <div className="step-content-success">
                        <div className="success-banner-modern">
                            <div className="success-icon-circle">
                                <FaCheckCircle />
                            </div>
                            <span className="success-text-main">บันทึกข้อมูลสำเร็จ!</span>
                        </div>

                        <h3 className="text-2xl font-bold text-gray-800 mb-2">5. สั่งปิดประตู</h3>
                        <p className="instruction-text">
                            ตรวจสอบสิ่งกีดขวางบริเวณหน้ากล่องให้เรียบร้อย แล้วกดปุ่มเพื่อล็อกตู้
                        </p>

                        <button 
                            onClick={handleCloseDoor} 
                            disabled={isProcessing} 
                            className="btn-close-gate-final"
                        >
                            {isProcessing ? (
                                <span className="loader"></span>
                            ) : (
                                <>
                                    <FaLock />
                                    ปิดประตูกล่อง
                                </>
                            )}
                        </button>
                    </div>
                )}                
            </div>

            {previewImage && (
                <div className="image-viewer-overlay" onClick={() => setPreviewImage(null)}>
                    <div className="image-viewer-content"><img src={previewImage} alt="Preview" /><button className="close-image-btn" onClick={() => setPreviewImage(null)}><FaTimes /></button></div>
                </div>
            )}
        </div>
    );
}

export default BorrowPage;