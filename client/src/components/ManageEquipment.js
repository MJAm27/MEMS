import React, { useState, useEffect } from "react";
import "./ManageEquipment.css";
import { FaPlus, FaSearch, FaEdit, FaTrash, FaTimes } from "react-icons/fa";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL;

function ManageEquipment() {
  const [inventory, setInventory] = useState([]); // ข้อมูลตารางหลัก
  const [masterData, setMasterData] = useState({ suppliers: [], equipmentTypes: [], equipments: [] });
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // --- States ควบคุมการเลือก "ข้อมูลเดิม" หรือ "สร้างใหม่" ---
  const [isNewSupplier, setIsNewSupplier] = useState(false);
  const [isNewType, setIsNewType] = useState(false);
  const [isNewEquipment, setIsNewEquipment] = useState(false);

  // --- Form Data แยกส่วน ---
  const [lotData, setLotData] = useState({ 
    lot_id: "", import_date: "", expire_date: "", current_quantity: 0, price: 0 
  });
  const [supplierData, setSupplierData] = useState({ supplier_id: "", supplier_name: "", contact: "" });
  const [typeData, setTypeData] = useState({ equipment_type_id: "", equipment_name: "", img: "", unit: "" });
  const [equipmentData, setEquipmentData] = useState({ equipment_id: "", alert_quantity: 10, model_size: "" });

  useEffect(() => {
    fetchData();
    fetchMasterData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/inventory`);
      setInventory(res.data);
    } catch (error) { console.error("Error fetching inventory:", error); }
  };

  const fetchMasterData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/master-data`);
      setMasterData(res.data);
    } catch (error) { console.error("Error fetching master data:", error); }
  };
  
  const [isUploading, setIsUploading] = useState(false); // State บอกสถานะการอัปโหลด

  // 3. ฟังก์ชันสำหรับอัปโหลดรูปทันทีที่เลือกไฟล์
  const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('image', file);

      setIsUploading(true);
      try {
          const res = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });
          // เมื่ออัปโหลดเสร็จ Server ส่ง URL กลับมา -> เราเอาไปใส่ใน form state
          setTypeData({ ...typeData, img: res.data.url });
      } catch (error) {
          alert("อัปโหลดรูปไม่สำเร็จ");
          console.error(error);
      } finally {
          setIsUploading(false);
      }
  };

  // --- Handlers ---
  const handleAddNew = () => {
    setIsEditMode(false);
    // Reset Data
    setLotData({ lot_id: "", import_date: "", expire_date: "", current_quantity: 0, price: 0 });
    setSupplierData({ supplier_id: "", supplier_name: "", contact: "" });
    setTypeData({ equipment_type_id: "", equipment_name: "", img: "", unit: "" });
    setEquipmentData({ equipment_id: "", alert_quantity: 10, model_size: "" });
    
    // Reset Modes
    setIsNewSupplier(false);
    setIsNewType(false);
    setIsNewEquipment(false);
    
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setIsEditMode(true);
    // Load Data to Forms
    setLotData({
      lot_id: item.lot_id,
      import_date: item.import_date ? item.import_date.split('T')[0] : "",
      expire_date: item.expiry_date ? item.expiry_date.split('T')[0] : "",
      current_quantity: item.current_quantity,
      price: item.cost_price
    });
    setSupplierData({ supplier_id: item.supplier_id, supplier_name: item.supplier_name, contact: item.contact_info || "" });
    setTypeData({ equipment_type_id: item.equipment_type_id, equipment_name: item.equipment_name, img: item.img, unit: item.unit });
    setEquipmentData({ equipment_id: item.equipment_id, alert_quantity: item.alert_quantity, model_size: item.model_size });

    // ในโหมดแก้ไข บังคับเป็นโหมดกรอกเองเพื่อให้แก้ไขค่าได้ (แต่ ID จะถูกล็อคที่ Backend หรือ Frontend ตามต้องการ)
    setIsNewSupplier(true); 
    setIsNewType(true);
    setIsNewEquipment(true);

    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm(`ต้องการลบ Lot ${id} ใช่หรือไม่?`)) {
      try {
        await axios.delete(`${API_BASE_URL}/api/inventory/${id}`);
        fetchData();
      } catch (error) { alert("ลบไม่สำเร็จ"); }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
        isNewSupplier, isNewType, isNewEquipment,
        lotData, supplierData, typeData, equipmentData
    };

    try {
        if (isEditMode) {
            await axios.put(`${API_BASE_URL}/api/inventory/update/${lotData.lot_id}`, payload);
            alert("แก้ไขข้อมูลสำเร็จ");
        } else {
            await axios.post(`${API_BASE_URL}/api/inventory/add`, payload);
            alert("เพิ่มข้อมูลสำเร็จ");
        }
        setShowModal(false);
        fetchData();
        fetchMasterData(); // Refresh dropdowns
    } catch (error) {
        alert("เกิดข้อผิดพลาด: " + (error.response?.data?.message || error.message));
    }
  };

  // --- Helper to handle Dropdown Selection ---
  const handleSelectMaster = (type, id) => {
      if (type === 'supplier') {
          const s = masterData.suppliers.find(x => x.supplier_id === id);
          if (s) setSupplierData({ supplier_id: s.supplier_id, supplier_name: s.supplier_name, contact: s.contact_info || "" });
      }
      if (type === 'type') {
        const t = masterData.equipmentTypes.find(x => x.equipment_type_id === id);
        if (t) setTypeData({ equipment_type_id: t.equipment_type_id, equipment_name: t.equipment_name, img: t.img || "", unit: t.unit });
      }
      if (type === 'equipment') {
        const e = masterData.equipments.find(x => x.equipment_id === id);
        if (e) setEquipmentData({ equipment_id: e.equipment_id, alert_quantity: e.alert_quantity, model_size: e.model_size });
      }
  };

  const filteredInventory = inventory.filter(item => 
    item.equipment_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.lot_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const [previewImage, setPreviewImage] = useState(null);

  return (
    <div className="manage-equipment-container fade-in">
      <div className="page-header">
        <h2 className="page-title-text">จัดการข้อมูลอะไหล่</h2>
        <button className="btn-primary" onClick={handleAddNew}><FaPlus />เพิ่มอะไหล่ใหม่</button>
      </div>

      <div className="search-bar-wrapper">
        <FaSearch className="search-icon" />
        <input type="text" placeholder="ค้นหา Lot ID หรือ ชื่ออุปกรณ์..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="table-container">
        <table className="custom-table">
            <thead>
                <tr>
                    <th>รูปภาพ</th>
                    <th>Lot ID</th>
                    <th>ชื่ออุปกรณ์</th>
                    <th>Model/Size</th>
                    <th>Supplier</th>
                    <th>คงเหลือ</th>
                    <th>วันที่นำเข้า</th>
                    <th>วันหมดอายุ</th>
                    <th>ราคา</th>
                    <th>จัดการ</th>
                </tr>
            </thead>
            <tbody>
                {filteredInventory.map(item => (
                    <tr key={item.lot_id}>
                        <td style={{ textAlign: "center" }}>{item.img ? (
                          <img 
                            src={item.img} 
                            alt="Equipment"
                            // คลิกแล้วเรียกใช้ฟังก์ชันขยายรูปเหมือนใน Modal
                            onClick={() => setPreviewImage(item.img)} 
                            style={{ 
                              width: '50px', 
                              height: '50px', 
                              objectFit: 'cover', 
                              borderRadius: '6px',
                              cursor: 'pointer',
                              border: '1px solid #eee'
                            }}
                            title="คลิกเพื่อขยาย"
                          />
                        ) : (
                          <div style={{ color: '#ccc', fontSize: '0.8rem' }}>ไม่มีรูป</div>
                        )}</td>
                        <td className="text-primary fw-bold">{item.lot_id}</td>
                        <td>{item.equipment_name}</td>
                        <td>{item.model_size}</td>
                        <td>{item.supplier_name}</td>
                        <td className="text-center">{item.current_quantity} {item.unit}</td>
                        <td>{new Date(item.import_date).toLocaleDateString('th-TH')}</td>
                        <td>{new Date(item.expiry_date).toLocaleDateString('th-TH')}</td>
                        <td>{item.cost_price}</td>
                        <td>
                            <button className="action-btn edit-btn" onClick={() => handleEdit(item)}><FaEdit /></button>
                            <button className="action-btn delete-btn" onClick={() => handleDelete(item.lot_id)}><FaTrash /></button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content large-modal">
            <form onSubmit={handleSubmit}>
                <div className="modal-header">
                    <h3>{isEditMode ? `แก้ไขข้อมูลอะไหล่ Lot: ${lotData.lot_id}` : "เพิ่มข้อมูลอะไหล่"}</h3>
                    <button type="button" className="close-btn" onClick={() => setShowModal(false)}><FaTimes /></button>
                </div>
                <div className="modal-body" style={{maxHeight: '70vh', overflowY: 'auto'}}>
                    
                    {/* 1. Supplier Form */}
                    <div className="section-box">
                        <h4>1. ข้อมูล Supplier</h4>
                        {!isEditMode && (
                            <div className="toggle-row">
                                <label><input type="radio" checked={!isNewSupplier} onChange={() => setIsNewSupplier(false)} /> เลือกที่มีอยู่</label>
                                <label><input type="radio" checked={isNewSupplier} onChange={() => setIsNewSupplier(true)} /> สร้างใหม่</label>
                            </div>
                        )}
                        {!isNewSupplier && !isEditMode ? (
                             <select className="form-control" onChange={(e) => handleSelectMaster('supplier', e.target.value)}>
                                <option value="">-- เลือก Supplier --</option>
                                {masterData.suppliers?.map(s => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
                             </select>
                        ) : (
                            <div className="form-row">
                              {/* ////// เป็นตัวเลขไม่เกิน 11 หลัก */}
                                <input placeholder="Supplier ID *" value={supplierData.supplier_id} onChange={e => setSupplierData({...supplierData, supplier_id: e.target.value})} required disabled={isEditMode} />
                                <input placeholder="ชื่อบริษัท *" value={supplierData.supplier_name} onChange={e => setSupplierData({...supplierData, supplier_name: e.target.value})} required />
                                <input placeholder="เบอร์ติดต่อ" value={supplierData.contact} onChange={e => setSupplierData({...supplierData, contact: e.target.value})} />
                            </div>
                        )}
                    </div>

                    {/* 2. Equipment Type Form */}
                    <div className="section-box">
                        <h4>2. ประเภทอุปกรณ์ (Type)</h4>
                        {!isEditMode && (
                            <div className="toggle-row">
                                <label><input type="radio" checked={!isNewType} onChange={() => { setIsNewType(false); setIsNewEquipment(false); }} /> เลือกที่มีอยู่</label>
                                <label><input type="radio" checked={isNewType} onChange={() => { setIsNewType(true); setIsNewEquipment(true); }} /> สร้างใหม่</label>
                            </div>
                        )}
                         {!isNewType && !isEditMode ? (
                             <select className="form-control" onChange={(e) => handleSelectMaster('type', e.target.value)}>
                                <option value="">-- เลือกประเภท --</option>
                                {masterData.equipmentTypes?.map(t => <option key={t.equipment_type_id} value={t.equipment_type_id}>{t.equipment_name}</option>)}
                             </select>
                        ) : (
                            <div className="form-grid">
                                <input placeholder="Type ID *" value={typeData.equipment_type_id} onChange={e => setTypeData({...typeData, equipment_type_id: e.target.value})} required disabled={isEditMode} />
                                <input placeholder="ชื่ออุปกรณ์ *" value={typeData.equipment_name} onChange={e => setTypeData({...typeData, equipment_name: e.target.value})} required />
                                
                                <div className="file-upload-wrapper" style={{gridColumn: "span 2"}}>
                                    <label style={{display:'block', marginBottom:'5px', fontSize:'0.9rem'}}>รูปภาพอุปกรณ์:</label>
                                    {/* Input สำหรับเลือกไฟล์ */}
                                    <input type="file" accept="image/*" onChange={handleImageUpload} className="form-control" />
                                    
                                    {/* แสดงสถานะ หรือ Preview */}
                                    {isUploading && <p style={{color:'blue', fontSize:'0.8rem'}}>กำลังอัปโหลด...</p>}
                                    
                                    {/* แสดงรูปตัวอย่างถ้ามี URL แล้ว */}
                                    {typeData.img && (
                                        <div style={{marginTop:'10px'}}>
                                            <img 
                                                src={typeData.img} 
                                                alt="Preview" 
                                                // เพิ่ม onClick เพื่อส่ง URL ไปที่ state previewImage
                                                onClick={() => setPreviewImage(typeData.img)} 
                                                style={{ 
                                                    height: '100px', 
                                                    borderRadius: '8px', 
                                                    border: '1px solid #ddd', 
                                                    cursor: 'pointer', // เปลี่ยนเมาส์เป็นรูปนิ้วมือ
                                                    transition: 'transform 0.2s'
                                                }}
                                                // เพิ่ม Effect เล็กน้อยตอนเอาเมาส์ชี้
                                                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                            />
                                            <input type="hidden" value={typeData.img} /> {/* ซ่อน input text ไว้เก็บค่า URL ส่งไป backend */}
                                        </div>
                                    )}
                                </div>
                                <input placeholder="หน่วยนับ (เช่น ชิ้น)" value={typeData.unit} onChange={e => setTypeData({...typeData, unit: e.target.value})} required />
                            </div>
                        )}
                    </div>

                    {/* 3. Equipment Form */}
                    <div className="section-box">
                        <h4>3. รายละเอียดรุ่น (Model/Size)</h4>
                        {!isNewEquipment && !isEditMode && (
                             <select className="form-control" onChange={(e) => handleSelectMaster('equipment', e.target.value)}>
                                <option value="">-- เลือกรุ่นที่มีอยู่ --</option>
                                {masterData.equipments
                                    .filter(e => e.equipment_type_id === typeData.equipment_type_id) // Filter ตาม Type ที่เลือก
                                    ?.map(e => <option key={e.equipment_id} value={e.equipment_id}>{e.model_size}</option>)}
                             </select>
                        )}
                        {(isNewEquipment || isEditMode) && (
                            <div className="form-row">
                                <input placeholder="Equipment ID *" value={equipmentData.equipment_id} onChange={e => setEquipmentData({...equipmentData, equipment_id: e.target.value})} required disabled={isEditMode} />
                                <input placeholder="Model / Size *" value={equipmentData.model_size} onChange={e => setEquipmentData({...equipmentData, model_size: e.target.value})} required />
                                <input type="number" placeholder="Alert Qty" value={equipmentData.alert_quantity} onChange={e => setEquipmentData({...equipmentData, alert_quantity: e.target.value})} />
                            </div>
                        )}
                    </div>

                    {/* 4. LOT Form */}
                    <div className="section-box highlight-box">
                        <h4>4. ข้อมูล Lot (สินค้าเข้า)</h4>
                        <div className="form-row">
                            <div className="col-half">
                                <label>วันที่นำเข้า</label>
                                <input type="date" value={lotData.import_date} onChange={e => setLotData({...lotData, import_date: e.target.value})} required />
                            </div>
                            <div className="col-half">
                                <label>วันหมดอายุ</label>
                                <input type="date" value={lotData.expire_date} onChange={e => setLotData({...lotData, expire_date: e.target.value})} required />
                            </div>
                        </div>
                        <div className="form-row">
                             <div className="col-half">
                                <label>จำนวน (Quantity)</label>
                                <input type="number" value={lotData.current_quantity} onChange={e => setLotData({...lotData, current_quantity: e.target.value})} required />
                             </div>
                             <div className="col-half">
                                <label>ราคาต้นทุน (Price)</label>
                                <input type="number" value={lotData.price} onChange={e => setLotData({...lotData, price: e.target.value})} required />
                             </div>
                        </div>
                    </div>

                </div>
                <div className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>ยกเลิก</button>
                    <button type="submit" className="btn-primary">บันทึกข้อมูล</button>
                </div>
            </form>
          </div>
        </div>
      )}
      {previewImage && (
        <div className="image-viewer-overlay" onClick={() => setPreviewImage(null)}>
          <div className="image-viewer-content">
            <img src={previewImage} alt="Full Screen" />
            <button className="close-image-btn" onClick={() => setPreviewImage(null)}>
              <FaTimes />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageEquipment;