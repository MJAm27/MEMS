import React, { useState, useEffect, useCallback } from 'react';
import { FaLockOpen, FaCheckCircle, FaPlus, FaCamera, FaTrash, FaUser, FaMinus, FaLock, FaClipboardCheck, FaListUl } from 'react-icons/fa'; 
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';
import './WithdrawPage.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function WithdrawPage({ user }) { 
    const activeUser = user || { fullname: 'ผู้ใช้งาน', employeeId: 'N/A' };
    
    const [currentStep, setCurrentStep] = useState(1);
    const [assetId, setAssetId] = useState('');
    const [currentPartId, setCurrentPartId] = useState('');
    const [cartItems, setCartItems] = useState([]);
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showScanner, setShowScanner] = useState(false);

    const [machineSuggestions, setMachineSuggestions] = useState([]);
    const [partSuggestions, setPartSuggestions] = useState([]);

    // --- 1. ฟังก์ชันควบคุมประตู (ESP8266) ---

    // สั่งเปิดประตูใน Step 1
    const handleOpenDoor = async () => {
        setIsProcessing(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            await axios.get(`${API_BASE}/api/open`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            setCurrentStep(2); // ไปต่อ Step 2 เมื่อเปิดสำเร็จ
        } catch (err) {
            setError('ไม่สามารถติดต่อตู้เพื่อเปิดได้ กรุณาตรวจสอบการเชื่อมต่อ ESP8266');
        } finally {
            setIsProcessing(false);
        }
    };

    // สั่งปิดประตูใน Step 5
    const handleCloseDoor = async () => {
        setIsProcessing(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE}/api/close-box`, {}, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            window.location.reload(); // รีโหลดหน้าเพื่อจบกระบวนการ
        } catch (err) {
            setError('คำสั่งปิดประตูขัดข้อง กรุณาลองใหม่อีกครั้ง');
        } finally {
            setIsProcessing(false);
        }
    };

    // --- 2. ระบบจัดการข้อมูลอะไหล่และตะกร้า ---

    const handleMachineSearch = async (val) => {
        setAssetId(val);
        if (val.length > 1) {
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
        if (val.length > 1) {
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
                return [...prev, { ...partInfo, lotId: partInfo.lotId, partId: partInfo.partId || partInfo.equipment_id, quantity: quantity }];
            });
            setCurrentPartId('');
            setPartSuggestions([]);
        } catch (err) {
            setError('ไม่พบข้อมูลอะไหล่');
        } finally {
            setIsProcessing(false);
        }
    }, [assetId, currentPartId]);

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
            setCurrentStep(5); // บันทึก DB สำเร็จแล้วไป Step 5 เพื่อปิดตู้
        } catch (err) {
            setError('เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐานข้อมูล');
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

    // --- 3. Render Stepper ---
    const renderStepIndicator = () => (
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
    );

    return (
        <div className="withdraw-page-container">
            <div className="user-badge-info mb-4 flex items-center gap-2 text-gray-500">
                <FaUser size={12} /> {activeUser.fullname}
            </div>
            
            <div className="withdraw-title-section text-center">
                <h2 className="text-2xl font-bold">เบิกอะไหล่</h2>
                {renderStepIndicator()}
            </div>
            
            <div className="withdraw-card mt-6">
                {/* STEP 1: เปิดตู้ */}
                {currentStep === 1 && (
                    <div className="text-center py-6 animate-fadeIn">
                        <div className="status-icon-wrapper mb-6"><FaLockOpen size={50} className="text-pink-500" /></div>
                        <h3 className="step-title font-bold text-2xl">1. เปิดประตูกล่อง</h3>
                        <p className="step-desc text-gray-400 mb-8">กรุณากดปุ่มด้านล่างเพื่อปลดล็อกและเริ่มการเบิก</p>
                        <button 
                            onClick={handleOpenDoor} 
                            disabled={isProcessing}
                            className="btn-action btn-open-gate"
                        >
                            {isProcessing ? <span className="loader"></span> : <><FaLockOpen /> เปิดประตูตู้</>}
                        </button>
                        {error && <p className="error-msg text-red-500 text-sm mt-4">{error}</p>}
                    </div>
                )}

                {/* STEP 2: เลือกอะไหล่ */}
                {currentStep === 2 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold">2. ระบุอะไหล่</h3>
                        <input type="text" className="withdraw-input" value={assetId} onChange={(e) => handleMachineSearch(e.target.value)} placeholder="เลขครุภัณฑ์ (Asset ID)" />
                        {machineSuggestions.length > 0 && (
                            <ul className="search-suggestions">
                                {machineSuggestions.map(m => <li key={m.machine_SN} onClick={() => { setAssetId(m.machine_SN); setMachineSuggestions([]); }}>{m.machine_SN} - {m.machine_name}</li>)}
                            </ul>
                        )}
                        <div className="scanner-section">
                            {showScanner ? <div id="reader"></div> : <button onClick={() => setShowScanner(true)} className="btn-action main-action-btn secondary mb-3"><FaCamera /> สแกนบาร์โค้ดอะไหล่</button>}
                        </div>
                        <div className="flex gap-2">
                            <input type="text" className="withdraw-input flex-grow" value={currentPartId} onChange={(e) => handlePartSearch(e.target.value)} placeholder="รหัสอะไหล่..." />
                            <button onClick={() => handleAddItemToCart()} className="px-4 bg-pink-500 text-white rounded-xl"><FaPlus /></button>
                        </div>
                        {cartItems.length > 0 && (
                            <div className="mt-4 border-t pt-4">
                                <h4 className="text-sm font-bold mb-2">ตะกร้าอะไหล่:</h4>
                                {cartItems.map((item, idx) => (
                                    <div key={idx} className="cart-item-card flex justify-between items-center p-3 bg-gray-50 rounded-lg mb-2">
                                        <div className="text-sm"><b>{item.partName}</b><br/><span className="text-xs text-gray-400">Lot: {item.lotId}</span></div>
                                        <div className="flex items-center gap-3">
                                            <div className="qty-control flex items-center gap-2">
                                                <button onClick={() => updateItemQuantity(idx, -1)}><FaMinus size={10}/></button>
                                                <span>{item.quantity}</span>
                                                <button onClick={() => updateItemQuantity(idx, 1)}><FaPlus size={10}/></button>
                                            </div>
                                            <button onClick={() => setCartItems(cartItems.filter((_, i) => i !== idx))} className="text-red-400"><FaTrash size={12}/></button>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={() => setCurrentStep(3)} className="action-button-main mt-4">ตรวจสอบรายการ</button>
                            </div>
                        )}
                        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                    </div>
                )}

                {/* STEP 3: ตรวจสอบรายการ (Review) */}
                {currentStep === 3 && (
                    <div className="space-y-4">
                        <div className="text-center"><FaListUl size={30} className="mx-auto text-gray-400 mb-2"/><h3 className="text-xl font-bold">3. ตรวจสอบข้อมูล</h3></div>
                        <div className="bg-gray-100 p-4 rounded-xl">
                            <p className="text-xs text-gray-500">ครุภัณฑ์:</p>
                            <p className="text-lg font-bold">{assetId}</p>
                        </div>
                        <div className="space-y-2 border-y py-3 max-h-40 overflow-y-auto">
                            {cartItems.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-sm">
                                    <span>{item.partName}</span>
                                    <span className="font-bold">x{item.quantity}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentStep(2)} className="flex-1 py-3 bg-gray-200 rounded-xl">แก้ไข</button>
                            <button onClick={() => setCurrentStep(4)} className="flex-1 py-3 bg-pink-500 text-white rounded-xl">ไปหน้าบันทึก</button>
                        </div>
                    </div>
                )}

                {/* STEP 4: ยืนยันการเบิก (Confirm DB) */}
                {currentStep === 4 && (
                    <div className="text-center py-4 space-y-6 animate-fadeIn">
                        <FaClipboardCheck size={60} className="mx-auto text-blue-500 mb-2" />
                        <h3 className="text-2xl font-bold">4. ยืนยันการบันทึก</h3>
                        <div className="summary-box bg-blue-50 p-6 rounded-3xl border border-blue-100 text-left">
                            <p className="text-xs text-blue-600 font-bold uppercase mb-1">สรุปการทำรายการ</p>
                            <p className="text-sm text-gray-700"><b>เลขเครื่อง:</b> {assetId}</p>
                            <p className="text-sm text-gray-700"><b>รายการ:</b> {cartItems.length} อะไหล่</p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setCurrentStep(3)} className="btn-secondary">กลับ</button>
                            <button onClick={handleFinalConfirm} disabled={isProcessing} className="btn-action btn-confirm-save flex-2">
                                {isProcessing ? <span className="loader"></span> : 'ยืนยันการบันทึก'}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 5: ปิดตู้ (Servo Close) */}
                {currentStep === 5 && (
                    <div className="text-center py-6 animate-fadeIn">
                        <div className="success-badge bg-green-100 text-green-700 p-4 rounded-2xl mb-8 flex items-center gap-3 justify-center">
                            <FaCheckCircle size={24} /> <p className="font-bold">บันทึกข้อมูลสำเร็จ!</p>
                        </div>
                        <h3 className="text-2xl font-bold mb-3">5. สั่งปิดประตู</h3>
                        <p className="text-gray-500 mb-8">ตรวจสอบสิ่งกีดขวางแล้วกดปุ่มเพื่อล็อกตู้</p>
                        <button 
                            onClick={handleCloseDoor} 
                            disabled={isProcessing} 
                            className="btn-action btn-close-lock"
                        >
                            <FaLock /> {isProcessing ? <span className="loader"></span> : 'สั่งปิดประตูกล่อง'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default WithdrawPage;