import React, { useState, useEffect } from "react";
import "./ManageMachine.css";
import { FaPlus, FaSearch, FaEdit, FaTrash, FaTimes } from "react-icons/fa";
import axios from "axios"; // แนะนำให้ลง npm install axios หรือใช้ fetch แบบเดิมก็ได้

function ManageMachine() {
  const [machines, setMachines] = useState([]); // เริ่มต้นเป็น array ว่าง
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [formData, setFormData] = useState({
    machine_SN: "",
    machine_name: ""
  });
  
  // 1. โหลดข้อมูลเมื่อเปิดหน้าเว็บ (READ)
  useEffect(() => {
    fetchMachines();
  }, []);

  const fetchMachines = async () => {
    try {
      // หรือใช้ fetch ก็ได้: const res = await fetch(API_URL);
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/machine`);
      setMachines(response.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  // 2. ฟังก์ชัน Filter สำหรับค้นหา
  const filteredMachines = machines.filter((item) =>
    item.machine_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.machine_SN.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddNew = () => {
    setIsEditMode(false);
    setFormData({ machine_SN: "", machine_name: "" });
    setShowModal(true);
  };

  const handleEdit = (machine) => {
    setIsEditMode(true);
    setFormData(machine);
    setShowModal(true);
  };

  // 3. บันทึกข้อมูล (CREATE & UPDATE)
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (isEditMode) {
        // Update
        await axios.put(`http://localhost:3001/api/machine/${formData.machine_SN}`, {
          machine_name: formData.machine_name
        });
        alert("แก้ไขข้อมูลสำเร็จ");
      } else {
        // Add New
        await axios.post(
            "http://localhost:3001/api/machine",
            {
                machine_SN: formData.machine_SN,
                machine_name: formData.machine_name
            },
            {
                headers: {
                "Content-Type": "application/json"
                }
            }
            );
        alert("เพิ่มข้อมูลสำเร็จ");
      }
      
      fetchMachines(); // โหลดข้อมูลใหม่หลังจากบันทึก
      setShowModal(false);

    } catch (error) {
      console.error("Error saving data:", error);
      alert("เกิดข้อผิดพลาด: " + (error.response?.data || error.message));
    }
  };

  // 4. ลบข้อมูล (DELETE)
  const handleDelete = async (sn) => {
    if (window.confirm(`คุณต้องการลบเครื่องจักรเลขที่ ${sn} ใช่หรือไม่?`)) {
      try {
        await axios.delete(`http://localhost:3001/api/machine/${sn}`);
        fetchMachines(); // โหลดข้อมูลใหม่หลังจากลบ
      } catch (error) {
        console.error("Error deleting:", error);
        alert("ไม่สามารถลบได้ (อาจมีการใช้งานอยู่ หรือเกิดข้อผิดพลาด)");
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ... (ส่วน return JSX เหมือนเดิมทุกประการ ไม่ต้องแก้ส่วน UI) ...
  return (
    <div className="manage-machine-container fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title-text">จัดการข้อมูลครุภัณฑ์ </h2>
        </div>
        <button className="btn-primary" onClick={handleAddNew}>
          <FaPlus /> เพิ่มครุภัณฑ์ใหม่
        </button>
      </div>

      <div className="search-bar-wrapper">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="ค้นหาตามรหัส หรือ ชื่อครุภัณฑ์..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: "20%" }}>รหัสครุภัณฑ์ (sn)</th>
              <th style={{ width: "60%" }}>ชื่อครุภัณฑ์</th>
              <th style={{ width: "20%" }} className="text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredMachines.length > 0 ? (
              filteredMachines.map((machine) => (
                <tr key={machine.machine_SN}>
                  <td className="fw-bold text-primary">{machine.machine_SN}</td>
                  <td>{machine.machine_name}</td>
                  <td className="text-center">
                    <button 
                      className="action-btn edit-btn" 
                      onClick={() => handleEdit(machine)}
                    >
                      <FaEdit />
                    </button>
                    <button 
                      className="action-btn delete-btn" 
                      onClick={() => handleDelete(machine.machine_SN)}
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="empty-state">
                  ไม่พบข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isEditMode ? "แก้ไขข้อมูลครุภัณฑ์" : "เพิ่มครุภัณฑ์ใหม่"}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                <FaTimes />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>รหัสครุภัณฑ์ (sn) <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    name="machine_SN"
                    value={formData.machine_SN}
                    onChange={handleChange}
                    disabled={isEditMode}
                    required
                    placeholder="เช่น MC-2024-XXX"
                  />
                  {isEditMode && <small className="text-muted">รหัสครุภัณฑ์ไม่สามารถแก้ไขได้</small>}
                </div>

                <div className="form-group">
                  <label>ชื่อครุภัณฑ์ (Machine Name) <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    name="machine_name"
                    value={formData.machine_name}
                    onChange={handleChange}
                    required
                    placeholder="ระบุชื่อเรียกเครื่องจักร"
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

export default ManageMachine;