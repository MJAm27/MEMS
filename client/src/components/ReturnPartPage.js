import React, { useState, useEffect, useCallback } from "react";
import { FaQrcode, FaBoxOpen, FaSyncAlt, FaArrowLeft } from "react-icons/fa"; 
import { Html5QrcodeScanner } from 'html5-qrcode';
import './ReturnPartPage.css'; 
import axios from "axios";

// --- Component ย่อย: InputAndScanScreen (หน้าจอเลือกวันที่และสแกน) ---
const InputAndScanScreen = ({ onScanComplete, onCancelReturn, initialDate, onBackToList }) => {
    const [isScanning, setIsScanning] = useState(false); 
    const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10));

    // แก้ไข: ใช้ useCallback และตรวจสอบตัวแปร date ให้ถูกต้อง
    const handleScanSuccess = useCallback((scannedData) => {
        setIsScanning(false);
        onScanComplete({ ...scannedData, date: date });
    }, [date, onScanComplete]);

    // Logic ควบคุมกล้องสแกน
    useEffect(() => {
        let scanner = null;
        if (isScanning) {
            scanner = new Html5QrcodeScanner("reader", {
                fps: 10,
                qrbox: { width: 250, height: 250 },
            });

            scanner.render((decodedText) => {
                // ส่งข้อมูลที่สแกนได้ไปยัง handleScanSuccess
                handleScanSuccess({ 
                    lotId: decodedText, 
                    equipmentId: decodedText, 
                    equipmentName: `อะไหล่รหัส ${decodedText}`, 
                    quantity: 1, 
                    img: "https://via.placeholder.com/100x100?text=Part" 
                });
                scanner.clear();
            }, (err) => { /* scanning... */ });
        }
        return () => { if (scanner) scanner.clear().catch(e => {}); };
    }, [isScanning, handleScanSuccess]); // เพิ่ม handleScanSuccess เป็น dependency

    if (isScanning) {
        return (
            <div className="p-4 flex flex-col items-center">
                <h2 className="text-xl font-bold mb-4 text-gray-700">สแกน QR Code/Barcode</h2>
                <div id="reader" className="w-full rounded-xl overflow-hidden border-2 border-pink-500 shadow-lg"></div>
                <button 
                    onClick={() => setIsScanning(false)}
                    className="mt-6 w-full py-3 bg-gray-500 text-white rounded-lg font-bold"
                >
                    ยกเลิกการสแกน
                </button>
            </div>
        );
    }
    
    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-6 text-gray-700 flex items-center">
                <FaSyncAlt className="mr-2 text-pink-500"/> คืนอะไหล่
            </h2>
            
            {initialDate && (
                <button
                    onClick={onBackToList}
                    className="mb-4 text-sm text-pink-600 hover:text-pink-800 flex items-center font-bold"
                >
                    <FaArrowLeft className="mr-1"/> กลับไปหน้ารายการ ({date})
                </button>
            )}

            <div className="mb-8 bg-white p-4 rounded-lg shadow-sm">
                <label className="block text-sm font-bold text-gray-500 uppercase mb-1">วันที่คืน</label>
                <input 
                    type="date" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)}
                    disabled={!!initialDate} 
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm p-3 focus:ring-pink-500 
                                ${initialDate ? 'bg-gray-100 cursor-not-allowed text-gray-400' : 'bg-white'}`}
                />
            </div>
            
            <button 
                onClick={() => setIsScanning(true)}
                className="w-full mb-4 px-4 py-4 text-white font-bold rounded-xl transition-all shadow-lg
                           flex items-center justify-center bg-pink-500 hover:bg-pink-600 active:scale-95"
            >
                <FaQrcode className="mr-2 text-xl" /> เปิดกล้องสแกนเพื่อคืน
            </button>
            
            <button 
                onClick={onCancelReturn}
                className="w-full px-4 py-2 text-gray-400 font-semibold hover:text-red-500 transition-colors"
            >
                ยกเลิกรายการทั้งหมด
            </button>
        </div>
    );
};

// --- Component ย่อย: ConfirmationScreen (ยืนยันรายการคืน) ---
const ConfirmationScreen = ({ returnItems, onConfirmReturn, onScanMore, onCancelReturn }) => {
    const [items, setItems] = useState(returnItems); 
    const [loading, setLoading] = useState(false);
    
    const updateQuantity = (lotId, newQuantity) => {
        setItems(prevItems => prevItems.map(item => 
            item.lotId === lotId 
                ? { ...item, quantity: Math.max(1, parseInt(newQuantity) || 1) } 
                : item
        ));
    };

    const handleConfirm = async () => {
        setLoading(true);
        const payload = {
            returnDate: items[0].date, 
            items: items.map(item => ({
                equipmentId: item.equipmentId,
                lotId: item.lotId,
                quantity: item.quantity,
            })),
        };

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${process.env.REACT_APP_API_URL}/api/return-part`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(`✅ บันทึกการคืนอะไหล่สำเร็จ!`);
            onConfirmReturn(); 
        } catch (error) {
            alert(`❌ ข้อผิดพลาด: ${error.response?.data?.error || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'}`);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-4 text-gray-700">ยืนยันการคืน ({items.length} รายการ)</h2>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto mb-6">
                {items.map((item) => (
                    <div key={item.lotId} className="p-4 border rounded-xl bg-white shadow-sm flex items-center">
                        <img src={item.img} alt="" className="w-16 h-16 object-cover rounded-lg mr-4 border" />
                        <div className="flex-grow">
                            <p className="font-bold text-gray-800 leading-tight">{item.equipmentName}</p>
                            <p className="text-xs text-gray-400 mb-2">Lot: {item.lotId}</p>
                            <div className="flex items-center">
                                <span className="text-sm mr-2 text-gray-500">จำนวน:</span>
                                <input 
                                    type="number" 
                                    value={item.quantity} 
                                    onChange={(e) => updateQuantity(item.lotId, e.target.value)}
                                    className="w-16 border rounded p-1 text-center font-bold"
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="space-y-3">
                <button onClick={onScanMore} className="w-full py-3 border-2 border-pink-500 text-pink-500 font-bold rounded-xl flex items-center justify-center">
                    <FaQrcode className="mr-2" /> สแกนเพิ่ม
                </button>
                <div className="flex space-x-3">
                    <button onClick={onCancelReturn} className="flex-1 py-3 bg-gray-200 text-gray-600 font-bold rounded-xl">ยกเลิก</button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={loading}
                        className={`flex-1 py-3 text-white font-bold rounded-xl shadow-lg ${loading ? 'bg-gray-400' : 'bg-green-500'}`}
                    >
                        {loading ? 'กำลังบันทึก...' : 'ยืนยันการคืน'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Component หลัก: ReturnPartPage ---
function ReturnPartPage() {
    const [step, setStep] = useState(1); 
    const [returnItems, setReturnItems] = useState([]); 

    const resetFlow = () => {
        setStep(1);
        setReturnItems([]);
    };

    const handleScanComplete = (lotData) => {
        const existingItemIndex = returnItems.findIndex(item => item.lotId === lotData.lotId);
        if (existingItemIndex > -1) {
            const updatedItems = [...returnItems];
            updatedItems[existingItemIndex].quantity += lotData.quantity;
            setReturnItems(updatedItems);
        } else {
            setReturnItems([...returnItems, lotData]);
        }
        setStep(2);
    };

    return (
        <div className="return-page-container min-h-screen bg-gray-50">
            <header className="bg-white p-4 shadow-sm border-b-2 border-pink-500">
                <h1 className="text-lg font-black text-pink-600 flex items-center justify-center uppercase tracking-wider">
                    <FaBoxOpen className="mr-2"/> Return Parts System
                </h1>
            </header>
            <div className="p-4 max-w-md mx-auto">
                {step === 1 ? (
                    <InputAndScanScreen 
                        onScanComplete={handleScanComplete} 
                        onCancelReturn={resetFlow} 
                        initialDate={returnItems.length > 0 ? returnItems[0].date : null}
                        onBackToList={() => setStep(2)} 
                    />
                ) : (
                    <ConfirmationScreen 
                        returnItems={returnItems} 
                        onConfirmReturn={resetFlow} 
                        onCancelReturn={resetFlow} 
                        onScanMore={() => setStep(1)} 
                    />
                )}
            </div>
        </div>
    );
}

export default ReturnPartPage;