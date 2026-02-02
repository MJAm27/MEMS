import React, { useState, useEffect, useCallback } from 'react';
import { FaLockOpen, FaCheckCircle, FaPlus, FaCamera, FaTrash, FaUser } from 'react-icons/fa'; // เพิ่ม FaUser
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';
import './WithdrawPage.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function WithdrawPage({ user }) { 
    // แก้ไข: เตรียมข้อมูลผู้ใช้
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
        if (!assetId) { 
            setError('กรุณากรอกเลขครุภัณฑ์ก่อน (Asset ID)'); 
            return; 
        }
        if (!idToSearch) { setError('กรุณาระบุรหัสอะไหล่'); return; }

        setIsProcessing(true);
        setError('');
        try {
            const response = await axios.post(`${API_BASE}/api/withdraw/partInfo`, { partId: idToSearch });
            const partInfo = response.data;

            setCartItems(prev => {
                const existing = prev.find(item => item.lotId === partInfo.lotId);
                if (existing) {
                    return prev.map(item => item.lotId === partInfo.lotId 
                        ? { ...item, quantity: item.quantity + quantity } : item);
                }
                return [...prev, { 
                    ...partInfo, 
                    lotId: partInfo.lotId, 
                    partId: partInfo.partId || partInfo.equipment_id, 
                    quantity: quantity 
                }];
            });
            setCurrentPartId('');
            setPartSuggestions([]);
        } catch (err) {
            setError(err.response?.data?.error || 'ไม่พบข้อมูลอะไหล่');
        } finally {
            setIsProcessing(false);
        }
    }, [assetId, currentPartId]);

    useEffect(() => {
        let scanner = null;
        if (showScanner && currentStep === 2) {
            scanner = new Html5QrcodeScanner("reader", {
                fps: 10, qrbox: { width: 350, height: 150 },
                aspectRatio: 1.0, experimentalFeatures: { useBarCodeDetectorIfSupported: true }
            });
            scanner.render((decodedText) => {
                handleAddItemToCart(decodedText, 1);
                setShowScanner(false);
                scanner.clear();
            }, (err) => {});
        }
        return () => { if (scanner) scanner.clear().catch(e => {}); };
    }, [showScanner, currentStep, handleAddItemToCart]);

    const handleFinalConfirm = async () => {
        if (cartItems.length === 0) {
            setError("กรุณาเลือกอะไหล่อย่างน้อย 1 รายการ");
            return;
        }

        setIsProcessing(true);
        setError("");

        try {
            const token = localStorage.getItem('token');

            const payload = { 
                machine_SN: assetId, 
                cartItems: cartItems.map(item => ({
                    lotId: item.lotId,
                    partId: item.partId , 
                    quantity: item.quantity
                }))
            };

            const response = await axios.post(`${API_BASE}/api/withdraw/confirm`, 
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setCurrentStep(4); 
            }
        } catch (err) {
            setError(err.response?.data?.error || 'ยืนยันรายการล้มเหลว');
        } finally {
            setIsProcessing(false);
        }
    };

    const renderStepIndicator = () => (
        <div className="step-progress-bar">
            {[1, 2, 3].map((step) => (
                <React.Fragment key={step}>
                    <div className={`step-item ${currentStep >= step ? 'active' : ''}`}>
                        <div className="step-circle">
                            {currentStep > step ? <FaCheckCircle /> : step}
                        </div>
                    </div>
                    {step < 3 && (
                        <div className={`step-line ${currentStep > step ? 'active' : ''}`}></div>
                    )}
                </React.Fragment>
            ))}
        </div>
    );

    const renderStep1_OpenDoor = () => (
        <div className="text-center">
            <div className="status-icon-wrapper"><FaLockOpen size={45} /></div>
            <h3 className="step-title">ขั้นตอนที่ 1: เปิดประตูกล่อง</h3>
            <p className="step-desc">กรุณากดปุ่มเพื่อเปิดกล่องและเตรียมการเบิก</p>
            <button onClick={() => setCurrentStep(2)} className="action-button-main">
                {isProcessing ? 'กำลังประมวลผล...' : 'เปิดประตูตู้'}
            </button>
        </div>
    );

    const renderStep2_ScanInput = () => (
        <div className="space-y-4">
            <div className="form-input-group relative">
                <label>เลขครุภัณฑ์ (Asset ID)</label>
                <input type="text" className="withdraw-input" value={assetId} 
                    onChange={(e) => handleMachineSearch(e.target.value)} placeholder="ค้นหาเลขเครื่อง..." />
                {machineSuggestions.length > 0 && (
                    <ul className="search-suggestions">
                        {machineSuggestions.map(m => (
                            <li key={m.machine_SN} onClick={() => { setAssetId(m.machine_SN); setMachineSuggestions([]); }}>
                                <strong>{m.machine_SN}</strong> - {m.machine_name}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            
            <div className="scanner-section">
                {showScanner ? (
                    <div id="reader" className="scanner-box"></div>
                ) : (
                    <button onClick={() => setShowScanner(true)} className="scanner-toggle">
                        <FaCamera /> สแกนบาร์โค้ดอะไหล่
                    </button>
                )}
            </div>

            <div className="form-input-group relative">
                <div className="flex gap-2">
                    <input type="text" className="withdraw-input flex-grow" value={currentPartId} 
                        onChange={(e) => handlePartSearch(e.target.value)} placeholder="ค้นหาหรือพิมพ์รหัสอะไหล่..." />
                    <button onClick={() => handleAddItemToCart()} className="add-btn"><FaPlus /></button>
                </div>
                {partSuggestions.length > 0 && (
                    <ul className="search-suggestions">
                        {partSuggestions.map(p => (
                            <li key={p.equipment_id} onClick={() => { handleAddItemToCart(p.equipment_id); setPartSuggestions([]); }}>
                                <strong>{p.equipment_id}</strong> - {p.equipment_name} ({p.model_size})
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {cartItems.length > 0 && (
                <div className="cart-section">
                    <h4 className="section-label">รายการที่เลือกแล้ว:</h4>
                    <div className="space-y-3">
                        {cartItems.map((item, index) => (
                            <div key={index} className="cart-item-card">
                                <img src={item.img ? `${API_BASE}/uploads/${item.img}` : "/default-part.png"} 
                                    alt={item.partName} className="cart-item-image" 
                                    onError={(e) => { e.target.src = "https://via.placeholder.com/60"; }} />
                                <div className="flex-grow">
                                    <span className="item-name">{item.partName}</span>
                                    <span className="item-lot">Lot: {item.lotId}</span>
                                </div>
                                <div className="qty-control">
                                    <button onClick={() => updateItemQuantity(index, -1)} className="qty-btn">-</button>
                                    <span className="qty-val">{item.quantity}</span>
                                    <button onClick={() => updateItemQuantity(index, 1)} className="qty-btn">+</button>
                                </div>
                                <button onClick={() => setCartItems(cartItems.filter((_, i) => i !== index))} className="delete-btn">
                                    <FaTrash size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setCurrentStep(3)} className="action-button-main mt-4">สรุปรายการเบิก</button>
                </div>
            )}
            {error && <p className="error-msg">{error}</p>}
        </div>
    );

    const renderStep3_Confirmation = () => (
        <div className="space-y-4">
            <div className="p-4 bg-gray-800 text-white rounded-2xl shadow-md">
                <p className="text-lg font-bold flex items-center gap-2">
                    <span className="text-pink-400">เลขครุภัณฑ์:</span> {assetId}
                </p>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
                {cartItems.map((item, index) => (
                    <div key={index} className="cart-item-card">
                        <img src={item.img ? `${API_BASE}/uploads/${item.img}` : "https://via.placeholder.com/60"} 
                            className="cart-item-image" alt={item.partName} />
                        <div className="flex-grow">
                            <span className="item-name">{item.partName}</span>
                            <span className="item-lot text-xs">Lot: {item.lotId}</span>
                        </div>
                        <span className="font-black text-pink-500 text-lg">x {item.quantity}</span>
                    </div>
                ))}
            </div>
            <div className="flex-button-group">
                <button onClick={() => { if(window.confirm("ยกเลิกรายการ?")) { setCartItems([]); setCurrentStep(2); } }} className="btn-cancel">
                    ยกเลิก
                </button>
                <button onClick={handleFinalConfirm} disabled={isProcessing} className="action-button-main">
                    ยืนยันการเบิก
                </button>
            </div>
        </div>
    );

    return (
        <div className="withdraw-page-container">
            {/* แก้ไข: เพิ่มส่วนแสดงข้อมูล User เพื่อใช้งานตัวแปร activeUser */}
            <div className="user-badge-info">
                <FaUser size={12} /> {activeUser.fullname} ({activeUser.employeeId})
            </div>

            <div className="withdraw-title-section">
                <h2>เบิกอะไหล่</h2>
                {renderStepIndicator()}
            </div>
            <div className="withdraw-card">
                {currentStep === 1 && renderStep1_OpenDoor()}
                {currentStep === 2 && renderStep2_ScanInput()}
                {currentStep === 3 && renderStep3_Confirmation()}
                {currentStep === 4 && (
                    <div className="success-animation text-center py-6">
                        <FaCheckCircle size={70} className="check-icon text-green-500 mx-auto mb-4" />
                        <h3 className="font-bold text-xl">สำเร็จเรียบร้อย!</h3>
                        <p className="text-gray-400 text-sm">บันทึกรายการโดย: {activeUser.fullname}</p>
                        <button onClick={() => window.location.reload()} className="action-button-main mt-6">กลับหน้าหลัก</button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default WithdrawPage;