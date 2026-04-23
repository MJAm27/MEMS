import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./ManageEquipment.css";
import { FaTimes,FaPlus,FaSearch, FaArrowLeft, FaEdit, FaTrash } from "react-icons/fa";
import axios from "axios";
import Barcode from 'react-barcode';

const API_BASE_URL = process.env.REACT_APP_API_URL;

function ManageLot() {
  const { equipmentId } = useParams(); 
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    lot_id: "",
    supplier_id: "",
    import_date: "",
    expiry_date: "",
    current_quantity:"",
    price: ""
  });

  useEffect(() => {
    fetchData();
    fetchSuppliers();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/inventory`);
      setInventory(res.data);
    } catch (error) { console.error("Error fetching inventory:", error); }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/master-data`);
      setSuppliers(res.data.suppliers || []);
    } catch (error) { console.error("Error fetching suppliers:", error); }
  };

  const lotData = inventory.filter(item => item.equipment_id === equipmentId);
  
  const filteredLots = lotData.filter(item => {
    if (!item.lot_id) return false;
    const searchLower = searchTerm.toLowerCase();
    const matchLot = item.lot_id.toLowerCase().includes(searchLower);
    const matchSupplier = item.supplier_name && item.supplier_name.toLowerCase().includes(searchLower);

    return matchLot || matchSupplier;
  });

  const handleAddNew = () => {
    setFormData({ lot_id: "", supplier_id: "", import_date: "", expiry_date: "", current_quantity: "", price: "" });
    setIsEditMode(false);
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setFormData({
      lot_id: item.lot_id,
      supplier_id: item.supplier_id || "", 
      import_date: item.import_date ? new Date(item.import_date).toISOString().split('T')[0] : "",
      expiry_date: item.expiry_date ? new Date(item.expiry_date).toISOString().split('T')[0] : "",
      current_quantity: item.current_quantity,
      price: item.price || item.cost_price || 0
    });
    setIsEditMode(true);
    setShowModal(true);
  };

  const downloadBarcode = (lotId) => {
    const svg = document.getElementById(`barcode-${lotId}`);
    if (svg) {
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();

        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            canvas.width = img.width + 20;  
            canvas.height = img.height + 20;
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 10, 10);

            const pngUrl = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.href = pngUrl;
            downloadLink.download = `Barcode_${lotId}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(`ต้องการลบ Lot ${id} ใช่หรือไม่?`)) {
      try {
        await axios.delete(`${API_BASE_URL}/api/inventory/${id}`);
        fetchData();
      } catch (error) { alert("ลบไม่สำเร็จ"); }
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.expiry_date && formData.import_date) {
        const importDate = new Date(formData.import_date);
        const expiryDate = new Date(formData.expiry_date);
        if (expiryDate <= importDate) {
            alert("วันที่หมดอายุต้องอยู่หลังวันที่นำเข้า");
            return; 
        }
    }
    const payload = {
        equipment_id: equipmentId, 
        ...formData
    };

    try {
        if (isEditMode) {
            await axios.put(`${API_BASE_URL}/api/inventory/update-lot/${formData.lot_id}`, payload);
            alert("แก้ไขข้อมูล Lot สำเร็จ");
        } else {
            await axios.post(`${API_BASE_URL}/api/inventory/add-lot`, payload);
            alert("เพิ่ม Lot ใหม่สำเร็จ");
        }
        setShowModal(false);
        fetchData(); 
    } catch (error) {
        alert("เกิดข้อผิดพลาด: " + (error.response?.data?.message || error.message));
    }
  };

  return (
    <div className="manage-equipment-container fade-in">
      <div className="page-header">
          <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <button className="btn-secondary" onClick={() => navigate(-1)} style={{ padding: '8px 12px' }}>
                 <FaArrowLeft /> กลับ
              </button>
              <h2 className="page-title-text">
                  Lot: {lotData.length > 0 ? lotData[0].equipment_name : equipmentId}
              </h2>
          </div>

          <div className="header-actions" style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-primary" onClick={handleAddNew}>
                  <FaPlus /> เพิ่ม Lot ใหม่
              </button>
          </div>
      </div>

      <div className="search-bar-wrapper">
        <FaSearch className="search-icon" />
        <input type="text" placeholder="ค้นหา รหัส Lot หรือ บริษัทนำเข้า..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="table-container">
        <table className="custom-table">
            <thead>
                <tr>
                    <th>รหัส Lot</th>
                    <th>รหัสอะไหล่</th>
                    <th>ประเภทอะไหล่</th>
                    <th>รุ่น/ขนาด</th>
                    <th>บริษัท (Supplier)</th>
                    <th>วันที่นำเข้า</th>
                    <th>วันที่หมดอายุ</th>
                    <th>จำนวน</th>
                    <th>ราคา</th>
                    <th>จัดการ</th>
                </tr>
            </thead>
            <tbody>
                {filteredLots.map(item => (
                    <tr key={item.lot_id}>
                        <td className="text-primary fw-bold">
                            {item.lot_id}
                            <Barcode id={`barcode-${item.lot_id}`} value={item.lot_id} width={1.5} height={50} fontSize={14} />
                            <button onClick={() => downloadBarcode(item.lot_id)} style={{ marginTop: '5px', fontSize: '0.8rem', padding: '5px 10px', cursor: 'pointer' }}>
                                💾 บันทึก Barcode
                            </button>
                        </td>
                        <td>{item.equipment_id}</td>
                        <td>{item.equipment_name}</td>
                        <td>{item.model_size}</td>
                        <td>{item.supplier_name}</td>
                        <td>{new Date(item.import_date).toLocaleDateString('th-TH')}</td>
                        <td>{new Date(item.expiry_date).toLocaleDateString('th-TH')}</td>
                        <td className="text-center fw-bold">{item.current_quantity} {item.unit}</td>
                        <td>{item.cost_price || item.price}</td>
                        <td >
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
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{isEditMode ? "แก้ไขข้อมูล Lot" : "เพิ่ม Lot ใหม่"}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}><FaTimes /></button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label>รหัส Lot</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    name="lot_id"
                    value={formData.lot_id} 
                    onChange={handleChange} 
                    required 
                    readOnly={isEditMode} 
                    style={{ backgroundColor: isEditMode ? '#e9ecef' : 'white' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label>บริษัทนำเข้าอะไหล่</label>
                  <select 
                    className="form-control" 
                    name="supplier_id"
                    value={formData.supplier_id} 
                    onChange={handleChange} 
                    required
                  >
                    <option value="">-- เลือกบริษัท --</option>
                    {suppliers.map(sup => (
                      <option key={sup.supplier_id} value={sup.supplier_id}>
                        {sup.supplier_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>วันที่นำเข้า</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      name="import_date"
                      value={formData.import_date} 
                      onChange={handleChange} 
                      required 
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>วันที่หมดอายุ </label>
                    <input 
                      type="date" 
                      className="form-control" 
                      name="expiry_date"
                      value={formData.expiry_date} 
                      onChange={handleChange} 
                      required 
                      min={formData.import_date}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>จำนวน </label>
                    <input 
                      type="number" 
                      className="form-control" 
                      name="current_quantity"
                      value={formData.current_quantity} 
                      onChange={handleChange} 
                      required 
                      min="1"
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>ราคา</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      name="price"
                      value={formData.price} 
                      onChange={handleChange} 
                      required 
                      min="1"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} style={{ padding: '8px 15px', borderRadius: '5px' }}>ยกเลิก</button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 15px', borderRadius: '5px' }}>
                    {isEditMode ? "บันทึกการแก้ไข" : "เพิ่มข้อมูล"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageLot;