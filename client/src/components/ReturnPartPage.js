import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom"; 
import { FaCheckCircle, FaCamera, FaLockOpen, FaPlus, FaMinus, FaTrash, FaLock, FaClipboardCheck} from "react-icons/fa"; 
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from "axios";
import io from 'socket.io-client';
import './ReturnPartPage.css'; 

const API_BASE = process.env.REACT_APP_API_URL;
const STORAGE_KEY = 'mems_return_session';

function ReturnPartPage({ user, setIsLocked }) {
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

    const [cabinetBusy, setCabinetBusy] = useState(false);
    const [busyBy, setBusyBy] = useState('');

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            if (window.confirm("คุณมีรายการคืนที่ค้างอยู่ ต้องการกู้คืนข้อมูลหรือไม่?")) {
                setCurrentStep(data.currentStep);
                setReturnItems(data.returnItems);
                if (setIsLocked) setIsLocked(true);
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    }, [setIsLocked]);

    useEffect(() => {
        if (currentStep >= 3 && currentStep <= 4) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ currentStep, returnItems }));
        }
    }, [currentStep, returnItems]);

    useEffect(() => {
        const socket = io(API_BASE);

        socket.on('cabinet_status', (state) => {
            const currentUserId = user?.user_id || user?.userId; 
            if (state.isBusy && state.userId !== currentUserId) {
                setCabinetBusy(true);
                setBusyBy(state.userName);
            } else {
                setCabinetBusy(false);
                setBusyBy('');
            }
        });

        return () => socket.disconnect();
    }, [user?.user_id, user?.userId]);

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

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (currentStep >= 3 && currentStep <= 4) {
                const message = "คุณกำลังทำรายการค้างอยู่ หากออกตอนนี้รายการจะไม่ถูกบันทึก!";
                e.returnValue = message; 
                return message;
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [currentStep]);

    const handleReset = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setCurrentStep(1);
        setIsSuccess(false);
        setReturnItems([]);
        setManualPartId('');
        setError('');
        setIsScanning(false);
    }, []);

    const handleOpenDoor = async (nextStep) => {
        setIsProcessing(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const checkRes = await axios.get(`${API_BASE}/api/device-check`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });

            if (checkRes.data.status === "online") {
                await axios.get(`${API_BASE}/api/open`, { 
                    headers: { Authorization: `Bearer ${token}` } 
                });
                setCurrentStep(nextStep); 
                if (setIsLocked) setIsLocked(true);
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'ตู้ไม่มีไฟเลี้ยง กรุณาตรวจสอบการเชื่อมต่อ';
            setError(msg);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleCloseDoor = async (nextStep, reset = false) => {
        setIsProcessing(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE}/api/close-box`, {}, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            if (reset) {
                handleReset();
                if (setIsLocked) setIsLocked(false);
            } else {
                setCurrentStep(nextStep);
            }
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


    useEffect(() => {
        let scanner = null;
        if (isScanning && currentStep === 3) {
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
            setCurrentStep(5); 
        } catch (err) {
            setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
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
                    {[1, 2, 3, 4, 5, 6].map((step) => (
                        <React.Fragment key={step}>
                            <div className={`step-item ${currentStep >= step ? 'active' : ''}`}>
                                <div className="step-circle">{currentStep > step ? <FaCheckCircle /> : step}</div>
                            </div>
                            {step < 6 && <div className={`step-line ${currentStep > step ? 'active' : ''}`}></div>}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="return-card mt-2">
                {currentStep === 1 && (
                    <div className="step-content-unlock">
                        <div className="unlock-icon-container"><FaLockOpen size={48} /></div>
                        <h3 className="unlock-title">1. เปิดประตูกล่อง</h3>
                        <p className="unlock-subtitle">กดยืนยันเพื่อปลดล็อก</p>
                        <button onClick={() => handleOpenDoor(2)} disabled={isProcessing} className="btn-unlock-gate">
                            {isProcessing ? <span className="loader"></span> : <><FaLockOpen /> เปิดประตูกล่อง</>}
                        </button>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="step-content-unlock">
                        <div className="unlock-icon-container"><FaLock size={48} /></div>
                        <h3 className="unlock-title">2. ปิดประตูกล่อง</h3>
                        <p className="unlock-subtitle">กรุณาปิดประตูตู้ก่อนเริ่มทำรายการในระบบ</p>
                        <button onClick={() => handleCloseDoor(3, false)} disabled={isProcessing} className="btn-close-gate-final">
                            {isProcessing ? <span className="loader"></span> : <><FaLock /> ปิดประตูกล่อง</>}
                        </button>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="step-content-identify animate-fadeIn">
                        <div className="identify-header">
                            <h3 className="text-2xl font-bold text-gray-800">3. ระบุอะไหล่ที่คืน</h3>
                        </div>

                        <div className="scanner-action-area">
                            {isScanning ? (
                                <div className="scanner-container">
                                    <div id="reader"></div>
                                    <button onClick={() => setIsScanning(false)} className="btn-cancel-step2">ยกเลิกสแกน</button>
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
                                <button onClick={() => setCurrentStep(4)} className="btn-action-primary mt-4">
                                    ตรวจสอบรายการ
                                </button>
                            </div>
                        )}
                        <div className="footer-actions mt-4">
                            <button onClick={() => { if(window.confirm("ยกเลิกรายการข้ามไปหน้าปิดตู้?")) { setIsSuccess(false); setCurrentStep(5); } }} className="btn-cancel-step2">ยกเลิกการทำรายการ</button>
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="step-content-confirmation">
                        <FaClipboardCheck size={64} className="text-blue-500 mb-4" />
                        <h3 className="text-2xl font-bold text-gray-800">4. ตรวจสอบและยืนยันการบันทึก</h3>
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
                            <button onClick={() => setCurrentStep(3)} className="btn-review-edit flex-1">กลับไปแก้ไข</button>
                            <button onClick={() => { if(window.confirm("ยกเลิกรายการทั้งหมด?")) { setIsSuccess(false); setCurrentStep(5); } }} className="btn-cancel-step2 flex-1">ยกเลิกรายการ</button>
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
                    <div className="step-content-unlock">
                        {isSuccess && (
                            <div className="success-banner-modern mb-4">
                                <div className="success-icon-circle"><FaCheckCircle /></div>
                                <span className="success-text-main">บันทึกข้อมูลสำเร็จ!</span>
                            </div>
                        )}
                        <div className="unlock-icon-container"><FaLockOpen size={48} /></div>
                        <h3 className="unlock-title">5. เปิดประตูกล่อง</h3>
                        <p className="unlock-subtitle">กรุณากดปุ่มเพื่อปลดล็อกตู้และทำการหยิบอะไหล่</p>
                        <button onClick={() => handleOpenDoor(6)} disabled={isProcessing} className="btn-unlock-gate">
                            {isProcessing ? <span className="loader"></span> : <><FaLockOpen /> เปิดประตูกล่อง</>}
                        </button>
                    </div>
                )}

                {currentStep === 6 && (
                    <div className="step-content-success">
                        <h3 className="text-2xl font-bold mb-2">6. สั่งปิดประตู</h3>
                        <p className="instruction-text">ตรวจสอบสิ่งกีดขวางให้เรียบร้อย แล้วกดปุ่มเพื่อล็อกตู้ จบการทำงาน</p>
                        <button onClick={() => handleCloseDoor(1, true)} disabled={isProcessing} className="btn-close-gate-final">
                            {isProcessing ? <span className="loader"></span> : <><FaLock /> ปิดประตูกล่อง</>}
                        </button>
                    </div>
                )}
                
                {cabinetBusy && (
                    <div className="fixed inset-0 bg-black bg-opacity-60 z-[9999] flex items-center justify-center backdrop-blur-sm">
                        <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-md w-full mx-4">
                            <div className="text-yellow-500 mb-4 flex justify-center">
                                <FaLock size={60} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">ตู้กำลังถูกใช้งาน</h2>
                            <p className="text-gray-600 mb-6">
                                ขณะนี้ <b>{busyBy || 'พนักงานท่านอื่น'}</b> กำลังทำรายการอยู่ที่หน้าตู้<br/>
                                โปรดรอสักครู่ เมื่อทำรายการเสร็จสิ้นหน้าต่างนี้จะหายไปเอง
                            </p>
                            <div className="flex justify-center">
                                <span className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                            </div>
                        </div>
                    </div>
                )}
            
            </div>
        </div>
    );
}

export default ReturnPartPage;