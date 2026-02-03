import React, { useState, useEffect, useCallback } from "react";
import { FaCheckCircle, FaCamera, FaLockOpen, FaPlus, FaMinus, FaTrash } from "react-icons/fa"; 
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from "axios";
import './BorrowPage.css'; 

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function BorrowPage({ user }) {
    const [currentStep, setCurrentStep] = useState(1); 
    const [borrowDate, setBorrowDate] = useState(new Date().toISOString().slice(0, 10));
    const [borrowItems, setBorrowItems] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [manualPartId, setManualPartId] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // ขั้นตอนที่ 1: สั่งเปิดประตูตู้ผ่าน API
    const handleOpenDoor = async () => {
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            await axios.get(`${API_BASE}/api/open`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCurrentStep(2); 
        } catch (err) {
            setError(err.response?.data?.error || 'ไม่สามารถเชื่อมต่อกับกล่องกุญแจได้');
        } finally {
            setLoading(false);
        }
    };

    // ค้นหาข้อมูลอะไหล่เพื่อเพิ่มลงรายการ
    const handleAddItem = useCallback(async (scannedId, quantity = 1) => {
        const idToSearch = scannedId || manualPartId;
        if (!idToSearch) return;

        setError('');
        try {
            const response = await axios.post(`${API_BASE}/api/withdraw/partInfo`, { partId: idToSearch });
            const partInfo = response.data;

            setBorrowItems(prev => {
                const existing = prev.find(item => item.lotId === partInfo.lotId);
                if (existing) {
                    return prev.map(item => item.lotId === partInfo.lotId 
                        ? { ...item, quantity: item.quantity + quantity } : item);
                }
                return [...prev, { 
                    ...partInfo, 
                    partId: partInfo.partId || partInfo.equipment_id,
                    quantity: quantity 
                }];
            });
            setManualPartId('');
            setIsScanning(false);
        } catch (err) {
            setError('ไม่พบข้อมูลอะไหล่รหัสนี้ในระบบ');
        }
    }, [manualPartId]);

    // จัดการระบบ Scanner
    useEffect(() => {
        let scanner = null;
        if (isScanning) {
            scanner = new Html5QrcodeScanner("reader", {
                fps: 10, qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            });
            scanner.render((decodedText) => {
                handleAddItem(decodedText);
                scanner.clear();
            }, (err) => {});
        }
        return () => { if (scanner) scanner.clear().catch(e => {}); };
    }, [isScanning, handleAddItem]);

    // ขั้นตอนสุดท้าย: บันทึกรายการยืมล่วงหน้า (Status: Pending)
    const handleFinalConfirm = async () => {
        if (borrowItems.length === 0) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            // ส่งไป API สำหรับบันทึกรายการ Pending เพื่อไปโชว์ที่หน้าหลัก
            await axios.post(`${API_BASE}/api/borrow/pending`, {
                userId: user.user_id,
                borrowDate: borrowDate,
                items: borrowItems.map(item => ({
                    equipmentId: item.partId,
                    lotId: item.lotId,
                    quantity: item.quantity
                }))
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            setCurrentStep(4);
        } catch (err) {
            setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกรายการยืม');
        } finally {
            setLoading(false);
        }
    };

    const updateQty = (index, delta) => {
        setBorrowItems(prev => prev.map((item, i) => 
            i === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
        ));
    };

    return (
        <div className="return-page-container"> {/* ใช้ Class เดิมจาก CSS เพื่อความคงเส้นคงวา */}
            <div className="return-header-section">
                <h2>เบิกอะไหล่ล่วงหน้า</h2>
                <div className="step-progress-bar">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className={`step-item ${currentStep >= s ? 'active' : ''}`}>
                            <div className="step-number">{currentStep > s ? <FaCheckCircle /> : s}</div>
                            {s < 3 && <div className="step-line"></div>}
                        </div>
                    ))}
                </div>
            </div>

            <div className="return-card">
                {/* Step 1: เปิดประตูตู้ */}
                {currentStep === 1 && (
                    <div className="step-content animate-fade text-center">
                        <div className="status-icon-wrapper"><FaLockOpen size={50} color="#ff4d94" /></div>
                        <h3 className="step-title">ขั้นตอนที่ 1: ปลดล็อคตู้</h3>
                        <p className="step-desc">กดปุ่มเพื่อเปิดกล่องกุญแจและเริ่มการหยิบอะไหล่</p>
                        <div className="info-box mt-4 text-left">
                            <label>วันที่เบิกยืม</label>
                            <input type="date" value={borrowDate} onChange={(e) => setBorrowDate(e.target.value)} />
                        </div>
                        <button onClick={handleOpenDoor} disabled={loading} className="main-action-btn primary mt-4">
                            {loading ? 'กำลังสื่อสารกับตู้...' : 'เปิดประตูตู้ตอนนี้'}
                        </button>
                    </div>
                )}

                {/* Step 2: สแกน/เพิ่มรายการอะไหล่ */}
                {currentStep === 2 && (
                    <div className="step-content animate-fade">
                        <div className="scanner-section mb-4">
                            {isScanning ? (
                                <div className="scanner-box">
                                    <div id="reader"></div>
                                    <button onClick={() => setIsScanning(false)} className="cancel-btn mt-2">ยกเลิกสแกน</button>
                                </div>
                            ) : (
                                <button onClick={() => setIsScanning(true)} className="main-action-btn secondary mb-3">
                                    <FaCamera className="mr-2" /> สแกนบาร์โค้ดอะไหล่
                                </button>
                            )}
                        </div>

                        <div className="manual-input-group flex gap-2 mb-4">
                            <input 
                                type="text" 
                                className="withdraw-input flex-grow" 
                                value={manualPartId} 
                                onChange={(e) => setManualPartId(e.target.value)}
                                placeholder="กรอกรหัสอะไหล่..." 
                            />
                            <button onClick={() => handleAddItem()} className="add-btn"><FaPlus /></button>
                        </div>

                        {error && <p className="error-text mb-4">{error}</p>}

                        {borrowItems.length > 0 && (
                            <div className="mt-6">
                                <h4 className="section-label">รายการที่หยิบจากตู้:</h4>
                                <div className="items-list max-h-64 overflow-y-auto mb-4">
                                    {borrowItems.map((item, index) => (
                                        <div key={index} className="part-item-card">
                                            <img src={item.imageUrl} alt="" onError={(e) => e.target.src="https://via.placeholder.com/60"} />
                                            <div className="item-info">
                                                <span className="name">{item.partName}</span>
                                                <span className="lot text-xs text-gray-400">Lot: {item.lotId}</span>
                                            </div>
                                            <div className="qty-control">
                                                <button onClick={() => updateQty(index, -1)}><FaMinus size={10}/></button>
                                                <span className="qty-number">{item.quantity}</span>
                                                <button onClick={() => updateQty(index, 1)}><FaPlus size={10}/></button>
                                            </div>
                                            <button className="del-btn text-red-400 ml-2" onClick={() => setBorrowItems(borrowItems.filter((_, i) => i !== index))}>
                                                <FaTrash size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => setCurrentStep(3)} className="main-action-btn primary w-full">ตรวจสอบรายการ</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: สรุปรายการเพื่อส่งไปหน้าหลัก */}
                {currentStep === 3 && (
                    <div className="step-content animate-fade">
                        <h3 className="confirm-title text-center font-bold mb-4">ยืนยันรายการเบิกล่วงหน้า</h3>
                        <div className="summary-box bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300">
                            {borrowItems.map((item, i) => (
                                <div key={i} className="flex justify-between border-b border-gray-200 py-2 text-sm last:border-0">
                                    <span>{item.partName} <br/><small className="text-gray-400">Lot: {item.lotId}</small></span>
                                    <span className="font-bold text-pink-500">x {item.quantity}</span>
                                </div>
                            ))}
                        </div>
                        <div className="button-group mt-6 flex gap-3">
                            <button onClick={() => setCurrentStep(2)} className="secondary-btn flex-1 py-3 bg-gray-100 rounded-xl font-bold">แก้ไข</button>
                            <button onClick={handleFinalConfirm} disabled={loading} className="main-action-btn primary flex-1">
                                {loading ? 'กำลังบันทึก...' : 'ยืนยันการเบิกยืม'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: สำเร็จ */}
                {currentStep === 4 && (
                    <div className="success-screen text-center py-6 animate-bounce-in">
                        <FaCheckCircle size={70} className="text-green-500 mb-4 mx-auto" />
                        <h3 className="font-bold text-xl text-gray-800">บันทึกรายการยืมสำเร็จ!</h3>
                        <p className="text-gray-500 text-sm mt-2">กรุณาไปที่หน้าหลักเพื่อระบุเลขครุภัณฑ์หลังใช้งานเสร็จ</p>
                        <button onClick={() => window.location.href = "/dashboard/engineer/home"} className="main-action-btn primary mt-8">ไปที่หน้าหลัก</button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default BorrowPage;