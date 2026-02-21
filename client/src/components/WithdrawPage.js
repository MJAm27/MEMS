import React, { useState, useEffect, useCallback } from 'react';
import { 
    FaLockOpen, FaCheckCircle, FaPlus, FaCamera, FaTrash, 
    FaMinus, FaLock, FaClipboardCheck, FaTimes, FaSearch
} from 'react-icons/fa'; 
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';
import './WithdrawPage.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function WithdrawPage({ user }) { 
    
    
    const [currentStep, setCurrentStep] = useState(1);
    const [assetId, setAssetId] = useState('');
    const [currentPartId, setCurrentPartId] = useState('');
    const [cartItems, setCartItems] = useState([]);
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);

    const [machineSuggestions, setMachineSuggestions] = useState([]);
    const [partSuggestions, setPartSuggestions] = useState([]);

    // --- 1. ฟังก์ชันควบคุมประตู (ESP8266) ---
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

    // --- 2. ระบบจัดการข้อมูลอะไหล่และตะกร้า ---
    const handleMachineSearch = async (val) => {
        setAssetId(val);
        if (val.length > 0) {
            try {
                const res = await axios.get(`${API_BASE}/api/search/machines?term=${val}`);
                setMachineSuggestions(res.data);
            } catch (err) { console.error(err); }
        } else {
            setMachineSuggestions([]);
        }
    };

    const handlePartSearch = async (val) => {
        setCurrentPartId(val);
        if (val.length > 0) {
            try {
                const res = await axios.get(`${API_BASE}/api/search/parts?term=${val}`);
                setPartSuggestions(res.data);
            } catch (err) { console.error(err); }
        } else {
            setPartSuggestions([]);
        }
    };

    const updateItemQuantity = (index, delta) => {
        setCartItems(prev => {
            const newItems = [...prev];
            const newQty = newItems[index].quantity + delta;
            if (newQty > 0) {
                newItems[index] = { ...newItems[index], quantity: newQty };
            }
            return newItems;
        });
    };

    const handleAddItemToCart = useCallback(async (scannedId, quantity = 1) => {
        if (isProcessing) return;
        const idToSearch = scannedId || currentPartId;
        if (!assetId) { setError('กรุณากรอกเลขครุภัณฑ์ก่อน'); return; }
        if (!idToSearch) { setError('กรุณาระบุรหัสอะไหล่'); return; }

        setIsProcessing(true);
        setError('');
        try {
            const response = await axios.post(`${API_BASE}/api/withdraw/partInfo`, { partId: idToSearch });
            const partInfo = response.data;
            
            setCartItems(prev => {
                const existing = prev.find(item => item.lotId === partInfo.lotId);
                if (existing) {
                    return prev.map(item => item.lotId === partInfo.lotId ? { ...item, quantity: item.quantity + quantity } : item);
                }
                return [...prev, { ...partInfo, quantity: quantity }];
            });
            setCurrentPartId('');
            setPartSuggestions([]);
        } catch (err) {
            setError(err.response?.data?.error || 'ไม่พบข้อมูลอะไหล่');
        } finally {
            setIsProcessing(false);
        }
    }, [assetId, currentPartId, isProcessing]);

    const handleFinalConfirm = async () => {
        if (cartItems.length === 0) return;
        setIsProcessing(true);
        setError("");
        try {
            const token = localStorage.getItem('token');
            const payload = { 
                machine_SN: assetId, 
                cartItems: cartItems.map(item => ({ lotId: item.lotId, partId: item.partId, quantity: item.quantity })) 
            };
            await axios.post(`${API_BASE}/api/withdraw/confirm`, payload, { headers: { Authorization: `Bearer ${token}` } });
            setCurrentStep(5);
        } catch (err) {
            setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } finally {
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        let scanner = null;
        if (showScanner && currentStep === 2) {
            scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 350, height: 150 } });
            scanner.render((decodedText) => {
                handleAddItemToCart(decodedText, 1);
                setShowScanner(false);
                scanner.clear();
            }, () => {});
        }
        return () => { if (scanner) scanner.clear().catch(() => {}); };
    }, [showScanner, currentStep, handleAddItemToCart]);

    return (
        <div className="withdraw-page-container">
            <div className="withdraw-title-section">
                <h2 className="text-2xl font-bold text-center w-full">เบิกอะไหล่</h2>
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
                    <div className="text-center py-6 animate-fadeIn">
                        <div className="status-icon-wrapper mb-6"><FaLockOpen size={50} className="text-pink-500" /></div>
                        <h3 className="step-title font-bold text-2xl">1. เปิดประตูกล่อง</h3>
                        <p className="step-desc text-gray-400 mb-8">กรุณากดปุ่มเพื่อปลดล็อก</p>
                        <button onClick={handleOpenDoor} disabled={isProcessing} className="btn-action btn-open-gate">
                            {isProcessing ? <span className="loader"></span> : <><FaLockOpen /> เปิดประตู</>}
                        </button>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="step-content animate-fadeIn">
                        <h3 className="text-lg font-bold mb-4">2. ระบุอะไหล่</h3>
                        
                        {/* ส่วนครุภัณฑ์ */}
                        <div className="input-field-group relative">
                            <label className="input-label">เลขครุภัณฑ์ (Asset ID)</label>
                            <div className="input-with-icon">
                                <FaSearch className="icon-prefix" />
                                <input type="text" className="withdraw-input-modern" value={assetId} onChange={(e) => handleMachineSearch(e.target.value)} placeholder="ค้นหาครุภัณฑ์..." />
                            </div>
                            {machineSuggestions.length > 0 && (
                                <ul className="search-suggestions-list">
                                    {machineSuggestions.map(m => (
                                        <li key={m.machine_SN} onClick={() => { setAssetId(m.machine_SN); setMachineSuggestions([]); }}>
                                            {m.machine_SN} <small>{m.machine_name}</small>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="divider-or"><span>หรือสแกน</span></div>

                        {/* ปุ่มสแกนแบบใหม่ */}
                        <div className="scanner-section">
                            {showScanner ? <div id="reader"></div> : 
                            <button onClick={() => setShowScanner(true)} className="btn-modern-scanner">
                                <FaCamera /> สแกนบาร์โค้ดอะไหล่
                            </button>}
                        </div>

                        {/* ส่วนเพิ่มอะไหล่ด้วยรหัส */}
                        <div className="input-field-group relative mt-4">
                            <label className="input-label">ระบุรหัสอะไหล่</label>
                            <div className="flex gap-2">
                                <div className="input-with-icon flex-grow">
                                    <FaPlus className="icon-prefix" />
                                    <input type="text" className="withdraw-input-modern" value={currentPartId} onChange={(e) => handlePartSearch(e.target.value)} placeholder="รหัสอะไหล่..." />
                                </div>
                                <button onClick={() => handleAddItemToCart()} className="btn-add-circle"><FaPlus /></button>
                            </div>
                            {partSuggestions.length > 0 && (
                                <ul className="search-suggestions-list">
                                    {partSuggestions.map((p) => (
                                        <li key={p.equipment_id} onClick={() => { handleAddItemToCart(p.equipment_id); setPartSuggestions([]); }}>
                                            <div className="flex justify-between w-full">
                                                <span>{p.equipment_name}</span>
                                                <span className="text-pink-500 font-bold">{p.equipment_id}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* ตะกร้าอะไหล่ - ออกแบบใหม่ตามภาพที่แนบ */}
                        {cartItems.length > 0 && (
                            <div className="cart-section mt-6">
                                <h4 className="cart-header">รายการในตะกร้า ({cartItems.length})</h4>
                                <div className="cart-list">
                                    {cartItems.map((item, idx) => (
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
                                                    <button onClick={() => updateItemQuantity(idx, -1)}><FaMinus /></button>
                                                    <span>{item.quantity}</span>
                                                    <button onClick={() => updateItemQuantity(idx, 1)}><FaPlus /></button>
                                                </div>
                                                <button onClick={() => setCartItems(cartItems.filter((_, i) => i !== idx))} className="btn-delete-small">
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => setCurrentStep(3)} className="btn-action btn-open-gate mt-6">
                                    ตรวจสอบรายการ ({cartItems.length})
                                </button>
                            </div>
                        )}
                        {error && <p className="error-text-mini">{error}</p>}
                    </div>
                )}

                {/* STEP 3 & 4 & 5 ยังคงเดิมตาม Logic เดิมของคุณ */}
                {currentStep === 3 && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="text-center">
                            {/* 1. เอา FaListUl ออกแล้ว */}
                            <h3 className="text-2xl font-bold">3. ตรวจสอบข้อมูล</h3>
                            <p className="text-gray-400 text-sm">กรุณาตรวจสอบรายละเอียดก่อนบันทึก</p>
                        </div>

                        {/* ข้อมูลเลขครุภัณฑ์ */}
                        <div className="asset-info-banner">
                            <div className="label">เลขครุภัณฑ์ (Asset ID)</div>
                            <div className="value">{assetId}</div>
                        </div>

                        {/* รายการอะไหล่ที่เบิก */}
                        <div className="review-list-container">
                            <h4 className="text-sm font-bold mb-3 text-gray-500 uppercase tracking-wider">รายการอะไหล่ที่เบิก</h4>
                            {cartItems.map((item, idx) => (
                                <div key={idx} className="review-item-card">
                                    <div className="item-img-box">
                                        {item.imageUrl ? (
                                            <img src={`${API_BASE}/uploads/${item.imageUrl}`} alt="part" />
                                        ) : (
                                            <div className="flex items-center justify-center w-full h-full bg-gray-50 text-gray-300">
                                                <FaPlus size={16} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="item-main-info">
                                        <div className="item-name-row">
                                            <span className="name">{item.partName}</span>
                                            {/* 2. ปรับโครงสร้างจำนวนและหน่วยให้อยู่บรรทัดเดียวกัน */}
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

                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setCurrentStep(2)} className="btn-review-edit">
                                แก้ไขรายการ
                            </button>
                            <button onClick={() => setCurrentStep(4)} className="btn-review-confirm">
                                บันทึกข้อมูล
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="text-center animate-fadeIn">
                        <FaClipboardCheck size={60} className="mx-auto text-blue-500 mb-4" />
                        <h3 className="text-2xl font-bold mb-6">4. ยืนยันการบันทึก</h3>
                        <button onClick={handleFinalConfirm} disabled={isProcessing} className="btn-action btn-confirm-save">
                            {isProcessing ? "กำลังบันทึก..." : "ยืนยันการเบิกอะไหล่"}
                        </button>
                    </div>
                )}

                {currentStep === 5 && (
                    <div className="text-center animate-fadeIn">
                        <FaCheckCircle size={60} className="mx-auto text-green-500 mb-4" />
                        <h3 className="text-2xl font-bold mb-2">สำเร็จ!</h3>
                        <p className="text-gray-500 mb-8">บันทึกข้อมูลเรียบร้อยแล้ว</p>
                        <button onClick={handleCloseDoor} className="btn-action btn-close-lock"><FaLock /> ปิดประตูกล่อง</button>
                    </div>
                )}
            </div>

            {previewImage && (
                <div className="image-viewer-overlay" onClick={() => setPreviewImage(null)}>
                    <div className="image-viewer-content">
                        <img src={previewImage} alt="Preview" />
                        <button className="close-image-btn"><FaTimes /></button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WithdrawPage;