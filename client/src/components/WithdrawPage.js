import React, { useState, useEffect, useCallback } from 'react';
import { 
    FaCheckCircle, FaPlus, FaCamera, FaTrash, 
    FaMinus, FaClipboardCheck, FaTimes, FaSearch
} from 'react-icons/fa'; 
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';
import './WithdrawPage.css';

const API_BASE = process.env.REACT_APP_API_URL;
const STORAGE_KEY = 'mems_withdraw_session';

function WithdrawPage({ user, setIsLocked }) { 
    const [currentStep, setCurrentStep] = useState(1);
    const [machineId, setMachineId] = useState(''); 
    const [machineNumber, setMachineNumber] = useState(''); 
    const [machineSN, setMachineSN] = useState(''); 
    const [selectedBuilding, setSelectedBuilding] = useState(''); 
    const [departmentId, setDepartmentId] = useState(''); 
    const [repairTypeId, setRepairTypeId] = useState('');

    const [machines, setMachines] = useState([]); 
    const [departments, setDepartments] = useState([]); 
    const [filteredDeps, setFilteredDeps] = useState([]); 
    const [repairTypes, setRepairTypes] = useState([]);

    const [currentPartId, setCurrentPartId] = useState('');
    const [cartItems, setCartItems] = useState([]);
    const [partSuggestions, setPartSuggestions] = useState([]);
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);

    // ดึง Session ที่ทำค้างไว้
    useEffect(() => {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            const data = JSON.parse(savedData);
            if (window.confirm("คุณมีรายการเบิกที่ทำค้างไว้ ต้องการทำต่อหรือไม่?")) {
                setCurrentStep(data.currentStep);
                setMachineId(data.machineId);
                setMachineNumber(data.machineNumber);
                setMachineSN(data.machineSN);
                setSelectedBuilding(data.selectedBuilding);
                setDepartmentId(data.departmentId);
                setRepairTypeId(data.repairTypeId);
                setCartItems(data.cartItems);
                if (setIsLocked) setIsLocked(true);
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    }, [setIsLocked]);

    // บันทึก Session กันหาย
    useEffect(() => {
        if ((currentStep === 1 && cartItems.length > 0) || currentStep === 2) {
            const sessionData = {
                currentStep, machineId, machineNumber, machineSN,
                selectedBuilding, departmentId, repairTypeId, cartItems
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
        } else if (cartItems.length === 0) {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [currentStep, machineId, machineNumber, machineSN, selectedBuilding, departmentId, repairTypeId, cartItems]);

    // แจ้งเตือนก่อนปิดหน้าเว็บ
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if ((currentStep === 1 && cartItems.length > 0) || currentStep === 2) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [currentStep, cartItems]);

    // รีเซ็ตฟอร์ม
    const handleResetForm = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setCurrentStep(1);
        setMachineId('');
        setMachineNumber('');
        setMachineSN('');
        setSelectedBuilding('');
        setDepartmentId('');
        setRepairTypeId('');
        setCartItems([]);
        setCurrentPartId('');
        setError('');
        setShowScanner(false);
        if (setIsLocked) setIsLocked(false);
    }, [setIsLocked]);

    // Fetch Master Data
    useEffect(() => {
        const fetchMasterData = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = { Authorization: `Bearer ${token}` };
                const [macRes, depRes, repairRes] = await Promise.all([
                    axios.get(`${API_BASE}/api/machine`, { headers }),
                    axios.get(`${API_BASE}/api/departments`, { headers }),
                    axios.get(`${API_BASE}/api/repair-types`, { headers })
                ]);
                setMachines(macRes.data);
                setDepartments(depRes.data);
                setRepairTypes(repairRes.data);
            } catch (err) {
                console.error("Fetch master data error:", err);
            }
        };
        fetchMasterData();
    }, []);

    // Filter Departments based on Building
    useEffect(() => {
        if (selectedBuilding) {
            const filtered = departments.filter(d => d.buildings === selectedBuilding);
            setFilteredDeps(filtered);
        } else {
            setFilteredDeps([]);
        }
    }, [selectedBuilding, departments]);

    // ค้นหาอะไหล่
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

    // เพิ่มอะไหล่ลงตะกร้า
    const handleAddItemToCart = useCallback(async (scannedId, quantity = 1) => {
        if (isProcessing) return;
        const idToSearch = scannedId || currentPartId;
        
        if (!machineId || !machineNumber || !departmentId || !repairTypeId) { 
            setError('กรุณาระบุข้อมูลประเภทงาน เครื่อง และสถานที่ให้ครบถ้วน'); 
            return; 
        }
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
                const currentQtyInCart = existing ? existing.quantity : 0;

                if (currentQtyInCart + quantity > partInfo.currentStock) {
                    setTimeout(() => setError(`ไม่สามารถเพิ่มได้! สต๊อกคงเหลือเพียง ${partInfo.currentStock} ${partInfo.unit}`), 0);
                    return prev; 
                }

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
    }, [machineId, machineNumber, departmentId, repairTypeId, currentPartId, isProcessing]);

    // บันทึกรายการเบิก
    const handleFinalConfirm = async () => {
        if (cartItems.length === 0) return;
        setIsProcessing(true);
        setError("");
        try {
            const token = localStorage.getItem('token');
            const payload = { 
                machine_id: machineId, machine_number: machineNumber, machine_SN: machineSN,
                department_id: departmentId, repair_type_id: repairTypeId,
                cartItems: cartItems.map(item => ({ lotId: item.lotId, quantity: item.quantity })) 
            };
            await axios.post(`${API_BASE}/api/withdraw/confirm`, payload, { headers: { Authorization: `Bearer ${token}` } });
            
            alert("บันทึกข้อมูลการเบิกสำเร็จ!");
            handleResetForm();
        } catch (err) {
            setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } finally {
            setIsProcessing(false);
        }
    };

    // อัปเดตจำนวนสินค้า
    const updateItemQuantity = (index, delta) => {
        setCartItems(prev => {
            const newItems = [...prev];
            const item = newItems[index];
            const newQty = item.quantity + delta;
            if (delta > 0 && newQty > item.currentStock) {
                setTimeout(() => setError(`สต๊อกไม่พอ! อะไหล่นี้มีคงเหลือเพียง ${item.currentStock} ${item.unit}`), 0);
                return prev; 
            }
            setTimeout(() => setError(''), 0); 
            if (newQty > 0) newItems[index] = { ...item, quantity: newQty };
            return newItems;
        });
    };

    // Scanner
    useEffect(() => {
        let scanner = null;
        if (showScanner && currentStep === 1) { 
            scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 350, height: 150 } });
            scanner.render((decodedText) => {
                handleAddItemToCart(decodedText, 1);
                setShowScanner(false);
                scanner.clear();
            }, () => {});
        }
        return () => { if (scanner) scanner.clear().catch(() => {}); };
    }, [showScanner, currentStep, handleAddItemToCart]);

    return (
        <div className="withdraw-page-container">
            <div className="withdraw-title-section">
                <h2 className="text-2xl font-bold text-center w-full">เบิกอะไหล่</h2>
                <div className="step-progress-bar">
                    {[1, 2].map((step) => (
                        <React.Fragment key={step}>
                            <div className={`step-item ${currentStep >= step ? 'active' : ''}`}>
                                <div className="step-circle">{currentStep > step ? <FaCheckCircle /> : step}</div>
                            </div>
                            {step < 2 && <div className={`step-line ${currentStep > step ? 'active' : ''}`}></div>}
                        </React.Fragment>
                    ))}
                </div>
            </div>
            
            <div className="withdraw-card">
                
                {currentStep === 1 && (
                    <div className="step-content-identify">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">1. ระบุอะไหล่และสถานที่ใช้</h3>

                        <div className="input-group-modern mb-4">
                            <label className="input-label-modern">ประเภทงาน</label>
                            <select className="withdraw-input-modern" value={repairTypeId} onChange={(e) => setRepairTypeId(e.target.value)}>
                                <option value="">-- เลือกประเภทงาน --</option>
                                {repairTypes.map(rt => (
                                    <option key={rt.repair_type_id} value={rt.repair_type_id}>{rt.repair_type_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group-modern">
                            <label className="input-label-modern">เครื่องที่นำไปใช้</label>
                            <select className="withdraw-input-modern" value={machineId} onChange={(e) => setMachineId(e.target.value)}>
                                <option value="">-- เลือกเครื่องมือ --</option>
                                {machines.map(m => (
                                    <option key={m.machine_id} value={m.machine_id}>
                                        {`${m.machine_type_name} - ${m.machine_supplier} - ${m.machine_model}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-2 mb-4">
                            <div className="flex-1">
                                <label className="text-xs text-gray-500">เลขครุภัณฑ์ (รพ.)</label>
                                <input type="text" className="withdraw-input-modern" placeholder="เช่น 1234/67" value={machineNumber} onChange={(e) => setMachineNumber(e.target.value)} />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-gray-500">SN (โรงงาน)</label>
                                <input type="text" className="withdraw-input-modern" placeholder="Serial Number" value={machineSN} onChange={(e) => setMachineSN(e.target.value)} />
                            </div>
                        </div>

                        <div className="flex gap-2 mb-6">
                            <div className="flex-1">
                                <label className="text-xs text-gray-500">ตึก </label>
                                <select className="withdraw-input-modern" value={selectedBuilding} onChange={(e) => { setSelectedBuilding(e.target.value); setDepartmentId(''); }}>
                                    <option value="">-- เลือกตึก --</option>
                                    {[...new Set(departments.map(d => d.buildings))].map(b => (<option key={b} value={b}>{b}</option>))}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-gray-500">แผนก </label>
                                <select className="withdraw-input-modern" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} disabled={!selectedBuilding}>
                                    <option value="">-- เลือกแผนก --</option>
                                    {filteredDeps.map(d => (<option key={d.department_id} value={d.department_id}>{d.department_name}</option>))}
                                </select>
                            </div>
                        </div>

                        <div className="divider-with-text"><span>ระบุอะไหล่</span></div>

                        <div className="scanner-action-area">
                            {showScanner ? <div id="reader"></div> : (
                                <button onClick={() => setShowScanner(true)} className="btn-modern-scanner">
                                    <FaCamera /> สแกนบาร์โค้ดอะไหล่
                                </button>
                            )}
                        </div>

                        <div className="input-group-modern mt-4">
                            <div className="part-input-row">
                                <div className="flex-grow-input relative">
                                    <div className="input-with-icon">
                                        <FaSearch className="icon-prefix" />
                                        <input type="text" className="withdraw-input-modern" value={currentPartId} onChange={(e) => handlePartSearch(e.target.value)} placeholder="พิมพ์รหัสอะไหล่..." />
                                    </div>
                                    {partSuggestions.length > 0 && (
                                        <ul className="search-suggestions-list">
                                            {partSuggestions.map((p) => (
                                                <li key={p.equipment_id} onClick={() => { handleAddItemToCart(p.equipment_id); setPartSuggestions([]); }}>
                                                    <div className="flex justify-between w-full"><span>{p.equipment_name}</span><span className="text-pink-500 font-bold">{p.equipment_id}</span></div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <button onClick={() => handleAddItemToCart()} className="btn-add-part-modern"><FaPlus /></button>
                            </div>
                        </div>

                        {cartItems.length > 0 && (
                            <div className="cart-section animate-fadeIn">
                                <h4 className="cart-header">รายการในตะกร้า ({cartItems.length})</h4>
                                <div className="cart-list">
                                    {cartItems.map((item, idx) => (
                                        <div key={idx} className="new-cart-item">
                                            <div className="item-thumb" onClick={() => item.imageUrl && setPreviewImage(`${API_BASE}/uploads/${item.imageUrl}`)}>
                                                {item.imageUrl ? <img src={`${API_BASE}/uploads/${item.imageUrl}`} alt="img" /> : <FaPlus />}
                                            </div>
                                            <div className="item-info"><div className="item-name">{item.partName}</div><div className="item-lot">Lot: {item.lotId}</div></div>
                                            <div className="item-controls">
                                                <div className="qty-stepper">
                                                    <button onClick={() => updateItemQuantity(idx, -1)}><FaMinus /></button>
                                                    <span>{item.quantity}</span>
                                                    <button onClick={() => updateItemQuantity(idx, 1)}><FaPlus /></button>
                                                </div>
                                                <button onClick={() => setCartItems(cartItems.filter((_, i) => i !== idx))} className="btn-delete-small"><FaTrash /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-center w-full mt-4">
                                    <button onClick={() => setCurrentStep(2)} className="btn-review-confirm" style={{ maxWidth: '320px' }}>ตรวจสอบรายการ</button>
                                </div>
                            </div>
                        )}

                        <div className="footer-actions mt-4">
                            <button onClick={() => { if(window.confirm("ต้องการยกเลิกรายการทั้งหมดใช่หรือไม่?")) { handleResetForm(); } }} className="btn-cancel-step2">ยกเลิกทำรายการ</button>
                        </div>
                        {error && <p className="error-badge mt-4">{error}</p>}
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="step-content-confirmation">
                        <FaClipboardCheck size={64} className="text-blue-500 mb-4" />
                        <h3 className="text-2xl font-bold mb-4">2. ตรวจสอบและยืนยันการบันทึก</h3>
                        <div className="confirmation-summary-card">
                            <span className="summary-header-label" style={{ color: '#3b82f6' }}>สรุปรายละเอียดการเบิก</span>
                            <div className="info-row-summary"><span className="info-label">วันที่เบิก:</span><span className="info-value">{new Date().toLocaleDateString('th-TH')}</span></div>
                            <div className="info-row-summary"><span className="info-label">ประเภทรายการ:</span><span className="info-value">เบิกอะไหล่ ({repairTypes.find(rt => rt.repair_type_id === Number(repairTypeId))?.repair_type_name})</span></div>
                            <div className="summary-data-row border-t pt-2 mt-2"><span className="text-blue-600">ข้อมูลเครื่องที่นำไปใช้ : </span></div>
                            <div className="ml-2 text-sm">
                                <div className="flex justify-between">
                                    <span>เครื่องที่นำไปใช้ : </span>
                                    <b>
                                        {(() => {
                                            const selectedMac = machines.find(m => m.machine_id === machineId);
                                            return selectedMac 
                                                ? `${selectedMac.machine_type_name} - ${selectedMac.machine_supplier} - ${selectedMac.machine_model}`
                                                : "-";
                                        })()}
                                    </b>
                                </div>
                                <div className="flex justify-between"><span>เลขครุภัณฑ์ (รพ.) : </span><b>{machineNumber || "-"}</b></div>
                                <div className="flex justify-between"><span>SN (โรงงาน) : </span><b>{machineSN || "-"}</b></div>
                                <div className="mt-2 text-sm text-gray-600">ตึก : <b>{selectedBuilding} </b> | แผนก : <b>{departments.find(d => d.department_id === departmentId)?.department_name}</b></div>
                            </div>
                            <div className="summary-data-row border-t pt-2 mt-2"><span className="text-blue-600">รายการอะไหล่ที่เบิก:</span></div>
                            <div className="summary-items-list">
                                {cartItems.map((item, idx) => (
                                    <div key={idx} className="summary-item-line">
                                        <div className="flex flex-col"><span className="font-bold text-gray-800">{item.partName}</span><span className="text-xs text-gray-500"></span></div>
                                        <span className="font-bold">x {item.quantity} {item.unit || 'ชิ้น'}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="summary-total-footer mt-4"><span>รวมอะไหล่ทั้งสิ้น</span><div className="total-count-badge">{cartItems.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น</div></div>
                        </div>
                        <div className="flex gap-4 w-full mt-6">
                            <button onClick={() => setCurrentStep(1)} className="btn-review-edit flex-1">กลับไปแก้ไข</button>
                            <button onClick={() => { if(window.confirm("ต้องการยกเลิกรายการทั้งหมดใช่หรือไม่?")) { handleResetForm(); } }} className="btn-cancel-step2 flex-1">ยกเลิกทำรายการ</button>
                            <button onClick={handleFinalConfirm} disabled={isProcessing} className="btn-action-primary flex-2">{isProcessing ? "กำลังบันทึก..." : "ยืนยันและบันทึก"}</button>
                        </div>
                        {error && <p className="error-badge mt-4">{error}</p>}
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