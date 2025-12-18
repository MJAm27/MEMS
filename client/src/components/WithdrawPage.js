import React, { useState } from 'react';
import { FaArrowLeft, FaLockOpen, FaTimesCircle, FaCheckCircle, FaMinus, FaPlus, FaCamera, FaTrash } from 'react-icons/fa';
import axios from 'axios'; // 🚨 ใช้ axios สำหรับเชื่อมต่อ API จริง
import './WithdrawPage.css';

// Mock Data สำหรับการจำลองผลลัพธ์การค้นหาอะไหล่ (ใช้ในการทดสอบก่อนเชื่อม DB จริง)
// ใน Production ข้อมูลนี้จะมาจาก API /api/withdraw/partInfo
const MOCK_PART_DATA = {
    'ABU-001': { partId: 'ABU-001', partName: 'Patient Valve (ABU-001)', sku: 'ABU-001', currentStock: 50, imageUrl: 'https://via.placeholder.com/100x100?text=ABU' },
    'BATT-001': { partId: 'BATT-001', partName: 'BATTERY 12V 7.2Ah', sku: 'BATT-001', currentStock: 40, imageUrl: 'https://via.placeholder.com/100x100?text=BATT' },
};

// ----------------------------------------------------------------------
// Configuration และ API Logic สำหรับ Production
// ----------------------------------------------------------------------

// const API_BASE_URL = 'http://localhost:3001/api/withdraw'; 

const realApi = {
    // 1. ดึงข้อมูลอะไหล่จาก DB
    fetchPartInfo: async (itemId) => {
        try {
            // ส่ง Part ID ไปค้นหาใน DB
            const response = await axios.post(`${REACT_APP_API_URL}/partInfo`, { partId: itemId });
            // API Backend (server.js) จะคืนค่า { partId, partName, currentStock, imageUrl, ...}
            return response.data;
        } catch (error) {
            const message = error.response?.data?.error || 'ไม่สามารถดึงข้อมูลอะไหล่ได้ (ตรวจสอบรหัส)';
            // ใช้ MOCK_PART_DATA เป็น fallback ในกรณีที่ Backend ยังไม่พร้อม (สามารถลบทิ้งได้เมื่อใช้งานจริง)
            const fallback = MOCK_PART_DATA[itemId];
            if (fallback) return fallback; 
            throw new Error(message);
        }
    },
    
    // 2. ยืนยันการเบิกและตัดสต็อกใน DB
    confirmAndCutStock: async (assetId, cart) => {
        const token = localStorage.getItem('token'); 
        if (!token) {
            throw new Error('ไม่พบ Token ผู้ใช้งาน, กรุณาล็อกอินใหม่');
        }

        try {
            const response = await axios.post(
                `${REACT_APP_API_URL}/confirm`, 
                { machine_SN: assetId, cartItems: cart }, // ส่งเลขครุภัณฑ์เครื่องจักรและรายการอะไหล่
                { 
                    headers: {
                        Authorization: `Bearer ${token}` // ส่ง Token เพื่อยืนยันตัวตน (authenticateToken)
                    }
                }
            );
            return response.data;
        } catch (error) {
            const message = error.response?.data?.error || 'เกิดข้อผิดพลาดในการยืนยันรายการ';
            throw new Error(message);
        }
    }
    
    // 3. (Optional) API สำหรับสั่งปิดประตูจริง
    /* closeDoor: async () => {
        const token = localStorage.getItem('token');
        await axios.get('http://localhost:3001/api/close', { 
            headers: { Authorization: `Bearer ${token}` } 
        });
    } */
};


// ⚠️ แก้ไข: รับ Prop 'user' โดยไม่มีค่าเริ่มต้น เพื่อใช้ข้อมูลของวิศวกรที่ล็อกอินมาจริง
function WithdrawPage({ user }) { 
    // ใช้ Fallback เพื่อป้องกัน Component พัง หาก Prop ยังไม่ถูกโหลด
    const activeUser = user || { fullname: 'กำลังโหลด...', employeeId: 'N/A' };

    const [currentStep, setCurrentStep] = useState(1);
    const [doorStatus, setDoorStatus] = useState({ state: 'closed', message: 'กรุณาเปิดตู้เพื่อเริ่ม' });
    const [currentPartId, setCurrentPartId] = useState(''); 
    const [assetId, setAssetId] = useState(''); 
    const [cartItems, setCartItems] = useState([]); 
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // ------------------------- Logic Handlers -------------------------

    const handleOpenDoor = async () => {
        setIsProcessing(true);
        setError('');
        try {
            // 🚨 ใน Production ควรเรียก API เปิดประตูจริง
            // await axios.get('http://localhost:3001/api/open');
            
            // ใช้ Mock สำหรับการทดสอบ UI/UX
            await new Promise((resolve) => setTimeout(resolve, 500)); 
            
            setDoorStatus({ state: 'open', message: 'ตู้เปิดแล้ว' });
            setCurrentStep(2); 
        } catch (err) {
            setDoorStatus({ state: 'error', message: 'การสั่งงานล้มเหลว' });
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddItemToCart = async (itemId, quantity = 1) => {
        itemId = itemId || currentPartId;
        
        if (!assetId) {
            setError('กรุณากรอกเลขครุภัณฑ์ของเครื่องจักรที่ต้องการซ่อม');
            return;
        }
        if (!itemId) {
            setError('กรุณากรอกหรือสแกนรหัสอะไหล่');
            return;
        }

        setIsProcessing(true);
        setError('');
        try {
            // ⚠️ ใช้ realApi ใน Production เพื่อเชื่อมต่อ DB
            const partInfo = await realApi.fetchPartInfo(itemId); 
            
            const existingIndex = cartItems.findIndex(item => item.partId === itemId);
            
            if (existingIndex !== -1) {
                setCartItems(prev => prev.map((item, index) => 
                    index === existingIndex ? { ...item, quantity: item.quantity + quantity } : item
                ));
            } else {
                setCartItems(prev => [...prev, { 
                    partId: partInfo.partId, 
                    partName: partInfo.partName, 
                    currentStock: partInfo.currentStock,
                    imageUrl: partInfo.imageUrl || 'https://via.placeholder.com/100x100?text=Part',
                    quantity: quantity
                }]);
            }

            setCurrentPartId(''); 
            
        } catch (err) {
            setError(err.message || 'ไม่พบอะไหล่หรือรหัสอะไหล่ไม่ถูกต้อง');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdateQuantity = (partId, change) => {
        setCartItems(prev => prev.map(item => {
            if (item.partId === partId) {
                const newQty = Math.max(1, item.quantity + change);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const handleRemoveItem = (partId) => {
        setCartItems(prev => prev.filter(item => item.partId !== partId));
    };


    const handleFinalConfirm = async () => {
        if (isProcessing || cartItems.length === 0) return;
        setIsProcessing(true);
        setError('');
        try {
            // ⚠️ ใช้ realApi ใน Production เพื่อตัดสต็อกและบันทึก Transaction
            const result = await realApi.confirmAndCutStock(assetId, cartItems);
            alert(`ยืนยันการเบิกสำเร็จ! Transaction ID: ${result.transactionId}`);
            
            // 🚨 สั่งปิดประตูจริง (ถ้ามี API)
            // await realApi.closeDoor();

            setDoorStatus({ state: 'closing', message: 'รายการถูกยืนยันแล้ว ปิดตู้...' });
            setCurrentStep(4);
            setAssetId('');
            setCartItems([]);
        } catch (err) {
            setError(err.message || 'เกิดข้อผิดพลาดในการตัดสต็อก');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCloseDoor = () => {
        alert("ตู้ถูกปิดและรายการเสร็จสมบูรณ์!");
        setCurrentStep(1); 
        setDoorStatus({ state: 'closed', message: 'กรุณาเปิดตู้เพื่อเริ่ม' });
        setAssetId('');
        setCartItems([]);
    };

    // ------------------------- Render Functions -------------------------

    const renderStep1_OpenDoor = () => (
        <div className="flex flex-col items-center justify-center text-center">
            <div className="status-icon-container mb-6">
                {doorStatus.state === 'open' ? (
                    <FaCheckCircle size={80} className="text-secondary-color" />
                ) : doorStatus.state === 'error' ? (
                    <FaTimesCircle size={80} className="text-red-500" />
                ) : (
                    <FaLockOpen size={80} className="text-pink-500" />
                )}
            </div>
            <h3 className="text-xl font-semibold mb-2 text-text-dark">ยืนยันการเปิดตู้</h3>
            <p className="text-text-muted mb-8">{doorStatus.message}</p>
            
            <button
                onClick={handleOpenDoor}
                disabled={isProcessing}
                className={`action-button-main ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500'}`}
            >
                {isProcessing ? 'กำลังสั่งงาน...' : 'เปิดตู้'}
            </button>
            {error && <p className="text-red-500 mt-3 text-sm">{error}</p>}
        </div>
    );

    const renderStep2_ScanInput = () => (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold text-text-dark mb-4">เบิกอะไหล่</h3>
            
            {/* ส่วนที่ 1: กรอกเลขครุภัณฑ์เครื่องจักร (Asset ID) */}
            <div className={`bg-background-gray p-4 rounded-lg shadow-inner ${!assetId ? 'border border-red-400' : ''}`}>
                <h4 className="font-semibold text-gray-700 mb-2">ข้อมูลอ้างอิง</h4>
                <div className="space-y-3">
                    <label className="text-sm font-medium text-text-dark block">เลขครุภัณฑ์เครื่องจักร (Asset ID)</label>
                    <input
                        type="text"
                        value={assetId}
                        onChange={(e) => {setAssetId(e.target.value); setError('');}}
                        placeholder="กรอกเลขครุภัณฑ์เครื่องจักรที่เสีย"
                        className="form-input"
                        disabled={isProcessing}
                    />
                </div>
                {!assetId && <p className="text-red-500 text-xs mt-2">**ต้องกรอกเลขครุภัณฑ์เครื่องจักรก่อนสแกน**</p>}
                <p className="text-xs text-text-muted mt-2">วันที่เบิก: {new Date().toLocaleDateString('th-TH')}</p>
            </div>

            {/* ส่วนที่ 2: สแกน/กรอก รหัสอะไหล่ (Part ID) */}
            <div className={`flex flex-col items-center border p-4 rounded-lg ${!assetId ? 'border-gray-200 bg-gray-100' : 'border-gray-200 bg-background-gray'}`}>
                <h4 className="font-semibold text-gray-700 mb-3">สแกน/เพิ่มรหัสอะไหล่ (Part ID)</h4>
                
                {assetId ? (
                    <div className="w-full">
                         <input
                            type="text"
                            value={currentPartId}
                            onChange={(e) => setCurrentPartId(e.target.value)}
                            placeholder="กรอกรหัสอะไหล่ (เช่น ABU-001 หรือ BATT-001)"
                            className="form-input mb-3"
                            disabled={isProcessing}
                        />
                        
                        <button
                            type="button"
                            onClick={() => {
                                // Logic: ถ้าช่องกรอกว่าง ให้ใช้ Mock ID เพื่อจำลองการสแกนสำเร็จ
                                const itemToUse = currentPartId || 'ABU-001'; 
                                handleAddItemToCart(itemToUse, 1);
                            }}
                            disabled={isProcessing || !assetId} 
                            className={`py-3 w-full flex items-center justify-center rounded-lg text-white font-bold transition duration-200 ${
                                isProcessing || !assetId ? 'bg-gray-400 cursor-not-allowed' : 'bg-pink-500 hover:bg-pink-600'
                            }`}
                        >
                            <FaCamera size={16} className="mr-2" /> 
                            {isProcessing ? 'กำลังประมวลผล...' : 'สแกน/เพิ่มรายการ'}
                        </button>
                        
                    </div>
                ) : (
                    <p className="text-red-600 text-sm">กรุณากรอกเลขครุภัณฑ์เครื่องจักรในส่วนบนก่อน</p>
                )}
            </div>
            
            {error && <p className="text-red-500 mt-2 text-sm flex items-center"><FaTimesCircle className="mr-1" /> {error}</p>}
        
            {/* รายการอะไหล่ที่สแกนแล้ว (Cart) - มีปุ่มปรับจำนวนในหน้านี้แล้ว */}
            <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="font-semibold text-lg text-text-dark mb-3">ตะกร้าเบิก ({cartItems.length} รายการ)</h4>
                {cartItems.length === 0 ? (
                    <p className="text-text-muted text-sm italic">ยังไม่มีรายการเบิก</p>
                ) : (
                    <div className="space-y-3 max-h-48 overflow-y-auto p-1">
                        {cartItems.map(item => (
                            <div key={item.partId} className="flex flex-col p-3 bg-white border rounded-lg shadow-sm">
                                
                                {/* รายละเอียดสินค้า */}
                                <div className="flex items-center mb-3">
                                    <img src={item.imageUrl} alt={item.partName} className="w-10 h-10 object-cover rounded mr-3" />
                                    <div className="flex-grow">
                                        <p className="text-sm font-medium">{item.partName}</p>
                                        <p className="text-xs text-text-muted">ID: {item.partId} | คงเหลือ: {item.currentStock}</p>
                                    </div>
                                    <button onClick={() => handleRemoveItem(item.partId)} className="text-red-500 hover:text-red-700 ml-2">
                                        <FaTrash size={14} />
                                    </button>
                                </div>

                                {/* ส่วนควบคุมจำนวน */}
                                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                    <span className="text-sm font-medium text-text-dark">จำนวนที่เบิก:</span>
                                    <div className="flex items-center text-lg font-bold text-pink-600">
                                        <button
                                            onClick={() => handleUpdateQuantity(item.partId, -1)}
                                            className="p-1 text-text-muted hover:text-pink-500"
                                            disabled={item.quantity <= 1 || isProcessing}
                                        >
                                            <FaMinus size={14} />
                                        </button>
                                        <span className="mx-3 w-8 text-center font-bold text-lg">{item.quantity}</span>
                                        <button
                                            onClick={() => handleUpdateQuantity(item.partId, 1)}
                                            className="p-1 text-text-muted hover:text-pink-500"
                                            disabled={isProcessing}
                                        >
                                            <FaPlus size={14} />
                                        </button>
                                    </div>
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* ปุ่มหลักสำหรับไป Step 3 (ยืนยัน) */}
            <button
                onClick={() => setCurrentStep(3)}
                disabled={cartItems.length === 0 || isProcessing || !assetId}
                className={`action-button-main ${
                    cartItems.length === 0 || isProcessing || !assetId ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500'
                }`}
            >
                ยืนยันการเบิก ({cartItems.length})
            </button>
        </div>
    );

    const renderStep3_Confirmation = () => (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold text-text-dark mb-4">สรุปและยืนยันรายการ</h3>
            
            {/* รายละเอียดการเบิก */}
            <div className="bg-background-gray p-4 rounded-lg shadow-inner">
                <p className="font-semibold text-gray-700">ผู้เบิก: {activeUser.fullname}</p>
                <p className="text-sm text-gray-500">เลขครุภัณฑ์เครื่องจักร: **{assetId || 'ไม่ได้ระบุ'}**</p>
                <p className="text-sm text-gray-500">วันที่: {new Date().toLocaleDateString('th-TH')}</p>
                <p className="text-sm font-semibold text-pink-600">รวม: {cartItems.length} รายการ</p>
            </div>
            
            {/* รายการในตะกร้าพร้อมปรับจำนวน */}
            <div className="space-y-4 max-h-80 overflow-y-auto">
                {cartItems.map(item => (
                    <div key={item.partId} className="p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center">
                                <img src={item.imageUrl} alt={item.partName} className="w-10 h-10 object-cover rounded mr-3" />
                                <div>
                                    <p className="font-semibold text-sm">{item.partName}</p>
                                    <p className="text-xs text-text-muted">รหัส: {item.partId}</p>
                                </div>
                            </div>
                            
                            <span className="font-bold text-lg text-pink-600">
                                {item.quantity} ชิ้น
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {error && <p className="text-red-500 mt-3 text-sm flex items-center"><FaTimesCircle className="mr-1" /> {error}</p>}

            <button
                onClick={handleFinalConfirm}
                disabled={isProcessing || cartItems.length === 0}
                className={`action-button-main ${
                    isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-pink-500'
                }`}
            >
                {isProcessing ? 'กำลังยืนยันและตัดสต็อก...' : 'ยืนยันรายการเบิกทั้งหมด'}
            </button>
            <button
                onClick={() => setCurrentStep(2)}
                className="w-full py-3 mt-3 rounded-full text-pink-500 font-bold bg-white border border-pink-500 hover:bg-pink-50"
            >
                ย้อนกลับไปแก้ไข
            </button>
        </div>
    );

    const renderStep4_CloseDoor = () => (
        <div className="flex flex-col items-center justify-center text-center">
            <div className="status-icon-container mb-6">
                <FaCheckCircle size={80} className="text-secondary-color" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-text-dark">รายการสำเร็จ</h3>
            <p className="text-text-muted mb-8">กรุณาปิดตู้เพื่อสิ้นสุดรายการ</p>
            
            <button
                onClick={handleCloseDoor}
                className="action-button-main bg-red-500"
            >
                ปิดตู้
            </button>
        </div>
    );


    // ------------------------- Main Render -------------------------
    return (
        <div className="withdraw-page-container">
            <div className="max-w-md mx-auto">
                <header className="withdraw-header flex items-center">
                    {currentStep !== 1 && currentStep !== 4 && (
                        <button onClick={() => setCurrentStep(currentStep === 3 ? 2 : 1)} className="mr-3">
                            <FaArrowLeft size={20} />
                        </button>
                    )}
                    <h1 className="text-lg font-bold flex-grow text-center">
                        {currentStep === 1 ? 'เปิดประตู' : 
                         currentStep === 2 ? 'เบิกอะไหล่ (สแกน/เพิ่ม)' : 
                         currentStep === 3 ? 'สรุปรายการเบิก' : 
                         'ปิดประตู'}
                    </h1>
                </header>
                
                <div className="withdraw-card">
                    {currentStep === 1 && renderStep1_OpenDoor()}
                    {currentStep === 2 && renderStep2_ScanInput()}
                    {currentStep === 3 && renderStep3_Confirmation()}
                    {currentStep === 4 && renderStep4_CloseDoor()}
                </div>
            </div>
        </div>
    );
}

export default WithdrawPage;