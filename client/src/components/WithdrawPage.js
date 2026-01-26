import React, { useState, useEffect, useCallback } from 'react';
import { FaLockOpen, FaCheckCircle,  FaPlus, FaCamera } from 'react-icons/fa';
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';
import './WithdrawPage.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function WithdrawPage({ user }) { 
    const activeUser = user || { fullname: 'กำลังโหลด...', employeeId: 'N/A' };
    const [currentStep, setCurrentStep] = useState(1);
    const [assetId, setAssetId] = useState('');
    const [currentPartId, setCurrentPartId] = useState('');
    const [cartItems, setCartItems] = useState([]);
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showScanner, setShowScanner] = useState(false);

    // --- State สำหรับระบบช่วยค้นหา (Autocomplete) ---
    const [machineSuggestions, setMachineSuggestions] = useState([]);
    const [partSuggestions, setPartSuggestions] = useState([]);

    // 1. ฟังก์ชันค้นหาเลขครุภัณฑ์
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

    // 2. ฟังก์ชันค้นหาอะไหล่
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

    // 3. ฟังก์ชันเพิ่มของลงตะกร้า (รองรับทั้งสแกนและเลือกจากลิสต์)
    const handleAddItemToCart = useCallback(async (itemId, quantity = 1) => {
        const idToSearch = itemId || currentPartId;
        if (!assetId) { setError('กรุณากรอกเลขครุภัณฑ์ก่อน'); return; }
        if (!idToSearch) { setError('กรุณาระบุรหัสอะไหล่'); return; }

        setIsProcessing(true);
        setError('');
        try {
            const response = await axios.post(`${API_BASE}/api/withdraw/partInfo`, { partId: idToSearch });
            const partInfo = response.data;
            
            setCartItems(prev => {
                const existing = prev.find(item => item.partId === partInfo.partId);
                if (existing) {
                    return prev.map(item => item.partId === partInfo.partId 
                        ? { ...item, quantity: item.quantity + quantity } : item);
                }
                return [...prev, { ...partInfo, quantity }];
            });
            setCurrentPartId('');
            setPartSuggestions([]);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setIsProcessing(false);
        }
    }, [assetId, currentPartId]);

    // --- Logic สแกนเนอร์ ---
    useEffect(() => {
        let scanner = null;
        if (showScanner && currentStep === 2) {
            scanner = new Html5QrcodeScanner("reader", {
                fps: 20, qrbox: { width: 300, height: 150 },
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
        setIsProcessing(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE}/api/withdraw/confirm`, 
                { machine_SN: assetId, cartItems },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setCurrentStep(4);
        } catch (err) { setError(err.response?.data?.error || 'ยืนยันรายการล้มเหลว'); } 
        finally { setIsProcessing(false); }
    };

    // --- Render Functions ---

    const renderStep1_OpenDoor = () => (
        <div className="text-center">
            <div className="status-icon-wrapper"><FaLockOpen size={50} className="text-pink-500" /></div>
            <h3>ขั้นตอนที่ 1: เปิดประตูตู้</h3>
            <p className="text-gray-500 mb-6">กรุณากดปุ่มเพื่อเปิดตู้สแตนบาย</p>
            <button onClick={() => setCurrentStep(2)} className="action-button-main bg-pink-500">
                {isProcessing ? 'กำลังประมวลผล...' : 'เปิดประตูตู้'}
            </button>
        </div>
    );

    const renderStep2_ScanInput = () => (
        <div className="space-y-4">
            <div className="form-input-group relative">
                <label>เลขครุภัณฑ์ (Asset ID)</label>
                <input type="text" className="withdraw-input" value={assetId} 
                    onChange={(e) => handleMachineSearch(e.target.value)} placeholder="พิมพ์เพื่อค้นหาเลขเครื่อง..." />
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
            
            <div className="bg-gray-50 p-4 rounded-2xl border-2 border-dashed border-gray-200">
                {showScanner ? (
                    <div id="reader" className="w-full rounded-lg overflow-hidden border-2 border-pink-500"></div>
                ) : (
                    <button onClick={() => setShowScanner(true)} className="w-full py-4 text-pink-500 font-bold flex items-center justify-center gap-2">
                        <FaCamera /> สแกนบาร์โค้ดอะไหล่
                    </button>
                )}
            </div>

            <div className="form-input-group relative mt-4">
                <div className="flex gap-2">
                    <input type="text" className="withdraw-input flex-grow" value={currentPartId} 
                        onChange={(e) => handlePartSearch(e.target.value)} placeholder="ค้นหาหรือพิมพ์รหัสอะไหล่..." />
                    <button onClick={() => handleAddItemToCart()} className="p-4 bg-gray-800 text-white rounded-xl"><FaPlus /></button>
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
                <button onClick={() => setCurrentStep(3)} className="action-button-main bg-green-500">ถัดไป: สรุปรายการ</button>
            )}
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        </div>
    );

    const renderStep3_Confirmation = () => (
        <div className="space-y-4">
            <div className="p-4 bg-gray-800 text-white rounded-2xl">
                <p className="text-xs opacity-70">ผู้เบิก: {activeUser.fullname}</p>
                <p className="text-lg font-bold">เครื่องจักร: {assetId}</p>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
                {cartItems.map(item => (
                    <div key={item.partId} className="flex justify-between items-center p-3 bg-white border rounded-xl">
                        <span className="text-sm font-medium">{item.partName}</span>
                        <span className="font-bold text-pink-500">x {item.quantity}</span>
                    </div>
                ))}
            </div>
            <button onClick={handleFinalConfirm} disabled={isProcessing} className="action-button-main bg-pink-500">
                {isProcessing ? 'กำลังยืนยัน...' : 'ยืนยันและตัดสต็อก'}
            </button>
        </div>
    );

    return (
        <div className="withdraw-page-container">
            <div className="withdraw-title-section">
                <h2>เบิกอะไหล่</h2>
                <p>ทำรายการตามขั้นตอนเพื่อตัดสต็อกอัตโนมัติ</p>
            </div>
            <div className="withdraw-card">
                {currentStep === 1 && renderStep1_OpenDoor()}
                {currentStep === 2 && renderStep2_ScanInput()}
                {currentStep === 3 && renderStep3_Confirmation()}
                {currentStep === 4 && (
                    <div className="text-center py-6">
                        <FaCheckCircle size={70} className="text-green-500 mb-4 mx-auto" />
                        <h3 className="font-bold">สำเร็จเรียบร้อย!</h3>
                        <button onClick={() => window.location.reload()} className="action-button-main bg-gray-800">กลับหน้าหลัก</button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default WithdrawPage;