import React, { useState, useEffect, useCallback } from 'react';
import { FaLockOpen, FaCheckCircle, FaPlus, FaCamera, FaTrash, FaUser, FaMinus } from 'react-icons/fa'; 
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';
import './WithdrawPage.css';

const API_BASE = process.env.REACT_APP_API_URL;

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
            const response = await axios.post(`${API_BASE}/api/withdraw/confirm`, payload, { headers: { Authorization: `Bearer ${token}` } });
            if (response.data.success) setCurrentStep(4); 
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
                        <div className="step-circle">{currentStep > step ? <FaCheckCircle /> : step}</div>
                    </div>
                    {step < 3 && <div className={`step-line ${currentStep > step ? 'active' : ''}`}></div>}
                </React.Fragment>
            ))}
        </div>
    );

    const renderStep2_ScanInput = () => (
        <div className="space-y-4">
            <div className="form-input-group relative mb-4">
                <label className="text-sm text-gray-400 block mb-2">เลขครุภัณฑ์ (Asset ID)</label>
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
            
            <div className="scanner-section mb-3">
                {showScanner ? (
                    <div className="scanner-box">
                        <div id="reader"></div>
                        <button onClick={() => setShowScanner(false)} className="btn-cancel w-full py-2 mt-2">ยกเลิกสแกน</button>
                    </div>
                ) : (
                    /* ปรับปุ่มให้เหมือนหน้า ReturnPage */
                    <button onClick={() => setShowScanner(true)} className="main-action-btn secondary mb-3 flex items-center justify-center gap-2">
                        <FaCamera /> สแกนบาร์โค้ดอะไหล่
                    </button>
                )}
            </div>

            <div className="form-input-group relative">
                <div className="flex gap-2">
                    <input type="text" className="withdraw-input flex-grow" value={currentPartId} 
                        onChange={(e) => handlePartSearch(e.target.value)} placeholder="รหัสอะไหล่..." />
                    <button onClick={() => handleAddItemToCart()} className="add-btn px-4 bg-gray-100 rounded-xl"><FaPlus /></button>
                </div>
                {partSuggestions.length > 0 && (
                    <ul className="search-suggestions">
                        {partSuggestions.map(p => (
                            <li key={p.equipment_id} onClick={() => { handleAddItemToCart(p.equipment_id); setPartSuggestions([]); }}>
                                <strong>{p.equipment_id}</strong> - {p.equipment_name}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {cartItems.length > 0 && (
                <div className="cart-section mt-6">
                    <h4 className="section-label mb-3">รายการที่เลือกแล้ว:</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                        {cartItems.map((item, index) => (
                            <div key={index} className="cart-item-card">
                                <img src={item.img ? `${API_BASE}/uploads/${item.img}` : "https://via.placeholder.com/60"} 
                                    alt="" className="cart-item-image" onError={(e) => e.target.src="https://via.placeholder.com/60"} />
                                <div className="flex-grow">
                                    <span className="item-name block font-semibold">{item.partName}</span>
                                    <span className="item-lot text-xs text-gray-400">Lot: {item.lotId}</span>
                                </div>
                                <div className="qty-control flex items-center gap-2">
                                    <button onClick={() => updateItemQuantity(index, -1)} className="p-1"><FaMinus size={10}/></button>
                                    <span className="font-bold">{item.quantity}</span>
                                    <button onClick={() => updateItemQuantity(index, 1)} className="p-1"><FaPlus size={10}/></button>
                                </div>
                                <button onClick={() => setCartItems(cartItems.filter((_, i) => i !== index))} className="delete-btn ml-2 text-red-400">
                                    <FaTrash size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setCurrentStep(3)} className="action-button-main mt-4">สรุปรายการเบิก</button>
                </div>
            )}
            {error && <p className="error-msg text-red-500 text-sm mt-2">{error}</p>}
        </div>
    );

    return (
        <div className="withdraw-page-container">
            <div className="user-badge-info mb-4 text-sm text-gray-500 flex items-center gap-2">
                <FaUser size={12} /> {activeUser.fullname} ({activeUser.employeeId})
            </div>
            <div className="withdraw-title-section">
                <h2>เบิกอะไหล่</h2>
                {renderStepIndicator()}
            </div>
            <div className="withdraw-card">
                {currentStep === 1 && (
                    <div className="text-center">
                        <div className="status-icon-wrapper mb-4"><FaLockOpen size={45} color="#ff4d94" /></div>
                        <h3 className="step-title font-bold text-lg">ขั้นตอนที่ 1: เปิดประตูกล่อง</h3>
                        <p className="step-desc text-gray-400 mb-6">กรุณากดปุ่มเพื่อเปิดกล่องและเตรียมการเบิก</p>
                        <button onClick={() => setCurrentStep(2)} className="action-button-main">
                            เปิดประตูตู้
                        </button>
                    </div>
                )}
                {currentStep === 2 && renderStep2_ScanInput()}
                {currentStep === 3 && (
                    <div className="space-y-4">
                        <div className="p-4 bg-gray-800 text-white rounded-2xl">
                            <p className="text-sm opacity-70">เลขครุภัณฑ์:</p>
                            <p className="text-lg font-bold text-pink-400">{assetId}</p>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                            {cartItems.map((item, index) => (
                                <div key={index} className="cart-item-card">
                                    <div className="flex-grow">
                                        <span className="item-name block">{item.partName}</span>
                                        <span className="item-lot text-xs">Lot: {item.lotId}</span>
                                    </div>
                                    <span className="font-black text-pink-500 text-lg">x {item.quantity}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setCurrentStep(2)} className="btn-cancel py-3 flex-1">แก้ไข</button>
                            <button onClick={handleFinalConfirm} disabled={isProcessing} className="action-button-main flex-1">
                                {isProcessing ? 'กำลังบันทึก...' : 'ยืนยันการเบิก'}
                            </button>
                        </div>
                    </div>
                )}
                {currentStep === 4 && (
                    <div className="success-animation text-center py-6">
                        <FaCheckCircle size={70} className="text-green-500 mx-auto mb-4" />
                        <h3 className="font-bold text-xl">สำเร็จเรียบร้อย!</h3>
                        <p className="text-gray-400 text-sm mt-2">บันทึกรายการโดย: {activeUser.fullname}</p>
                        <button onClick={() => window.location.reload()} className="action-button-main mt-8">กลับหน้าหลัก</button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default WithdrawPage;