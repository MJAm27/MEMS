import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom"; 
import { FaCheckCircle, FaCamera, FaLockOpen, FaPlus, FaMinus, FaTrash, FaLock, FaClipboardCheck} from "react-icons/fa"; 
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from "axios";
import './ReturnPartPage.css'; 

const API_BASE = process.env.REACT_APP_API_URL;

function ReturnPartPage() {
    const location = useLocation(); 
    const [currentStep, setCurrentStep] = useState(1); 
    const [returnDate] = useState(() => { // แก้ไข warning: ลบ setReturnDate ออกถ้าไม่ได้ใช้
        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000;
        return (new Date(now - tzOffset)).toISOString().slice(0, 10);
    });
    const [returnItems, setReturnItems] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [manualPartId, setManualPartId] = useState(''); 
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Helper Function สำหรับจัดการรูปภาพ
    const getImageUrl = (url) => {
        if (!url) return "https://placehold.co/60x60?text=No+Image";
        return `${API_BASE}/uploads/${url}`;
    };

    useEffect(() => {
        if (location.state && location.state.preloadedItem) {
            const item = location.state.preloadedItem;
            setReturnItems([{
                partId: item.partId,
                partName: item.partName,
                lotId: item.lotId,
                quantity: item.quantity,
                borrowId: item.borrowId,
                isFixed: item.isFixed,
                unit: 'ชิ้น'
            }]);
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const handleReset = () => {
        setCurrentStep(1);
        setReturnItems([]);
        setManualPartId('');
        setError('');
        setIsScanning(false);
    };

    const handleOpenDoor = async () => {
        setIsProcessing(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            
            // 1. เช็คสถานะบอร์ดก่อน (เรียก API ที่เราทำไว้)
            const checkRes = await axios.get(`${API_BASE}/api/device-check`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });

            if (checkRes.data.status === "online") {
                // 2. ถ้า Online ค่อยสั่งเปิด
                await axios.get(`${API_BASE}/api/open`, { 
                    headers: { Authorization: `Bearer ${token}` } 
                });
                setCurrentStep(2); 
            }
        } catch (err) {
            // หากบอร์ด Offline จะมาตกที่ catch นี้ (เพราะเราส่ง Status 503 กลับมา)
            const msg = err.response?.data?.message || 'ตู้ไม่มีไฟเลี้ยง กรุณาตรวจสอบการเชื่อมต่อ';
            setError(msg);
        } finally {
            setIsProcessing(false);
        }
    };
    const handleCloseDoor = async () => {
        setIsProcessing(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE}/api/close-box`, {}, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            handleReset();
        } catch (err) {
            setError('คำสั่งปิดประตูขัดข้อง');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddItem = useCallback(async (scannedId, quantity = 1) => {
        const idToSearch = scannedId || manualPartId;
        if (!idToSearch) return;

        setError('');
        setIsProcessing(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_BASE}/api/withdraw/partInfo`, 
                { partId: idToSearch },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const partInfo = response.data; 

            setReturnItems(prev => {
                // แก้ไข Error: หา index ของ item ที่มีอยู่แล้ว
                const existingIndex = prev.findIndex(item => item.lotId === partInfo.lotId);
                
                if (existingIndex !== -1) {
                    return prev.map((item, i) => 
                        i === existingIndex ? { ...item, quantity: item.quantity + quantity } : item
                    );
                }
                return [...prev, { 
                    ...partInfo, 
                    partId: partInfo.partId || partInfo.equipment_id,
                    partName: partInfo.partName || partInfo.equipment_name,
                    imageUrl: partInfo.img || partInfo.imageUrl || null,
                    quantity: quantity 
                }];
            });
            setManualPartId(''); 
            setIsScanning(false);
        } catch (err) {
            setError('ไม่พบข้อมูลอะไหล่รหัสนี้ในระบบ');
        } finally {
            setIsProcessing(false);
        }
    }, [manualPartId]);

    const handleCancelStep2 = () => {
        if (window.confirm("คุณต้องการยกเลิกการทำรายการและปิดตู้ใช่หรือไม่?")) {
            setCurrentStep(1);
        }
    };

    useEffect(() => {
        let scanner = null;
        if (isScanning) {
            scanner = new Html5QrcodeScanner("reader", { 
                fps: 10, 
                qrbox: { width: 250, height: 250 } 
            });
            scanner.render((decodedText) => {
                handleAddItem(decodedText);
                setIsScanning(false);
            }, (err) => {});
        }
        return () => { 
            if (scanner) {
                scanner.clear().catch(e => console.error("Scanner cleanup error", e)); 
            }
        };
    }, [isScanning, handleAddItem]);

    const handleFinalConfirm = async () => {
        if (returnItems.length === 0) return;
        setIsProcessing(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                returnDate: returnDate,
                items: returnItems.map(item => ({
                    equipmentId: item.partId || item.equipment_id,
                    lotId: item.lotId || item.lot_id,
                    quantity: item.quantity,
                    borrowId: item.borrowId 
                }))
            };
            await axios.post(`${API_BASE}/api/return-part`, payload, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            setCurrentStep(5); 
        } catch (err) {
            setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
        } finally {
            setIsProcessing(false);
        }
    };

    const updateQty = (index, delta) => {
        setReturnItems(prev => prev.map((item, i) => 
            i === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
        ));
    };

    return (
        <div className="return-page-container">
            <div className="return-header-section text-center">
                <h2 className="text-2xl font-bold mb-4">คืนอะไหล่</h2>
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
            </div>

            <div className="return-card mt-2">
                {currentStep === 1 && (
                    <div className="step-content-identify animate-fadeIn">
                        <div className="identify-header">
                            <h3 className="text-2xl font-bold text-gray-800">1. ระบุอะไหล่ที่คืน</h3>
                        </div>

                        {/* ส่วนที่ 1: สแกนบาร์โค้ด */}
                        <div className="scanner-action-area">
                            {isScanning ? (
                                <div className="scanner-container">
                                    <div id="reader"></div>
                                    <button onClick={() => setIsScanning(false)} className="btn-cancel-scan mt-4">ยกเลิกสแกน</button>
                                </div>
                            ) : (
                                <button onClick={() => setIsScanning(true)} className="btn-modern-scanner">
                                    <FaCamera /> สแกนบาร์โค้ดอะไหล่
                                </button>
                            )}
                        </div>

                        <div className="divider-with-text"><span>หรือพิมพ์รหัส</span></div>

                        {/* ส่วนที่ 2: ระบุรหัสอะไหล่ด้วยตนเอง (ปรับ UI ตามรูปภาพ) */}
                        <div className="input-group-modern">
                            <div className="part-input-row">
                                <div className="flex-grow-input relative">
                                    <div className="input-with-icon">
                                        <FaPlus className="icon-prefix" />
                                        <input 
                                            type="text" 
                                            className="withdraw-input-modern" 
                                            value={manualPartId} 
                                            onChange={(e) => setManualPartId(e.target.value)} 
                                            placeholder="พิมพ์รหัสอะไหล่..." 
                                        />
                                    </div>
                                </div>
                                <button onClick={() => handleAddItem()} className="btn-add-part-modern">
                                    <FaPlus size={20} />
                                </button>
                            </div>
                        </div>

                        {error && <p className="error-badge mt-4">{error}</p>}
                        
                        {/* ส่วนที่ 3: ตะกร้าคืนอะไหล่ (คงค่า .isFixed ไว้ตามเงื่อนไข) */}
                        {returnItems.length > 0 && (
                            <div className="cart-section animate-fadeIn w-full">
                                <h4 className="cart-header">ตะกร้าคืนอะไหล่ ({returnItems.length})</h4>
                                <div className="cart-list">
                                    {returnItems.map((item, index) => (
                                        <div key={index} className="new-cart-item">
                                            <div className="item-thumb">
                                                <img 
                                                    src={getImageUrl(item.imageUrl)} 
                                                    alt={item.partName} 
                                                    onError={(e) => { e.target.src="https://placehold.co/60x60?text=Error" }} 
                                                />
                                            </div>
                                            <div className="item-info">
                                                <div className="item-name">{item.partName}</div>
                                                <div className="item-lot">Lot: {item.lotId}</div>
                                            </div>
                                            <div className="item-controls">
                                                <div className="qty-stepper">
                                                    <button 
                                                        onClick={() => updateQty(index, -1)} 
                                                        disabled={item.isFixed} 
                                                        style={{ opacity: item.isFixed ? 0.4 : 1 }}
                                                    >
                                                        <FaMinus size={10}/>
                                                    </button>
                                                    <span>{item.quantity}</span>
                                                    <button 
                                                        onClick={() => updateQty(index, 1)} 
                                                        disabled={item.isFixed}
                                                        style={{ opacity: item.isFixed ? 0.4 : 1 }}
                                                    >
                                                        <FaPlus size={10}/>
                                                    </button>
                                                </div>
                                                {!item.isFixed && (
                                                    <button className="btn-delete-small" onClick={() => setReturnItems(returnItems.filter((_, i) => i !== index))}>
                                                        <FaTrash size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => setCurrentStep(2)} className="btn-action-primary mt-4">
                                    ตรวจสอบรายการ
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="step-content-review animate-fadeIn">
                        <div className="review-header-group">
                            <h3 className="text-2xl font-bold">2. ตรวจสอบข้อมูล</h3>
                            <p className="text-gray-400 text-sm">กรุณาตรวจสอบรายละเอียดก่อนบันทึก</p>
                        </div>

                        {/* แบนเนอร์แสดงเลขครุภัณฑ์ (ถ้ามี) หรือวันที่คืน */}
                        <div className="asset-info-banner">
                            <div className="label">วันที่ทำรายการคืน</div>
                            <div className="value">
                                {new Date(returnDate).toLocaleDateString('th-TH')}
                            </div>
                        </div>

                        <div className="review-list-container">
                            <h4 className="text-sm font-bold mb-3 text-gray-500 uppercase text-center">
                                รายการอะไหล่ที่คืน
                            </h4>
                            {returnItems.map((item, idx) => (
                                <div key={idx} className="review-item-card-modern">
                                    <div className="item-img-box">
                                        <img 
                                            src={getImageUrl(item.imageUrl) || "https://placehold.co/60"} 
                                            alt="part" 
                                            onError={(e) => { e.target.src = "https://placehold.co/60?text=Error"; }}
                                        />
                                    </div>
                                    <div className="item-main-info">
                                        <div className="item-main-info-row">
                                            <span className="name font-bold">{item.partName}</span>
                                            <span className="qty-val-pink">x {item.quantity} {item.unit || 'ชิ้น'}</span>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">Lot: {item.lotId}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 mt-8 w-full">
                            <button onClick={() => setCurrentStep(2)} className="btn-review-edit flex-1">แก้ไขรายการ</button>
                            <button onClick={() => setCurrentStep(3)} className="btn-modern-gradient flex-2">บันทึกข้อมูล</button>
                        </div>
                    </div>
                )}
        
                {currentStep === 3 && (
                    <div className="step-content-unlock animate-fadeIn">
                        {/* ไอคอนกุญแจในวงกลมสีชมพูอ่อน */}
                        <div className="unlock-icon-container">
                            <FaLockOpen size={48} />
                        </div>
                        
                        <h3 className="unlock-title">3. เปิดประตูกล่อง</h3>
                        <p className="unlock-subtitle">กรุณากดปุ่มเพื่อปลดล็อกและเตรียมการคืน</p>

                        {/* แสดงวันที่คืนให้ชัดเจนกึ่งกลาง */}
                        <div className="asset-info-banner mb-8">
                            <div className="label">วันที่ทำรายการคืน</div>
                            <div className="value">
                                {new Date(returnDate).toLocaleDateString('th-TH')}
                            </div>
                        </div>

                        {/* ปุ่มเปิดประตูทรงมนยาวตามรูป */}
                        <button 
                            onClick={handleOpenDoor} 
                            disabled={isProcessing} 
                            className="btn-unlock-gate"
                        >
                            {isProcessing ? (
                                <span className="loader"></span>
                            ) : (
                                <>
                                    <FaLockOpen className="mr-2" />
                                    เปิดประตูตู้
                                </>
                            )}
                        </button>

                        {/* ปุ่มยกเลิกด้านล่างสุด */}
                        <div className="footer-actions">
                            <button onClick={handleCancelStep2} className="btn-cancel-step2">
                                ยกเลิกการทำรายการ
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="step-content-confirmation">
                        <FaClipboardCheck size={64} className="text-blue-500 mb-4" />
                        <h3 className="text-2xl font-bold text-gray-800">4. ยืนยันการบันทึก</h3>
                        <p className="text-gray-400 text-sm">กรุณาตรวจสอบสรุปรายการครั้งสุดท้าย</p>

                        <div className="confirmation-summary-card">
                            <span className="summary-header-label">สรุปรายละเอียดการคืน</span>
                            
                            <div className="summary-data-row-flex">
                                <span>วันที่คืน:</span>
                                <b>{new Date(returnDate).toLocaleDateString('th-TH')}</b>
                            </div>
                            
                            {/* แสดง Asset ID ถ้ามีข้อมูล (จากรายการแรก) */}
                            <div className="summary-data-row-flex">
                                <span>ประเภทรายการ:</span>
                                <b>คืนอะไหล่</b>
                            </div>

                            <div className="summary-items-list">
                                {returnItems.map((item, idx) => (
                                    <div key={idx} className="summary-item-line-right py-1">
                                        <span className="text-gray-600">{item.partName}</span>
                                        <b>x {item.quantity} {item.unit || 'ชิ้น'}</b>
                                    </div>
                                ))}
                            </div>

                            <div className="summary-total-footer">
                                <span>รวมคืนทั้งสิ้น</span>
                                <div className="total-count-badge">
                                    {returnItems.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 w-full mt-2">
                            <button onClick={() => setCurrentStep(3)} className="btn-review-edit flex-1">กลับไปแก้ไข</button>
                            <button 
                                onClick={handleFinalConfirm} 
                                disabled={isProcessing} 
                                className="btn-modern-gradient flex-2"
                            >
                                {isProcessing ? <span className="loader"></span> : 'ยืนยันและบันทึกข้อมูล'}
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 5 && (
                    <div className="step-content-success">
                        <div className="success-banner-modern">
                            <div className="success-icon-circle">
                                <FaCheckCircle />
                            </div>
                            <span className="success-text-main">บันทึกข้อมูลสำเร็จ!</span>
                        </div>

                        <h3 className="text-2xl font-bold text-gray-800 mb-2">5. สั่งปิดประตู</h3>
                        <p className="instruction-text">
                            ตรวจสอบสิ่งกีดขวางบริเวณหน้ากล่องให้เรียบร้อย แล้วกดปุ่มเพื่อล็อกตู้
                        </p>

                        <button 
                            onClick={handleCloseDoor} 
                            disabled={isProcessing} 
                            className="btn-close-gate-final"
                        >
                            {isProcessing ? (
                                <span className="loader"></span>
                            ) : (
                                <>
                                    <FaLock />
                                    ปิดประตูกล่อง
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ReturnPartPage;