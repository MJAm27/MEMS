import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom"; 
import { FaCheckCircle, FaCamera, FaLockOpen, FaPlus, FaMinus, FaTrash, FaLock, FaClipboardCheck} from "react-icons/fa"; 
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from "axios";
import './ReturnPartPage.css'; 

const API_BASE = process.env.REACT_APP_API_URL ;

function ReturnPartPage() {
    const location = useLocation(); 
    const [currentStep, setCurrentStep] = useState(1); 
    const [returnDate, setReturnDate] = useState(() => {
        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000;
        return (new Date(now - tzOffset)).toISOString().slice(0, 10);
    });
    const [returnItems, setReturnItems] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [manualPartId, setManualPartId] = useState(''); 
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

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
            await axios.get(`${API_BASE}/api/open`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            setCurrentStep(2);
        } catch (err) {
            setError('ไม่สามารถติดต่อตู้เพื่อเปิดได้');
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
            
            // ✅ แก้ไข: ใช้ข้อมูลจาก response.data
            const partInfo = response.data; 

            setReturnItems(prev => {
                const existing = prev.find(item => item.lotId === partInfo.lotId);
                if (existing) {
                    return prev.map(item => item.lotId === partInfo.lotId 
                        ? { ...item, quantity: item.quantity + quantity } : item);
                }
                return [...prev, { 
                    ...partInfo, 
                    partId: partInfo.partId || partInfo.equipment_id,
                    // ✅ แก้ไข Syntax: ใช้ partInfo แทน data และเขียนให้อยู่ในบรรทัดเดียวกัน
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
                    <div className="step-content animate-fade text-center py-4">
                        <div className="status-icon-wrapper mb-6"><FaLockOpen size={50} className="text-pink-500" /></div>
                        <h3 className="step-title font-bold text-2xl mb-2">1. เปิดประตูกล่อง</h3>
                        <p className="step-desc text-gray-400 mb-8">กรุณากดปุ่มเพื่อเปิดกล่องและเตรียมการคืน</p>
                        <div className="input-group-modern mb-8">
                            <label className="input-label">วันที่คืน</label>
                            <input type="date" className="modern-input" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                        </div>
                        <button onClick={handleOpenDoor} disabled={isProcessing} className="btn-action btn-open-gate">
                            {isProcessing ? <span className="loader"></span> : <><FaLockOpen /> เปิดประตู</>}
                        </button>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="step-content animate-fade">
                        <h3 className="text-lg font-bold mb-4">2. ระบุอะไหล่ที่คืน</h3>
                        <div className="scanner-section mb-6">
                            {isScanning ? (
                                <div className="scanner-container">
                                    <div id="reader"></div>
                                    <button onClick={() => setIsScanning(false)} className="btn-cancel-scan mt-4">ยกเลิกสแกน</button>
                                </div>
                            ) : (
                                <button onClick={() => setIsScanning(true)} className="btn-scanner-trigger">
                                    <FaCamera /> สแกนบาร์โค้ดอะไหล่
                                </button>
                            )}
                        </div>
                        <div className="divider-text mb-6"><span>หรือพิมพ์รหัส</span></div>
                        <div className="flex gap-2 mb-6">
                            <input type="text" className="modern-input flex-grow" value={manualPartId} onChange={(e) => setManualPartId(e.target.value)} placeholder="รหัสอะไหล่..." />
                            <button onClick={() => handleAddItem()} className="btn-add-square"><FaPlus /></button>
                        </div>
                        {error && <p className="error-badge mb-4">{error}</p>}
                        {returnItems.length > 0 && (
                            <div className="cart-section mt-8">
                                <h4 className="section-title-sm mb-4">ตะกร้าคืนอะไหล่ ({returnItems.length})</h4>
                                <div className="modern-items-list">
                                    {returnItems.map((item, index) => (
                                        <div key={index} className="modern-part-card">
                                            <div className="part-img">
                                                <img src={`${API_BASE}/uploads/${item.imageUrl}`} alt="" onError={(e) => e.target.src="https://via.placeholder.com/60"} />
                                            </div>
                                            <div className="part-details">
                                                <span className="part-name">{item.partName}</span>
                                                <span className="part-lot">Lot: {item.lotId}</span>
                                            </div>
                                            <div className="part-actions">
                                                <div className="modern-qty-control">
                                                    <button 
                                                        onClick={() => updateQty(index, -1)} 
                                                        disabled={item.isFixed} // ✅ ล็อคปุ่มลบ
                                                        style={{ opacity: item.isFixed ? 0.5 : 1, cursor: item.isFixed ? 'not-allowed' : 'pointer' }}
                                                    >
                                                        <FaMinus size={10}/>
                                                    </button>
                                                    
                                                    <span>{item.quantity}</span>
                                                    
                                                    <button 
                                                        onClick={() => updateQty(index, 1)} 
                                                        disabled={item.isFixed} // ✅ ล็อคปุ่มบวก
                                                        style={{ opacity: item.isFixed ? 0.5 : 1, cursor: item.isFixed ? 'not-allowed' : 'pointer' }}
                                                    >
                                                        <FaPlus size={10}/>
                                                    </button>
                                                </div>
                                                {/* ✅ ถ้าถูกฟิกมา ไม่ควรให้ลบรายการทิ้งได้ง่ายๆ */}
                                                {!item.isFixed && (
                                                    <button className="btn-delete-item" onClick={() => setReturnItems(returnItems.filter((_, i) => i !== index))}>
                                                        <FaTrash size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => setCurrentStep(3)} className="btn-action-primary w-full mt-6 shadow-pink">ตรวจสอบรายการ</button>
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="text-center">
                            <h3 className="text-2xl font-bold">3. ตรวจสอบข้อมูล</h3>
                            <p className="text-gray-400 text-sm">กรุณาตรวจสอบรายละเอียดการคืนก่อนบันทึก</p>
                        </div>
                        <div className="asset-info-banner">
                            <div className="label">วันที่ทำรายการคืน</div>
                            <div className="value">{new Date(returnDate).toLocaleDateString('th-TH')}</div>
                        </div>
                        <div className="review-list-container">
                            <h4 className="text-sm font-bold mb-3 text-gray-500 uppercase">รายการอะไหล่ที่คืน</h4>
                            {returnItems.map((item, idx) => (
                                <div key={idx} className="review-item-card">
                                    <div className="item-img-box">
                                        {item.imageUrl ? <img src={`${API_BASE}/uploads/${item.imageUrl}`} alt="part" /> : <div className="flex items-center justify-center w-full h-full bg-gray-0 text-gray-300"><FaPlus size={16} /></div>}
                                    </div>
                                    <div className="item-main-info">
                                        <div className="item-name-row">
                                            <span className="name">{item.partName}</span>
                                            <div className="qty-display-group">
                                                <span className="qty-val">x {item.quantity}</span>
                                                <span className="unit-val">{item.unit || 'ชิ้น'}</span>
                                            </div>
                                        </div>
                                        <div className="item-sub-info"><span className="tag-lot">Lot: {item.lotId}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setCurrentStep(2)} className="btn-review-edit">แก้ไขรายการ</button>
                            <button onClick={() => setCurrentStep(4)} className="btn-review-confirm">ไปหน้ายืนยัน</button>
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="text-center py-4 space-y-6 animate-fadeIn">
                        <FaClipboardCheck size={60} className="mx-auto text-blue-500 mb-2" />
                        <h3 className="text-2xl font-bold">4. ยืนยันการบันทึก</h3>
                        <div className="summary-box bg-blue-50 p-6 rounded-3xl border border-blue-100 text-left">
                            <p className="text-xs text-blue-600 font-bold uppercase mb-1">สรุปการคืนอะไหล่</p>
                            <p className="text-sm text-gray-700"><b>วันที่คืน:</b> {new Date(returnDate).toLocaleDateString('th-TH')}</p>
                            <p className="text-sm text-gray-700"><b>รายการ:</b> {returnItems.length} อะไหล่</p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setCurrentStep(3)} className="btn-review-edit">กลับ</button>
                            <button onClick={handleFinalConfirm} disabled={isProcessing} className="btn-action btn-confirm-save flex-2">
                                {isProcessing ? <span className="loader"></span> : 'ยืนยันการคืนอะไหล่'}
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 5 && (
                    <div className="text-center py-6 animate-fadeIn">
                        <div className="success-badge bg-green-100 text-green-700 p-4 rounded-2xl mb-8 flex items-center gap-3 justify-center">
                            <FaCheckCircle size={24} /> <p className="font-bold">บันทึกข้อมูลสำเร็จ!</p>
                        </div>
                        <h3 className="text-2xl font-bold mb-2">5. สั่งปิดประตู</h3>
                        <p className="text-gray-500 mb-8">บันทึกข้อมูลการคืนเรียบร้อยแล้ว</p>
                        <button onClick={handleCloseDoor} disabled={isProcessing} className="btn-action btn-close-lock w-full" style={{ margin: '0 auto', maxWidth: '300px' }}>
                            {isProcessing ? <span className="loader"></span> : <><FaLock className="mr-2" /> ปิดประตูกล่อง</>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ReturnPartPage;