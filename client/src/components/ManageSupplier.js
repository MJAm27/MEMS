import React, { useState, useEffect } from "react";
import "./ManageSupplier.css"; 
import { FaPlus, FaSearch, FaEdit, FaTrash, FaTimes } from "react-icons/fa";
import axios from "axios";
import SubNavbar from "./SubNavbar";


const API_BASE_URL = process.env.REACT_APP_API_URL;

function ManageSupplier() {
  const [suppliers, setSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [formData, setFormData] = useState({
    supplier_id: "",
    supplier_name: "",
    contact: ""
  });

  // 1. โหลดข้อมูลเมื่อเปิดหน้าเว็บ
  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/supplier`);
      setSuppliers(response.data);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  // 2. ฟังก์ชันค้นหา
  const filteredSuppliers = suppliers.filter((item) =>
    item.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.supplier_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 3. จัดการ Form Inputs
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 4. เปิด Modal เพิ่มข้อมูลใหม่
  const handleAddNew = () => {
    setIsEditMode(false);
    setFormData({ supplier_id: "", supplier_name: "", contact: "" });
    setShowModal(true);
  };

  // 5. เปิด Modal แก้ไขข้อมูล
  const handleEdit = (item) => {
    setIsEditMode(true);
    setFormData({
      supplier_id: item.supplier_id,
      supplier_name: item.supplier_name,
      contact: item.contact || "" // ถ้าไม่มีข้อมูลให้เป็น string ว่าง
    });
    setShowModal(true);
  };

  // 6. บันทึกข้อมูล (เพิ่ม หรือ แก้ไข)
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditMode) {
        // API Update
        await axios.put(`${API_BASE_URL}/api/supplier/${formData.supplier_id}`, formData);
        alert("แก้ไขข้อมูลสำเร็จ");
      } else {
        // API Create
        await axios.post(`${API_BASE_URL}/api/supplier`, formData);
        alert("เพิ่มข้อมูลสำเร็จ");
      }
      setShowModal(false);
      fetchSuppliers(); // โหลดข้อมูลใหม่
    } catch (error) {
      console.error("Error saving supplier:", error);
      alert("เกิดข้อผิดพลาด: " + (error.response?.data?.message || error.message));
    }
  };

  // 7. ลบข้อมูล
  const handleDelete = async (id) => {
    if (window.confirm(`คุณต้องการลบ Supplier ID: ${id} ใช่หรือไม่?`)) {
      try {
        await axios.delete(`${API_BASE_URL}/api/supplier/${id}`);
        fetchSuppliers();
      } catch (error) {
        console.error("Error deleting:", error);
        alert("ลบไม่สำเร็จ: " + (error.response?.data?.message || "อาจมีการใช้งานข้อมูลนี้อยู่"));
      }
    }
  };

  return (
    <div className="manage-supplier-container fade-in">
      {/* Header */}
      <div className="page-header">
        <SubNavbar />
        <div>
          <h2 className="page-title-text">จัดการข้อมูลบริษัทนำเข้าอะไหล่</h2>
        </div>
        <button className="btn-primary" onClick={handleAddNew}>
          <FaPlus style={{ marginRight: "8px" }} /> เพิ่มบริษัทใหม่
        </button>
      </div>

      {/* Search Bar */}
      <div className="search-bar-wrapper">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="ค้นหาจากรหัส หรือ ชื่อบริษัท..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: "20%" }}>รหัสบริษัท (ID)</th>
              <th style={{ width: "35%" }}>ชื่อบริษัท</th>
              <th style={{ width: "30%" }}>ข้อมูลติดต่อ</th>
              <th style={{ width: "15%", textAlign: "center" }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.length > 0 ? (
              filteredSuppliers.map((item) => (
                <tr key={item.supplier_id}>
                  <td className="text-primary fw-bold">{item.supplier_id}</td>
                  <td>{item.supplier_name}</td>
                  <td>{item.contact || "-"}</td>
                  <td style={{ textAlign: "center" }}>
                    <button className="action-btn edit-btn" onClick={() => handleEdit(item)}>
                      <FaEdit />
                    </button>
                    <button className="action-btn delete-btn" onClick={() => handleDelete(item.supplier_id)}>
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: "center", padding: "20px", color: "#999" }}>
                  ไม่พบข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <form onSubmit={handleSubmit}>
              <div className="modal-header">
                <h3>{isEditMode ? "แก้ไขข้อมูล Supplier" : "เพิ่ม Supplier ใหม่"}</h3>
                <button type="button" className="close-btn" onClick={() => setShowModal(false)}>
                  <FaTimes />
                </button>
              </div>
              <div className="modal-body">
                
                {/* ID Field */}
                <div className="form-group">
                  <label>รหัสบริษัท (Supplier ID) <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    name="supplier_id"
                    value={formData.supplier_id}
                    onChange={handleChange}
                    disabled={isEditMode} // ห้ามแก้ ID ตอน Edit
                    required
                    placeholder="เช่น SUP-001"
                  />
                  {isEditMode && <small className="text-muted">รหัสบริษัทไม่สามารถแก้ไขได้</small>}
                </div>

                {/* Name Field */}
                <div className="form-group">
                  <label>ชื่อบริษัท (Supplier Name) <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    name="supplier_name"
                    value={formData.supplier_name}
                    onChange={handleChange}
                    required
                    placeholder="ระบุชื่อบริษัท"
                  />
                </div>

                {/* Contact Field */}
                <div className="form-group">
                  <label>ข้อมูลติดต่อ (Contact Info)</label>
                  <textarea
                    name="contact"
                    value={formData.contact}
                    onChange={handleChange}
                    rows="3"
                    className="form-textarea" // เพิ่ม class ให้ css
                    placeholder="เบอร์โทร, อีเมล หรือ ที่อยู่"
                  />
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn-primary">
                  {isEditMode ? "บันทึกการแก้ไข" : "บันทึกข้อมูล"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageSupplier;