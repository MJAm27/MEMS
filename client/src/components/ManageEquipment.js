import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; 
import "./ManageEquipment.css";
import { FaPlus, FaSearch, FaTimes, FaBoxOpen, FaEdit, FaTrash } from "react-icons/fa";
import axios from "axios";
import SubNavbar from "./SubNavbar";

const API_BASE_URL = process.env.REACT_APP_API_URL;

function ManageEquipment() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]); 
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // +++ รวม State ให้เหลือแค่ฟอร์มของอะไหล่ +++
  const [formData, setFormData] = useState({
    equipment_id: "",
    equipment_type_id: "",
    equipment_name: "",
    model_size: "",
    alert_quantity: 10,
    unit: "",
    img: ""
  });

  const [isUploading, setIsUploading] = useState(false); 
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/inventory`);
      setInventory(res.data);
    } catch (error) { console.error("Error fetching inventory:", error); }
  };

  // +++ ฟังก์ชันอัปโหลดรูปภาพ (รับชื่อไฟล์กลับมา) +++
  const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const uploadData = new FormData();
      uploadData.append('image', file);

      setIsUploading(true);
      try {
          const res = await axios.post(`${API_BASE_URL}/api/upload`, uploadData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });
          // เก็บชื่อไฟล์ที่ได้จาก Backend ไว้ใน State
          setFormData({ ...formData, img: res.data.filename });
      } catch (error) {
          alert("อัปโหลดรูปไม่สำเร็จ");
          console.error(error);
      } finally {
          setIsUploading(false);
      }
  };

  const handleAddNew = () => {
    setIsEditMode(false);
    setFormData({
      equipment_id: "", equipment_type_id: "", equipment_name: "", 
      model_size: "", alert_quantity: 10, unit: "", img: ""
    });
    setShowModal(true);
  };

  const handleEditEquipment = (item) => {
    setIsEditMode(true);
    setFormData({
      equipment_id: item.equipment_id,
      equipment_type_id: item.equipment_type_id || "",
      equipment_name: item.equipment_name || "",
      model_size: item.model_size || "",
      alert_quantity: item.alert_quantity || 10,
      unit: item.unit || "",
      img: item.img || ""
    });
    setShowModal(true);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
        if (isEditMode) {
            // ส่งข้อมูลไปอัปเดต (ต้องแก้ URL API ให้ตรงกับของจริง)
            await axios.put(`${API_BASE_URL}/api/equipment/update/${formData.equipment_id}`, formData);
            alert("แก้ไขข้อมูลอะไหล่สำเร็จ");
        } else {
            // ส่งข้อมูลไปเพิ่มใหม่ (ต้องแก้ URL API ให้ตรงกับของจริง)
            await axios.post(`${API_BASE_URL}/api/equipment/add`, formData);
            alert("เพิ่มข้อมูลอะไหล่สำเร็จ");
        }
        setShowModal(false);
        fetchData();
    } catch (error) {
        alert("เกิดข้อผิดพลาด: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteEquipment = async (equipmentId) => {
    if (window.confirm(`ต้องการลบอะไหล่รหัส ${equipmentId} ใช่หรือไม่?\n(ข้อควรระวัง: การลบอะไหล่หลักอาจมีผลกับ Lot ทั้งหมดของอะไหล่นี้)`)) {
      try {
        await axios.delete(`${API_BASE_URL}/api/equipment/${equipmentId}`);
        alert("ลบข้อมูลอะไหล่สำเร็จ");
        fetchData();
      } catch (error) { 
        alert("ลบไม่สำเร็จ กรุณาตรวจสอบว่ามี Lot ค้างอยู่หรือไม่"); 
      }
    }
  };

  // จัดกลุ่มข้อมูลให้ไม่ซ้ำรหัสอะไหล่
  const uniqueEquipments = [];
  const equipmentMap = new Map();
  inventory.forEach(item => {
      if (!equipmentMap.has(item.equipment_id)) {
          equipmentMap.set(item.equipment_id, true);
          uniqueEquipments.push(item);
      }
  });

  const filteredEquipments = uniqueEquipments.filter(item => 
    item.equipment_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.equipment_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="manage-equipment-container fade-in">
      <div className="page-header">
        <SubNavbar />
          <div className="header-title">
              <h2 className="page-title-text">จัดการข้อมูลอะไหล่</h2>
          </div>
          <div className="header-actions" style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-primary" onClick={handleAddNew}>
                  <FaPlus /> เพิ่มอะไหล่ใหม่
              </button>
          </div>
      </div>

      <div className="search-bar-wrapper">
        <FaSearch className="search-icon" />
        <input type="text" placeholder="ค้นหา รหัสอะไหล่ หรือ ชื่ออะไหล่..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="table-container">
        <table className="custom-table">
            <thead>
                <tr>
                    <th>รูปภาพ</th>
                    <th>รหัสประเภท</th>
                    <th>ประเภทอะไหล่</th>
                    <th>รหัสอะไหล่</th>
                    <th>รุ่น/ขนาด</th>
                    <th>จำนวนขั้นต่ำ</th>
                    <th>จัดการ</th>
                    <th>รายละเอียด</th>
                </tr>
            </thead>
            <tbody>
                {filteredEquipments.map(item => (
                    <tr key={item.equipment_id}>
                        <td style={{ textAlign: "center" }}>{item.img ? (
                          <img 
                            src={`${process.env.REACT_APP_API_URL}/uploads/${item.img}`} 
                            alt="Equipment"
                            onClick={() => setPreviewImage(`${process.env.REACT_APP_API_URL}/uploads/${item.img}`)} 
                            style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid #eee' }}
                            title="คลิกเพื่อขยาย"
                          />
                        ) : (
                          <div style={{ color: '#ccc', fontSize: '0.8rem' }}>ไม่มีรูป</div>
                        )}</td>
                        <td>{item.equipment_type_id}</td>
                        <td>{item.equipment_name}</td>
                        <td className="text-primary fw-bold">{item.equipment_id}</td>
                        <td>{item.model_size}</td>
                        <td>{item.alert_quantity} {item.unit}</td>
                        <td>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                <button className="action-btn edit-btn" onClick={() => handleEditEquipment(item)} title="แก้ไขข้อมูลอะไหล่" style={{ color: '#ffc107', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}><FaEdit /></button>
                                <button className="action-btn delete-btn" onClick={() => handleDeleteEquipment(item.equipment_id)} title="ลบข้อมูลอะไหล่" style={{ color: '#dc3545', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}><FaTrash /></button>
                            </div>
                        </td>
                        <td>
                            <button className="btn-primary" style={{ padding: '5px 10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px', margin: '0 auto' }} onClick={() => navigate(`/dashboard/admin/lot/${item.equipment_id}`)}>
                                <FaBoxOpen /> ดู Lot
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* Modal ฟอร์ม เพิ่ม/แก้ไข ข้อมูลอะไหล่ */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <form onSubmit={handleSubmit}>
                <div className="modal-header">
                    <h3>{isEditMode ? `แก้ไขข้อมูลอะไหล่: ${formData.equipment_id}` : "เพิ่มข้อมูลอะไหล่ใหม่"}</h3>
                    <button type="button" className="close-btn" onClick={() => setShowModal(false)}><FaTimes /></button>
                </div>
                <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    
                    {/* ส่วนอัปโหลดรูปภาพ */}
                    <div className="form-group" style={{ marginBottom: '15px', textAlign: 'center' }}>
                        <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>รูปภาพอะไหล่ (img)</label>
                        {formData.img && (
                            <img 
                                src={`${process.env.REACT_APP_API_URL}/uploads/${formData.img}`} 
                                alt="Preview" 
                                style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px', border: '1px solid #ccc' }} 
                            />
                        )}
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="form-control" />
                        {isUploading && <span style={{ color: 'blue', fontSize: '0.8rem' }}>กำลังอัปโหลด...</span>}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label>รหัสประเภท (Type ID) *</label>
                            <input type="text" className="form-control" name="equipment_type_id" value={formData.equipment_type_id} onChange={handleChange} required />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>ประเภทอะไหล่ (Name) *</label>
                            <input type="text" className="form-control" name="equipment_name" value={formData.equipment_name} onChange={handleChange} required />
                        </div>
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                        <label>รหัสอะไหล่ (Equipment ID) *</label>
                        <input type="text" className="form-control" name="equipment_id" value={formData.equipment_id} onChange={handleChange} required disabled={isEditMode} style={{ backgroundColor: isEditMode ? '#f4f4f4' : 'white' }} />
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                        <label>รุ่น / ขนาด (Model/Size) *</label>
                        <input type="text" className="form-control" name="model_size" value={formData.model_size} onChange={handleChange} required />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label>จำนวนแจ้งเตือน (Alert Qty)</label>
                            <input type="number" className="form-control" name="alert_quantity" value={formData.alert_quantity} onChange={handleChange} required min="0" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>หน่วยนับ (Unit) *</label>
                            <input type="text" className="form-control" name="unit" value={formData.unit} onChange={handleChange} placeholder="เช่น ชิ้น, กล่อง" required />
                        </div>
                    </div>

                </div>
                <div className="modal-footer" style={{ marginTop: '15px' }}>
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
            <button className="close-image-btn" onClick={() => setPreviewImage(null)}><FaTimes /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageEquipment;