import React, { useState } from 'react';
import { QrReader } from 'react-qr-reader';
// axios ไม่จำเป็นต้อง import ที่นี่ เพราะการเรียก API จะทำใน ReturnPartPage

const ScannerComponent = ({ onScanSuccess, onError, onCancelScan }) => {
    const [scanning, setScanning] = useState(true);

    const handleResult = (result) => {
        if (result && scanning) {
            setScanning(false); // หยุดการสแกน
            const scannedId = result.text;
            
            // ⭐ หมายเหตุสำคัญ: ในโค้ดจริง คุณต้องเรียก API Backend
            // เพื่อนำ scannedId ไปค้นหาข้อมูลอะไหล่ที่ครบถ้วนจาก DB

            // จำลองข้อมูลอะไหล่ที่ถูกดึงมาจาก Backend
            const mockApiData = {
                lotId: scannedId,
                equipmentId: 'EXTE-001-1', 
                equipmentName: 'Extension Dinap V (Actual Scan)', 
                quantity: 1, // เริ่มต้นที่ 1 ชิ้นจากการสแกน 1 ครั้ง
                img: 'placeholder.png', 
            };
            
            onScanSuccess(mockApiData);
        }
    };

    const handleError = (err) => {
        console.error("Scanner Error:", err);
        // สามารถแสดงข้อความ Error ที่ชัดเจนขึ้นให้ผู้ใช้เห็นได้
        onError(err);
    };

    if (!scanning) return (
        <div className="text-center p-6 border rounded-lg bg-green-50 text-green-700">
            สแกนสำเร็จแล้ว!
        </div>
    );

    return (
        <div className="flex flex-col items-center">
            <p className="text-center text-sm text-gray-500 mb-4">โปรดวาง QR Code/Barcode ให้อยู่ในกรอบ</p>
            <div style={{ width: '100%', maxWidth: '300px', margin: 'auto' }}>
                <QrReader
                    onResult={(result, error) => {
                        if (!!result) {
                            handleResult(result);
                        }
                        if (!!error) {
                            handleError(error);
                        }
                    }}
                    scanDelay={300}
                    constraints={{ facingMode: "environment" }} // ใช้กล้องหลัง
                />
            </div>
            
            <button 
                onClick={onCancelScan}
                className="mt-4 px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors"
            >
                ยกเลิกการสแกน
            </button>
        </div>
    );
};

export default ScannerComponent;