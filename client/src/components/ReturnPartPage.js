import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom"; 
import { FaCheckCircle, FaCamera, FaPlus, FaMinus, FaTrash, FaClipboardCheck} from "react-icons/fa"; 
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from "axios";
import './ReturnPartPage.css'; 

const API_BASE = process.env.REACT_APP_API_URL;
const STORAGE_KEY = 'mems_return_session';

function ReturnPartPage({ user }) {
    const location = useLocation(); 
    const [currentStep, setCurrentStep] = useState(1); 
    const [isSuccess, setIsSuccess] = useState(false);

    const [returnDate] = useState(() => { 
        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000;
        return (new Date(now - tzOffset)).toISOString().slice(0, 10);
    });
    const [returnItems, setReturnItems] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [manualPartId, setManualPartId] = useState(''); 
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // กู้คืนเซสชันหากทำค้างไว้
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            if (window.confirm("คุณมีรายการคืนที่ค้างอยู่ ต้องการกู้คืนข้อมูลหรือไม่?")) {
                // ป้องกันกรณี step เดิมมาจากระบบตู้ที่ถูกลบไปแล้ว ให้เริ่มที่ step 1
                setCurrentStep(data.currentStep > 2 ? 1 : data.currentStep);
                setReturnItems(data.returnItems || []);
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    }, []);

    // บันทึกสถานะอัตโนมัติ
    useEffect(() => {
        if (returnItems.length > 0 && currentStep < 3) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ currentStep, returnItems }));
        }
    }, [currentStep, returnItems]);

    const getImageUrl = (url) => {
        if (!url) return "https://placehold.co/60x60?text=No+Image";
        return `${API_BASE}/uploads/${url}`;
    };

    // โหลดข้อมูลอะไหล่ที่ถูกส่งมาล่วงหน้า
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

    // แจ้งเตือนหากพยายามปิดหน้าต่างระหว่างทำรายการ
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (returnItems.length > 0 && currentStep < 3) {
                const message = "คุณกำลังทำรายการค้างอยู่ หากออกตอนนี้รายการจะไม่ถูกบันทึก!";
                e.returnValue = message; 
                return message;
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [currentStep, returnItems]);

    const handleReset = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setCurrentStep(1);
        setIsSuccess(false);
        setReturnItems([]);
        setManualPartId('');
        setError('');
        setIsScanning(false);
    }, []);

    const handleAddItem = useCallback(async (scannedId, quantity = 1) => {
        const idToSearch = scannedId || manualPartId;
        if (!idToSearch) return;

        setError('');
        setIsProcessing(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_BASE}/api/return/partInfo`, 
                { partId: idToSearch },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const partInfo = response.data; 

            setReturnItems(prev => {
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
            setError(err.response?.data?.error || 'ไม่พบข้อมูลอะไหล่รหัสนี้ในระบบ');
        } finally {
            setIsProcessing(false);
        }
    }, [manualPartId]);

    // ตั้งค่า Scanner
    useEffect(() => {
        let scanner = null;
        if (isScanning && currentStep === 1) {
            scanner = new Html5QrcodeScanner("reader", { 
                fps: 10, 
                qrbox: { width: 350, height: 150} 
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
    }, [isScanning, currentStep, handleAddItem]);

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
            setIsSuccess(true);
            localStorage.removeItem(STORAGE_KEY);
            setCurrentStep(3); 
        } catch (err) {
            setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } finally {
            setIsProcessing(false);
        }
    };

    const updateQty = (index, delta) => {
        setReturnItems(prev => {
            const newItems = [...prev];
            const item = newItems[index];
            const newQty = item.quantity + delta;

            if (delta > 0 && newQty > item.maxReturnable) {
                setTimeout(() => setError(`คืนไม่ได้เกิน! คุณมียอดค้างคืนแค่ ${item.maxReturnable} ${item.unit || 'ชิ้น'}`), 0);
                return prev;
            }

            setTimeout(() => setError(''), 0);
            
            if (newQty > 0) {
                newItems[index] = { ...item, quantity: newQty };
            }
            return newItems;
        });
    };

    return (
        <div className="return-page-container">
            <div className="return-header-section text-center">
                <h2 className="text-2xl font-bold mb-4">คืนอะไหล่</h2>
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
            </div>

            <div className="return-card mt-2">
                {currentStep === 1 && (
                    <div className="step-content-identify animate-fadeIn">
                        <div className="identify-header">
                            <h3 className="text-2xl font-bold text-gray-800">1. ระบุอะไหล่ที่คืน</h3>
                        </div>

                        <div className="scanner-action-area">
                            {isScanning ? (
                                <div className="scanner-container">
                                    <div id="reader"></div>
                                    <button onClick={() => setIsScanning(false)} className="btn-cancel-step2 mt-2">ยกเลิกสแกน</button>
                                </div>
                            ) : (
                                <button onClick={() => setIsScanning(true)} className="btn-modern-scanner">
                                    <FaCamera /> สแกนบาร์โค้ดอะไหล่
                                </button>
                            )}
                        </div>

                        <div className="divider-with-text"><span>หรือพิมพ์รหัส</span></div>

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
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                                        />
                                    </div>
                                </div>
                                <button onClick={() => handleAddItem()} className="btn-add-part-modern">
                                    <FaPlus size={20} />
                                </button>
                            </div>
                        </div>

                        {error && <p className="error-badge mt-4">{error}</p>}
                        
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
                        <div className="footer-actions mt-4">
                            <button onClick={() => { if(window.confirm("ต้องการยกเลิกการทำรายการและล้างข้อมูลทั้งหมด?")) handleReset(); }} className="btn-cancel-step2">ยกเลิกการทำรายการ</button>
                        </div>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="step-content-confirmation">
                        <FaClipboardCheck size={64} className="text-blue-500 mb-4" />
                        <h3 className="text-2xl font-bold text-gray-800">2. ตรวจสอบและยืนยันการบันทึก</h3>
                        <p className="text-gray-400 text-sm">กรุณาตรวจสอบสรุปรายการครั้งสุดท้าย</p>

                        <div className="confirmation-summary-card">
                            <span className="summary-header-label">สรุปรายละเอียดการคืน</span>
                            
                            <div className="summary-data-row-flex">
                                <span>วันที่คืน:</span>
                                <b>{new Date(returnDate).toLocaleDateString('th-TH')}</b>
                            </div>
                            
                            <div className="summary-data-row-flex">
                                <span>ประเภทรายการ:</span>
                                <b>คืนอะไหล่</b>
                            </div>

                            <div className="summary-items-list border-t pt-2 mt-2">
                                {returnItems.map((item, idx) => (
                                    <div key={idx} className="summary-item-line-right py-1">
                                        <span className="text-gray-600">{item.partName}</span>
                                        <b>x {item.quantity} {item.unit || 'ชิ้น'}</b>
                                    </div>
                                ))}
                            </div>

                            <div className="summary-total-footer mt-4">
                                <span>รวมคืนทั้งสิ้น</span>
                                <div className="total-count-badge">
                                    {returnItems.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น
                                </div>
                            </div>
                        </div>

                        {error && <p className="error-badge mt-4 text-center w-full">{error}</p>}  

                        <div className="flex gap-4 w-full mt-6">
                            <button onClick={() => setCurrentStep(1)} className="btn-review-edit flex-1">กลับไปแก้ไข</button>
                            <button onClick={() => { if(window.confirm("ยกเลิกรายการทั้งหมด?")) handleReset(); }} className="btn-cancel-step2 flex-1">ยกเลิกรายการ</button>
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

                {currentStep === 3 && (
                    <div className="step-content-success text-center py-8">
                        {isSuccess && (
                            <div className="flex flex-col items-center justify-center">
                                <FaCheckCircle size={80} className="text-green-500 mb-4" />
                                <h3 className="text-3xl font-bold text-gray-800 mb-2">บันทึกข้อมูลสำเร็จ!</h3>
                                <p className="text-gray-500 mb-6">ข้อมูลการคืนอะไหล่ของคุณถูกอัปเดตเข้าระบบเรียบร้อยแล้ว</p>
                                
                                <button onClick={handleReset} className="btn-modern-gradient px-8 py-3">
                                    ทำรายการคืนอะไหล่ชิ้นอื่นต่อ
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ReturnPartPage;