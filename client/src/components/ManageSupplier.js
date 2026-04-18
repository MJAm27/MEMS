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

  const filteredSuppliers = suppliers.filter((item) =>
    (item.supplier_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    String(item.supplier_id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // จัดการ Form Inputs
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddNew = () => {
    setIsEditMode(false);
    setFormData({ supplier_id: "", supplier_name: "", contact: "" });
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setIsEditMode(true);
    setFormData({
      supplier_id: item.supplier_id,
      supplier_name: item.supplier_name,
      contact: item.contact || ""
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditMode) {
        await axios.put(`${API_BASE_URL}/api/supplier/${formData.supplier_id}`, formData);
        alert("แก้ไขข้อมูลสำเร็จ");
      } else {
        await axios.post(`${API_BASE_URL}/api/supplier`, formData);
        alert("เพิ่มข้อมูลสำเร็จ");
      }
      setShowModal(false);
      fetchSuppliers(); 
    } catch (error) {
      console.error("Error saving supplier:", error);
      alert("เกิดข้อผิดพลาด: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(`คุณต้องการลบ บริษัทนำเข้ารหัส : ${id} ใช่หรือไม่?`)) {
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
      <div className="page-header">
        <SubNavbar />
        <div>
          <h2 className="page-title-text">จัดการข้อมูลบริษัทนำเข้าอะไหล่</h2>
        </div>
        <button className="btn-primary" onClick={handleAddNew}>
          <FaPlus style={{ marginRight: "8px" }} /> เพิ่มบริษัทใหม่
        </button>
      </div>

      <div className="search-bar-wrapper">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="ค้นหาจากรหัส หรือ ชื่อบริษัท..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

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
                
                {isEditMode && (
                  <div className="form-group">
                    <label>รหัสบริษัท (Supplier ID)</label>
                    <input
                      type="text"
                      name="supplier_id"
                      value={formData.supplier_id}
                      disabled
                      style={{ backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
                    />
                  </div>
                )}

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

                <div className="form-group">
                  <label>ข้อมูลติดต่อ (Contact Info)</label>
                  <textarea
                    name="contact"
                    value={formData.contact}
                    onChange={handleChange}
                    rows="3"
                    className="form-textarea" 
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