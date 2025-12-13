import React, { useState } from "react";
import ScannerComponent from './ScannerComponent'; // ⭐ นำเข้า ScannerComponent ที่สร้างใหม่
// นำเข้าไอคอนที่เกี่ยวข้องกับการคืนอะไหล่และการแสดงผล
import { FaQrcode, FaBoxOpen, FaSyncAlt, FaArrowLeft } from "react-icons/fa"; 
import './ReturnPartPage.css'; 
import axios from "axios"; // นำเข้า axios สำหรับเรียก API จริง

// --- URL Backend (แก้ไขให้ตรงกับ Port ของคุณ) ---
const API_URL = "http://localhost:3001"; 
// ------------------------------------------------


// --- Component ย่อย: InputAndScanScreen (เปลี่ยนชื่อเป็น ScannerScreen เพื่อให้ชัดเจนขึ้น) ---
const InputAndScanScreen = ({ onScanComplete, onCancelReturn, initialDate, onBackToList }) => {
    // State สำหรับควบคุมการเปิดกล้องสแกน
    const [isScanning, setIsScanning] = useState(false); 
    
    // ใช้ initialDate ถ้ามีค่า, ไม่เช่นนั้นใช้ วันที่ปัจจุบัน
    const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10));

    const handleScanSuccess = (scannedData) => {
        setIsScanning(false);
        // ส่งข้อมูลที่สแกนได้จริง พร้อมวันที่คืน ไปยัง Component หลัก
        onScanComplete({ ...scannedData, date: date }); 
    };

    const handleScanError = (error) => {
        setIsScanning(false);
        alert(`❌ ข้อผิดพลาดในการเข้าถึงกล้อง: ${error.message || 'ไม่ทราบสาเหตุ'}`);
    };

    // ⭐ Logic การแสดงผล Scanner Component
    if (isScanning) {
        return (
            <div className="p-4">
                <h2 className="text-xl font-bold mb-4 text-gray-700">สแกน QR Code/Barcode</h2>
                <ScannerComponent 
                    onScanSuccess={handleScanSuccess} 
                    onError={handleScanError}
                    onCancelScan={() => setIsScanning(false)} // ปุ่มยกเลิก
                />
            </div>
        );
    }
    
    // ⭐ Logic การแสดงผล Input/ปุ่มสแกน (เมื่อ isScanning = false)
    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-6 text-gray-700 flex items-center">
                <FaSyncAlt className="mr-2"/> คืนอะไหล่
            </h2>
            
            {/* ปุ่มย้อนกลับไปรายการ หากมีการสแกนแล้ว */}
            {initialDate && (
                <button
                    onClick={onBackToList}
                    className="mb-4 text-sm text-pink-600 hover:text-pink-800 flex items-center"
                >
                    <FaArrowLeft className="mr-1"/> กลับไปหน้ารายการ ({date})
                </button>
            )}

            {/* ส่วนเลือกวันที่คืน - ถูกปิดการใช้งานหากมีการสแกนแล้ว */}
            <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700">วันที่คืน</label>
                <input 
                    type="date" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)}
                    disabled={!!initialDate} 
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 
                                focus:border-pink-500 focus:ring-pink-500 text-gray-700 
                                ${initialDate ? 'bg-gray-200 cursor-not-allowed' : 'bg-white'}`}
                />
            </div>
            
            {/* ปุ่มหลัก: สแกน - กดแล้วตั้งค่า isScanning = true */}
            <button 
                onClick={() => setIsScanning(true)} // ⭐ เปิด Scanner
                className="w-full mb-4 px-4 py-2 text-white font-semibold rounded-lg transition-colors 
                           flex items-center justify-center scan-btn bg-pink-500 hover:bg-pink-600"
            >
                <FaQrcode className="mr-2" /> สแกนสำหรับคืน
            </button>
            
            {/* ปุ่มรอง: ยกเลิกการคืน */}
            <button 
                onClick={() => {
                    alert("คลิก: ยกเลิกการคืนทั้งหมด");
                    onCancelReturn(); // ยกเลิกและรีเซ็ต
                }}
                className="w-full px-4 py-2 text-white font-semibold rounded-lg 
                           bg-red-500 hover:bg-red-600 transition-colors"
            >
                ยกเลิกการคืนทั้งหมด
            </button>
        </div>
    );
};

// --- Component ย่อย: ConfirmationScreen (ยืนยันรายการคืน) ---
const ConfirmationScreen = ({ returnItems, onConfirmReturn, onScanMore, onCancelReturn }) => {
    const [items, setItems] = useState(returnItems); 
    
    // อัปเดตรายการเมื่อมีการเปลี่ยน quantity
    const updateQuantity = (lotId, newQuantity) => {
        setItems(prevItems => prevItems.map(item => 
            item.lotId === lotId 
                ? { ...item, quantity: Math.max(1, parseInt(newQuantity) || 1) } 
                : item
        ));
    };

    const handleConfirm = async () => {
        const payload = {
            userId: 'U-4572742117',
            returnDate: items[0].date, 
            items: items.map(item => ({
                equipmentId: item.equipmentId,
                lotId: item.lotId,
                quantity: item.quantity,
            })),
        };

        try {
            await axios.post(`${API_URL}/api/return-part`, payload);
            
            alert(`✅ การคืนอะไหล่ ${items.length} รายการถูกบันทึกในระบบเรียบร้อยแล้ว!`);
            onConfirmReturn(); 
        } catch (error) {
            console.error('Error confirming return:', error);
            alert(`❌ ข้อผิดพลาดในการบันทึกการคืน: ${error.response?.data?.error || 'Server Error'}`);
        }
    };
    
    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-4 text-gray-700">ยืนยันการคืนอะไหล่ ({items.length} รายการ)</h2>
            
            {items.map((item, index) => (
                <div key={item.lotId} className="p-4 confirmation-card border rounded-lg shadow-md bg-white mb-4">
                    {/* ข้อมูลรายการที่สแกนมา */}
                    <p className="font-semibold text-lg mb-2">{item.equipmentName}</p>
                    <p className="text-sm text-gray-600">Lot ID: {item.lotId}</p>
                    {index === 0 && <p className="text-sm text-gray-600 mb-4">วันที่คืน: {item.date}</p>}

                    <div className="flex items-center space-x-4">
                        {/* จำลองรูปภาพอะไหล่ */}
                        <img src={`/${item.img}`} alt={item.equipmentName} className="w-16 h-16 object-cover rounded border" />
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700">จำนวนที่คืน:</label>
                            <input 
                                type="number" 
                                min="1"
                                value={item.quantity} 
                                onChange={(e) => updateQuantity(item.lotId, e.target.value)}
                                className="w-20 text-center border rounded-md p-1 mt-1 focus:border-green-600 focus:ring-green-600"
                            />
                        </div>
                    </div>
                </div>
            ))}


            <div className="mt-6 flex flex-col space-y-4">
                {/* ปุ่มใหม่: สแกนเพิ่ม */}
                <button 
                    onClick={onScanMore} 
                    className="w-full px-4 py-2 text-white font-semibold rounded-lg bg-pink-500 hover:bg-pink-600 transition-colors flex items-center justify-center"
                >
                    <FaQrcode className="mr-2" /> สแกนอะไหล่เพิ่ม
                </button>
                
                <div className="flex justify-between space-x-4">
                    {/* ปุ่มยกเลิกทั้งหมด */}
                    <button 
                        onClick={onCancelReturn}
                        className="flex-1 px-4 py-2 text-white font-semibold rounded-lg bg-red-500 hover:bg-red-600"
                    >
                        ยกเลิกทั้งหมด
                    </button>
                    {/* ปุ่มยืนยันการคืน */}
                    <button 
                        onClick={handleConfirm}
                        className="flex-1 px-4 py-2 text-white font-semibold rounded-lg bg-green-500 hover:bg-green-600"
                    >
                        ยืนยันการคืน ({items.length} รายการ)
                    </button>
                </div>
            </div>
        </div>
    );
};


// ------------------------------------------------------------------
// 📌 Component หลัก: ReturnPartPage
// ------------------------------------------------------------------

function ReturnPartPage() {
    // Step 1: สแกน, Step 2: ยืนยันรายการ
    const [step, setStep] = useState(1); 
    const [returnItems, setReturnItems] = useState([]); 

    const resetFlow = () => {
        setStep(1);
        setReturnItems([]);
    };

    const handleScanComplete = (lotData) => {
        // ตรวจสอบว่ามี Lot ID นี้อยู่แล้วหรือไม่ (เพื่อรวมจำนวน)
        const existingItemIndex = returnItems.findIndex(item => item.lotId === lotData.lotId);

        if (existingItemIndex > -1) {
            // หากซ้ำ: เพิ่มจำนวนเข้าไป
            const updatedItems = [...returnItems];
            updatedItems[existingItemIndex].quantity += lotData.quantity;
            setReturnItems(updatedItems);
            alert(`รายการ Lot ID: ${lotData.lotId} ถูกรวมจำนวนแล้ว`);
        } else {
            // หากเป็นรายการใหม่: เพิ่มเข้าไปในรายการ
            setReturnItems([...returnItems, lotData]);
        }
        
        setStep(2); // ไปสู่ขั้นตอนยืนยัน
    };

    const renderStep = () => {
        const initialDate = returnItems.length > 0 ? returnItems[0].date : null;

        switch (step) {
            case 1: // สแกน (InputAndScanScreen)
                return (
                    <InputAndScanScreen 
                        onScanComplete={handleScanComplete} 
                        onCancelReturn={resetFlow} 
                        initialDate={initialDate}
                        onBackToList={() => setStep(2)} 
                    />
                );
            case 2: // ยืนยันรายการ (ConfirmationScreen)
                if (returnItems.length === 0) {
                    setStep(1);
                    return null;
                }
                return (
                    <ConfirmationScreen 
                        returnItems={returnItems} 
                        onConfirmReturn={resetFlow} 
                        onCancelReturn={resetFlow} 
                        onScanMore={() => setStep(1)} 
                    />
                );
            default:
                return <InputAndScanScreen onScanComplete={handleScanComplete} onCancelReturn={resetFlow} />;
        }
    };

    return (
        <div className="return-page-container min-h-screen bg-gray-50">
            <div className="bg-gradient-to-r from-pink-500 to-pink-700 p-4 shadow-lg">
                <h1 className="text-xl font-bold text-white flex items-center">
                    <FaBoxOpen className="mr-2"/> ขั้นตอนการคืนอะไหล่ (Step {step}/2)
                </h1>
            </div>
            <div className="p-4 max-w-md mx-auto">
                {renderStep()}
            </div>
            <div className="text-center text-sm text-gray-500 mt-4 p-4">
                หมายเหตุ: ระบบรองรับการสแกนหลายรายการใน Transaction เดียว
            </div>
        </div>
    );
}

export default ReturnPartPage;