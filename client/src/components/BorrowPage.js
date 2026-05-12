import React, { useState, useEffect, useCallback } from "react";
import { 
    FaCheckCircle, FaCamera, FaPlus, FaMinus, 
    FaTrash, FaClipboardCheck, FaTimes, FaSearch
} from "react-icons/fa"; 
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from "axios";
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
    const [previewImage, setPreviewImage] = useState(null); 

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
        if ((currentStep === 1 && borrowItems.length > 0) || currentStep === 2) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ currentStep, borrowItems }));
        } else if (borrowItems.length === 0) {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [currentStep, borrowItems]);

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if ((currentStep === 1 && borrowItems.length > 0) || currentStep === 2) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    },[currentStep, borrowItems]);

    const handleResetForm = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setCurrentStep(1);
        setBorrowItems([]);
        setManualPartId('');
        setError('');
        setIsScanning(false);
        if (setIsLocked) setIsLocked(false);
    }, [setIsLocked]);

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
        if (isScanning && currentStep === 1) {
            scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 350, height: 150 } });
            scanner.render((decodedText) => {
                handleAddItem(decodedText);
                scanner.clear();
            }, () => {});
        }
        return () => { if (scanner) scanner.clear().catch(e => {}); };
    }, [isScanning, currentStep, handleAddItem]);

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
            alert("บันทึกข้อมูลการเบิกสำเร็จ!");
            handleResetForm();
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
                    {[1, 2].map((step) => (
                        <React.Fragment key={step}>
                            <div className={`step-item ${currentStep >= step ? 'active' : ''}`}>
                                <div className="step-circle">{currentStep > step ? <FaCheckCircle /> : step}</div>
                            </div>
                            {step < 2 && <div className={`step-line ${currentStep > step ? 'active' : ''}`}></div>}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="withdraw-card">
                {currentStep === 1 && (
                    <div className="step-content-identify">
                        <div className="identify-header">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">1. ระบุอะไหล่</h3>
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
                                    <button onClick={() => setCurrentStep(2)} className="btn-review-confirm" style={{ maxWidth: '320px' }}>
                                        ตรวจสอบรายการ
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="footer-actions">
                            <button onClick={() => { if(window.confirm("ต้องการยกเลิกรายการทั้งหมดใช่หรือไม่?")) { handleResetForm(); } }} className="btn-cancel-step2">ยกเลิกทำรายการ</button>
                        </div>
                        {error && <p className="error-badge mt-4">{error}</p>}
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="step-content-confirmation">
                        <FaClipboardCheck size={64} className="text-blue-500 mb-4" />
                        <h3 className="text-2xl font-bold text-gray-800">2. ตรวจสอบและยืนยันการบันทึก</h3>
                        <div className="confirmation-summary-card">
                            <span className="summary-header-label" style={{ color: '#3b82f6' }}>สรุปการเบิกล่วงหน้า</span>
                            <div className="info-row-summary">
                                <span className="info-label">วันที่เบิก:</span>
                                <span className="info-value">{new Date(borrowDate).toLocaleDateString('th-TH')}</span>
                            </div>
                            <div className="summary-items-list mt-2 border-t pt-2">
                                {borrowItems.map((item, idx) => (
                                    <div key={idx} className="summary-item-line">
                                        <span className="text-gray-800">{item.partName}</span>
                                        <span className="font-bold">x {item.quantity} {item.unit || 'ชิ้น'}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="summary-total-footer mt-4">
                                <span>รวมอะไหล่ทั้งสิ้น</span>
                                <div className="total-count-badge">
                                    {borrowItems.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-4 w-full mt-6">
                            <button onClick={() => setCurrentStep(1)} className="btn-review-edit flex-1">กลับไปแก้ไข</button>
                            <button onClick={() => { if(window.confirm("ต้องการยกเลิกรายการทั้งหมดใช่หรือไม่?")) { handleResetForm(); } }} className="btn-cancel-step2 flex-1">ยกเลิกทำรายการ</button>
                            <button onClick={handleFinalConfirm} disabled={isProcessing} className="btn-action-primary flex-2">
                                {isProcessing ? "กำลังบันทึก..." : "ยืนยันและบันทึก"}
                            </button>
                        </div>
                        {error && <p className="error-badge mt-4">{error}</p>}
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