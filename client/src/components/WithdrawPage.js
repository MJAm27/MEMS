import React, {useState, useEffect, useCallback, useRef} from 'react';
import { 
    FaLockOpen, FaCheckCircle, FaPlus, FaCamera, FaTrash, 
    FaMinus, FaLock, FaClipboardCheck, FaTimes,FaImage
} from 'react-icons/fa'; 
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import axios from 'axios';
import './WithdrawPage.css';

const API_BASE = process.env.REACT_APP_API_URL ;

function WithdrawPage({ user }) { 
    const [currentStep, setCurrentStep] = useState(1);
    const [assetId, setAssetId] = useState('');
    const [currentPartId, setCurrentPartId] = useState('');
    const [cartItems, setCartItems] = useState([]);
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [partSuggestions, setPartSuggestions] = useState([]);
    const [machines, setMachines] = useState([]);
    const qrCodeInstance = useRef(null);

    const handleResetForm = () => {
        setCurrentStep(1);
        setAssetId('');
        setCartItems([]);
        setCurrentPartId('');
        setError('');
        setShowScanner(false);
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
            // 🟢 เปลี่ยนจาก reload เป็น reset state เพื่อแก้ปัญหา Message Channel
            handleResetForm();
        } catch (err) {
            setError('คำสั่งปิดประตูขัดข้อง');
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePartSearch = async (val) => {
        setCurrentPartId(val);
        if (val.length > 0) {
            try {
                const token = localStorage.getItem('token'); 
                const res = await axios.get(`${API_BASE}/api/search/parts?term=${val}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setPartSuggestions(res.data);
            } catch (err) { console.error(err); }
        } else {
            setPartSuggestions([]);
        }
    };

    const stopScanning = async () => {
        if (qrCodeInstance.current && qrCodeInstance.current.isScanning) {
            try {
                await qrCodeInstance.current.stop();
                setShowScanner(false);
            } catch (err) { console.error(err); }
        }
    };

    const handleFileScan = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await stopScanning(); // ปิดกล้องก่อนถ้าเปิดอยู่
        const html5QrCode = new Html5Qrcode("reader");
        try {
            const decodedText = await html5QrCode.scanFile(file, true);
            handleAddItemToCart(decodedText, 1);
            setError("");
        } catch (err) {
            setError("ไม่สามารถอ่านบาร์โค้ดจากรูปภาพได้ โปรดใช้ภาพที่ชัดเจนและไม่มีแสงสะท้อน");
        }
    };


    const handleAddItemToCart = useCallback(async (scannedId, quantity = 1) => {
        if (isProcessing) return;
        const idToSearch = scannedId || currentPartId;
        if (!assetId) { setError('กรุณากรอกครุภัณฑ์ก่อน'); return; }
        if (!idToSearch) { setError('กรุณาระบุรหัสอะไหล่'); return; }

        setIsProcessing(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_BASE}/api/withdraw/partInfo`, 
                { partId: idToSearch },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const partInfo = response.data;
            
            setCartItems(prev => {
                const existing = prev.find(item => item.lotId === partInfo.lotId);
                if (existing) {
                    return prev.map(item => item.lotId === partInfo.lotId ? { ...item, quantity: item.quantity + quantity } : item);
                }
                return [...prev, { ...partInfo, quantity: quantity }];
            });
            setCurrentPartId('');
            setPartSuggestions([]);
        } catch (err) {
            setError(err.response?.data?.error || 'ไม่พบข้อมูลอะไหล่');
        } finally {
            setIsProcessing(false);
        }
    }, [assetId, currentPartId, isProcessing]);

    const handleFinalConfirm = async () => {
        if (cartItems.length === 0) return;
        setIsProcessing(true);
        setError("");
        try {
            const token = localStorage.getItem('token');
            const payload = { 
                machine_SN: assetId, 
                cartItems: cartItems.map(item => ({ 
                    lotId: item.lotId, 
                    partId: item.partId, 
                    quantity: item.quantity 
                })) 
            };
            await axios.post(`${API_BASE}/api/withdraw/confirm`, payload, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            setCurrentStep(5);
        } catch (err) {
            setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancelStep2 = () => {
        if (window.confirm("คุณต้องการยกเลิกการทำรายการและปิดตู้ใช่หรือไม่?")) {
            setCurrentStep(5);
        }
    };
    const updateItemQuantity = (index, delta) => {
        setCartItems(prev => {
            const newItems = [...prev];
            const newQty = newItems[index].quantity + delta;
            if (newQty > 0) {
                newItems[index] = { ...newItems[index], quantity: newQty };
            }
            return newItems;
        });
    };

    useEffect(() => {
        const fetchMachines = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_BASE}/api/machine`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                setMachines(res.data);
            } catch (err) {
                console.error("Fetch machines error:", err);
            }
        };
        fetchMachines();
        if (showScanner && currentStep === 2) {
            qrCodeInstance.current = new Html5Qrcode("reader");
            const config = { 
                fps: 15, // เพิ่ม FPS ให้ภาพไหลลื่นขึ้นบน iOS
                qrbox: { width: 300, height: 120 }, // ปรับทรงให้เหมาะกับ Barcode (แบนยาว)
                aspectRatio: 1.0,
                // บังคับ Format ที่ต้องการสแกน ช่วยให้ iOS ประมวลผลเร็วขึ้นมาก
                formatsToSupport: [ 
                    Html5QrcodeSupportedFormats.CODE_128, 
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.QR_CODE
                ]
            };

            qrCodeInstance.current.start(
                { facingMode: "environment" }, // บังคับกล้องหลัง
                config,
                (decodedText) => {
                    handleAddItemToCart(decodedText, 1);
                    stopScanning(); // สแกนติดแล้วปิดกล้องทันที
                },
                () => {} // ignore scan failure
            ).catch(err => {
                setError("ไม่สามารถเปิดกล้องได้ โปรดตรวจสอบการอนุญาตใน Safari");
                setShowScanner(false);
            });
        }

        return () => {
            if (qrCodeInstance.current && qrCodeInstance.current.isScanning) {
                qrCodeInstance.current.stop().catch(() => {});
            }
        };
    }, [showScanner, currentStep, handleAddItemToCart]);

    return (
        <div className="withdraw-page-container">
            <div className="withdraw-title-section">
                <h2 className="text-2xl font-bold text-center w-full">เบิกอะไหล่</h2>
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
            
            <div className="withdraw-card">
                {currentStep === 1 && (
                    <div className="step-content-unlock">
                        <div className="unlock-icon-container">
                            <FaLockOpen size={48} />
                        </div>
                        
                        <h3 className="unlock-title">1. เปิดประตูกล่อง</h3>
                        <p className="unlock-subtitle">กรุณากดปุ่มเพื่อปลดล็อกและหยิบอะไหล่</p>
                        
                        <button 
                            onClick={handleOpenDoor} 
                            disabled={isProcessing} 
                            className="btn-unlock-gate"
                        >
                            {isProcessing ? (
                                <span className="loader"></span>
                            ) : (
                                <>
                                    <FaLockOpen />
                                    เปิดประตูกล่อง
                                </>
                            )}
                        </button>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="step-content-identify">
                        <div className="identify-header">
                            <h3 className="text-2xl font-bold text-gray-800">2. ระบุอะไหล่</h3>
                        </div>

                        <div className="input-group-modern">
                            <label className="input-label-modern">ครุภัณฑ์</label>
                            <div className="search-box-wrapper">
                                <div className="input-with-icon">
                                    <select 
                                        className="input-field select-dropdown" 
                                        value={assetId}
                                        onChange={(e) => setAssetId(e.target.value)}
                                        disabled={isProcessing}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
                                    >
                                        <option value="">-- เลือกครุภัณฑ์ --</option>
                                        {machines.map((mac, index) => (
                                            <option 
                                                key={mac.machine_id || index} 
                                                value={mac.machine_SN || mac.machine_sn} 
                                            >
                                                {mac.machine_name} {mac.machine_SN || mac.machine_sn ? `(${mac.machine_SN || mac.machine_sn})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* ส่วนที่ 2: สแกนบาร์โค้ด */}
                        <div className="scanner-action-area">
                            <div className="divider-with-text"><span>สแกนหรือเลือกรูปภาพ</span></div>
                            
                            <div id="reader" style={{ width: '100%', borderRadius: '15px', overflow: 'hidden' }}></div>

                            <div className="flex gap-2 mt-2">
                                {!showScanner ? (
                                    <button onClick={() => setShowScanner(true)} className="btn-modern-scanner flex-1">
                                        <FaCamera /> เปิดกล้องสแกน
                                    </button>
                                ) : (
                                    <button onClick={stopScanning} className="btn-modern-scanner flex-1" style={{ color: '#f43f5e', borderColor: '#f43f5e' }}>
                                        <FaTimes /> ปิดกล้อง
                                    </button>
                                )}
                                
                                {/* เพิ่มปุ่มเลือกรูปภาพ เพื่อแก้ปัญหา iOS อ่านบาร์โค้ดจากรูปภาพในระบบไม่ได้ */}
                                <label className="btn-modern-scanner flex-1 cursor-pointer">
                                    <FaImage /> เลือกรูปภาพ
                                    <input type="file" accept="image/*" onChange={handleFileScan} style={{ display: 'none' }} />
                                </label>
                            </div>
                        </div>

                        {/* ส่วนที่ 3: ระบุรหัสอะไหล่ด้วยตนเอง */}
                        <div className="input-group-modern">
                            <label className="input-label-modern">ระบุรหัสอะไหล่</label>
                            <div className="part-input-row">
                                <div className="flex-grow-input relative">
                                    <div className="input-with-icon">
                                        <FaPlus className="icon-prefix" />
                                        <input 
                                            type="text" 
                                            className="withdraw-input-modern" 
                                            value={currentPartId} 
                                            onChange={(e) => handlePartSearch(e.target.value)} 
                                            placeholder="พิมพ์รหัสอะไหล่..." 
                                        />
                                    </div>
                                    {/* Part Suggestions List ตามเดิม */}
                                    {partSuggestions.length > 0 && (
                                        <ul className="search-suggestions-list">
                                            {partSuggestions.map((p) => (
                                                <li key={p.equipment_id} onClick={() => { handleAddItemToCart(p.equipment_id); setPartSuggestions([]); }}>
                                                    <div className="flex justify-between w-full">
                                                        <span>{p.equipment_name}</span>
                                                        <span className="text-pink-500 font-bold">{p.equipment_id}</span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <button onClick={() => handleAddItemToCart()} className="btn-add-part-modern">
                                    <FaPlus size={20} />
                                </button>
                            </div>
                        </div>

                        {/* ส่วนที่ 4: ตะกร้าสินค้า (จะปรากฏเมื่อมีของ) */}
                        {cartItems.length > 0 && (
                            <div className="cart-section animate-fadeIn">
                                <h4 className="cart-header">รายการในตะกร้า ({cartItems.length})</h4>
                                <div className="cart-list">
                                    {/* ใช้โครงสร้าง Item ในตะกร้าที่คุณปรับปรุงไว้ก่อนหน้านี้ */}
                                    {cartItems.map((item, idx) => (
                                        <div key={idx} className="new-cart-item">
                                            <div className="item-thumb" onClick={() => item.imageUrl && setPreviewImage(`${API_BASE}/uploads/${item.imageUrl}`)}>
                                                {item.imageUrl ? <img src={`${API_BASE}/uploads/${item.imageUrl}`} alt="img" /> : <FaPlus />}
                                            </div>
                                            <div className="item-info">
                                                <div className="item-name">{item.partName}</div>
                                                <div className="item-lot">Lot: {item.lotId}</div>
                                            </div>
                                            <div className="item-controls">
                                                <div className="qty-stepper">
                                                    <button onClick={() => updateItemQuantity(idx, -1)}><FaMinus /></button>
                                                    <span>{item.quantity}</span>
                                                    <button onClick={() => updateItemQuantity(idx, 1)}><FaPlus /></button>
                                                </div>
                                                <button onClick={() => setCartItems(cartItems.filter((_, i) => i !== idx))} className="btn-delete-small">
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => setCurrentStep(3)} className="btn-review-confirm flex-2">
                                    ตรวจสอบรายการ
                                </button>
                            </div>
                        )}

                        {/* ส่วนที่ 5: ปุ่มยกเลิกด้านล่างสุด */}
                        <div className="footer-actions">
                            <button onClick={handleCancelStep2} className="btn-cancel-step2">
                                ยกเลิกการทำรายการ
                            </button>
                        </div>
                        
                        {error && <p className="error-badge mt-4">{error}</p>}
                    </div>
                )}

               
                {currentStep === 3 && (
                    <div className="step-content-review animate-fadeIn">
                        <div className="review-header-group">
                            <h3 className="text-2xl font-bold">3. ตรวจสอบข้อมูล</h3>
                            <p className="text-gray-400 text-sm">กรุณาตรวจสอบรายละเอียดก่อนบันทึก</p>
                        </div>

                        <div className="asset-info-banner">
                            <div className="label">ครุภัณฑ์ </div>
                            <div className="value">
                                {machines.find(mac => (mac.machine_SN || mac.machine_sn) === assetId)?.machine_name || "ไม่ทราบชื่อ"} <br></br> ({assetId})
                            </div>
                        </div>

                        <div className="review-list-container">
                            {cartItems.map((item, idx) => (
                                <div key={idx} className="review-item-card">
                                    <div className="item-img-box">
                                        <img src={item.imageUrl ? `${API_BASE}/uploads/${item.imageUrl}` : "https://placehold.co/60"} alt="part" />
                                    </div>
                                    <div className="item-main-info">
                                        <div className="item-name-row">
                                            <span className="name">{item.partName}</span>
                                            <div className="qty-display-group">
                                                <span className="qty-val">x {item.quantity}</span>
                                                <span className="unit-val">{item.unit || 'ชิ้น'}</span>
                                            </div>
                                        </div>
                                        <div className="item-sub-info">
                                            <span className="tag-lot">Lot: {item.lotId}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 mt-8 w-full">
                            <button onClick={() => setCurrentStep(2)} className="btn-review-edit flex-1">แก้ไขรายการ</button>
                            <button onClick={() => setCurrentStep(4)} className="btn-review-confirm flex-2">บันทึกข้อมูล</button>
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="step-content-confirmation">
                        <FaClipboardCheck size={64} className="text-blue-500 mb-4" />
                        <h3 className="text-2xl font-bold text-gray-800">4. ยืนยันการบันทึก</h3>
                        
                        <div className="confirmation-summary-card">
                            <span className="summary-header-label">สรุปรายละเอียดการเบิก</span>
                            
                            <div className="summary-data-row">
                                <span>วันที่:</span>
                                <b>{new Date().toLocaleDateString('th-TH')}</b>
                            </div>
                            
                            <div className="summary-data-row">
                                <span>ครุภัณฑ์:</span>
                            </div>

                            <div className="summary-items-list">
                                {cartItems.map((item, idx) => (
                                    <div key={idx} className="summary-item-line">
                                        <span className="text-gray-500">{item.partName}</span>
                                        <span>x {item.quantity} {item.unit || 'ชิ้น'}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="summary-total-footer">
                                <span>รวมทั้งสิ้น</span>
                                <div className="total-count-badge">
                                    {cartItems.reduce((sum, item) => sum + item.quantity, 0)} {cartItems[0]?.unit || 'รายการ'}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 w-full mt-2">
                            <button onClick={() => setCurrentStep(3)} className="btn-review-edit flex-1">กลับไปแก้ไข</button>
                            <button onClick={handleFinalConfirm} disabled={isProcessing} className="btn-action-primary flex-2">
                                ยืนยันและบันทึกข้อมูล
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 5 && (
                    <div className="step-content-success">
                        {/* ส่วนหัวแสดงความสำเร็จ */}
                        <div className="success-banner-modern">
                            <div className="success-icon-circle">
                                <FaCheckCircle />
                            </div>
                            <span className="success-text-main">บันทึกข้อมูลสำเร็จ!</span>
                        </div>

                        {/* ส่วนคำสั่งปิดประตู */}
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">5. สั่งปิดประตู</h3>
                        <p className="instruction-text">
                            ตรวจสอบสิ่งกีดขวางบริเวณหน้ากล่องให้เรียบร้อย แล้วกดปุ่มเพื่อล็อกตู้
                        </p>

                        {/* ปุ่มแอ็คชั่นหลัก */}
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

            {previewImage && (
                <div className="image-viewer-overlay" onClick={() => setPreviewImage(null)}>
                    <div className="image-viewer-content">
                        <img src={previewImage} alt="Preview" />
                        <button className="close-image-btn" onClick={() => setPreviewImage(null)}><FaTimes /></button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WithdrawPage;