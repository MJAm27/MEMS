import React, { useState, useEffect ,useCallback} from 'react';
import { FaArrowLeft, FaLockOpen, FaCheckCircle, FaMinus, FaPlus, FaCamera, FaTrash, FaKeyboard } from 'react-icons/fa';
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';
import './WithdrawPage.css';

const realApi = {
    fetchPartInfo: async (itemId) => {
        try {
            const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/withdraw/partInfo`, { partId: itemId });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'ไม่พบข้อมูลอะไหล่');
        }
    },
    confirmAndCutStock: async (assetId, cart) => {
        const token = localStorage.getItem('token');
        try {
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL}/api/withdraw/confirm`, 
                { machine_SN: assetId, cartItems: cart },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'ยืนยันรายการล้มเหลว');
        }
    }
};

function WithdrawPage({ user }) { 
    const activeUser = user || { fullname: 'กำลังโหลด...', employeeId: 'N/A' };
    const [currentStep, setCurrentStep] = useState(1);
    const [doorStatus, setDoorStatus] = useState({ state: 'closed', message: 'กรุณาเปิดตู้เพื่อเริ่ม' });
    const [currentPartId, setCurrentPartId] = useState(''); 
    const [assetId, setAssetId] = useState(''); 
    const [cartItems, setCartItems] = useState([]); 
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showScanner, setShowScanner] = useState(false);

    const handleAddItemToCart = useCallback(async (itemId, quantity = 1) => {
        const idToSearch = itemId || currentPartId;
        if (!assetId) { setError('กรุณากรอกเลขครุภัณฑ์ก่อน'); return; }
        if (!idToSearch) { setError('กรุณาระบุรหัสอะไหล่'); return; }

        setIsProcessing(true);
        setError('');
        try {
            const partInfo = await realApi.fetchPartInfo(idToSearch); 
            setCartItems(prev => {
                const existing = prev.find(item => item.partId === partInfo.partId);
                if (existing) {
                    return prev.map(item => item.partId === partInfo.partId 
                        ? { ...item, quantity: item.quantity + quantity } : item);
                }
                return [...prev, { ...partInfo, quantity }];
            });
            setCurrentPartId(''); 
        } catch (err) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    }, [assetId, currentPartId]);
    
    // --- Logic สแกนเนอร์ ---
    useEffect(() => {
        let scanner = null;
        if (showScanner && currentStep === 2) {
            scanner = new Html5QrcodeScanner("reader", {
                fps: 20, // เพิ่มความเร็วในการสแกน
                qrbox: { width: 300, height: 150 }, // ปรับให้เหมาะกับ Barcode แนวยาว
                aspectRatio: 1.0,
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                }
            });

            scanner.render((decodedText) => {
                handleAddItemToCart(decodedText, 1);
                setShowScanner(false); // ปิดสแกนเนอร์เมื่อสแกนสำเร็จ
                scanner.clear();
            }, (err) => { /* scanning... */ });
        }

        return () => {
            if (scanner) {
                scanner.clear().catch(e => console.error("Scanner clear error", e));
            }
        };
    }, [showScanner, currentStep, handleAddItemToCart]);

    

    const handleOpenDoor = async () => {
        setIsProcessing(true);
        try {
            // จำลองการเปิดตู้ หรือส่ง API สั่งเปิด Servo ที่นี่
            await new Promise(r => setTimeout(r, 800)); 
            setDoorStatus({ state: 'open', message: 'ตู้เปิดแล้ว' });
            setCurrentStep(2); 
        } catch (err) { setError('เปิดตู้ล้มเหลว'); } finally { setIsProcessing(false); }
    };

    const handleUpdateQuantity = (partId, change) => {
        setCartItems(prev => prev.map(item => 
            item.partId === partId ? { ...item, quantity: Math.max(1, item.quantity + change) } : item
        ));
    };

    const handleFinalConfirm = async () => {
        setIsProcessing(true);
        try {
            const result = await realApi.confirmAndCutStock(assetId, cartItems);
            alert(`เบิกสำเร็จ! ID: ${result.transactionId || 'Success'}`);
            setCurrentStep(4);
        } catch (err) { setError(err.message); } finally { setIsProcessing(false); }
    };

    // --- Render Functions (เหมือนเดิม) ---
    const renderStep1_OpenDoor = () => (
        <div className="flex flex-col items-center py-10">
            <div className="mb-6">
                {doorStatus.state === 'open' ? <FaCheckCircle size={80} className="text-green-500" /> : <FaLockOpen size={80} className="text-pink-500" />}
            </div>
            <h3 className="text-xl font-bold mb-2">เข้าใช้งานตู้สแตนบาย</h3>
            <p className="text-gray-500 mb-8">{doorStatus.message}</p>
            <button onClick={handleOpenDoor} disabled={isProcessing} className="action-button-main bg-green-500">
                {isProcessing ? 'กำลังประมวลผล...' : 'เปิดตู้'}
            </button>
        </div>
    );

    const renderStep2_ScanInput = () => (
        <div className="space-y-5">
            <div className={`p-4 rounded-xl bg-gray-50 border-2 ${!assetId ? 'border-red-200' : 'border-transparent'}`}>
                <label className="text-xs font-bold text-gray-400 uppercase">เลขครุภัณฑ์เครื่องจักร (Asset ID)</label>
                <input type="text" value={assetId} onChange={(e) => setAssetId(e.target.value)} placeholder="ระบุเลขเครื่องที่ซ่อม" className="w-full bg-transparent text-lg font-semibold focus:outline-none" />
            </div>
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-4">
                {showScanner ? (
                    <div className="flex flex-col items-center">
                        <div id="reader" className="w-full rounded-lg overflow-hidden border-2 border-pink-500"></div>
                        <button onClick={() => setShowScanner(false)} className="mt-4 text-red-500 font-bold">ยกเลิก</button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <button onClick={() => assetId ? setShowScanner(true) : setError('กรุณากรอกเลขครุภัณฑ์ก่อน')} className="w-full py-6 bg-pink-500 text-white rounded-xl shadow-lg shadow-pink-200 flex flex-col items-center justify-center space-y-2">
                            <FaCamera size={30} />
                            <span className="font-bold text-lg">สแกน Barcode/QR</span>
                        </button>
                        <div className="flex items-center space-x-2">
                            <div className="flex-grow p-3 bg-gray-100 rounded-lg flex items-center">
                                <FaKeyboard className="text-gray-400 mr-2" />
                                <input type="text" value={currentPartId} onChange={(e) => setCurrentPartId(e.target.value)} placeholder="หรือพิมพ์รหัส..." className="bg-transparent focus:outline-none flex-grow" />
                            </div>
                            <button onClick={() => handleAddItemToCart()} className="p-3 bg-gray-800 text-white rounded-lg"><FaPlus /></button>
                        </div>
                    </div>
                )}
            </div>
            {error && <p className="text-red-500 text-center text-sm font-medium">{error}</p>}
            <div className="mt-4">
                <h4 className="font-bold mb-3 flex justify-between"><span>รายการที่สแกน</span><span className="text-pink-500">{cartItems.length} รายการ</span></h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {cartItems.map(item => (
                        <div key={item.partId} className="flex items-center p-3 bg-white border rounded-xl">
                            <img src={item.imageUrl} className="w-12 h-12 rounded-lg object-cover" alt="" />
                            <div className="ml-3 flex-grow">
                                <p className="text-sm font-bold">{item.partName}</p>
                                <div className="flex items-center space-x-3 mt-1">
                                    <button onClick={() => handleUpdateQuantity(item.partId, -1)} className="text-gray-400"><FaMinus size={12}/></button>
                                    <span className="font-bold">{item.quantity}</span>
                                    <button onClick={() => handleUpdateQuantity(item.partId, 1)} className="text-gray-400"><FaPlus size={12}/></button>
                                </div>
                            </div>
                            <button onClick={() => setCartItems(c => c.filter(i => i.partId !== item.partId))} className="text-red-300 px-2"><FaTrash/></button>
                        </div>
                    ))}
                </div>
            </div>
            {cartItems.length > 0 && <button onClick={() => setCurrentStep(3)} className="action-button-main bg-green-500 w-full mt-4">ไปที่หน้าสรุปรายการ</button>}
        </div>
    );

    const renderStep3_Confirmation = () => (
        <div className="space-y-6">
            <div className="bg-gray-800 text-white p-5 rounded-2xl">
                <p className="opacity-70 text-sm">ผู้เบิก: {activeUser.fullname}</p>
                <p className="text-xl font-bold mt-1">เครื่องจักร: {assetId}</p>
            </div>
            <div className="space-y-3">
                {cartItems.map(item => (
                    <div key={item.partId} className="flex justify-between items-center p-4 bg-white border-b">
                        <div><p className="font-bold">{item.partName}</p><p className="text-xs text-gray-400">ID: {item.partId}</p></div>
                        <p className="text-lg font-bold text-pink-500">x {item.quantity}</p>
                    </div>
                ))}
            </div>
            <button onClick={handleFinalConfirm} disabled={isProcessing} className="action-button-main bg-pink-500 w-full">{isProcessing ? 'กำลังยืนยัน...' : 'ยืนยันและตัดสต็อก'}</button>
            <button onClick={() => setCurrentStep(2)} className="w-full text-gray-400 font-bold">ย้อนกลับ</button>
        </div>
    );

    return (
        <div className="withdraw-page-container bg-gray-50 min-h-screen pb-10">
            <div className="max-w-md mx-auto px-4">
                <header className="py-6 flex items-center">
                    {[2, 3].includes(currentStep) && <button onClick={() => setCurrentStep(currentStep - 1)} className="p-2 bg-white rounded-full shadow-sm"><FaArrowLeft /></button>}
                    <h1 className="flex-grow text-center text-xl font-black">{currentStep === 1 ? 'OPEN DOOR' : currentStep === 2 ? 'SCAN PARTS' : currentStep === 3 ? 'CONFIRM' : 'FINISH'}</h1>
                </header>
                <div className="withdraw-card bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
                    {currentStep === 1 && renderStep1_OpenDoor()}
                    {currentStep === 2 && renderStep2_ScanInput()}
                    {currentStep === 3 && renderStep3_Confirmation()}
                    {currentStep === 4 && (
                        <div className="text-center py-10">
                            <FaCheckCircle size={80} className="text-green-500 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold">สำเร็จ!</h2>
                            <p className="text-gray-500 mb-6">บันทึกข้อมูลและตัดสต็อกเรียบร้อย</p>
                            <button onClick={() => window.location.reload()} className="action-button-main bg-gray-800">กลับหน้าหลัก</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default WithdrawPage;