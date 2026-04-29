import React, { useState, useEffect } from "react";
import "./ManageMachine.css";
import { FaPlus, FaSearch, FaEdit, FaTrash, FaTimes } from "react-icons/fa";
import axios from "axios"; 
import SubNavbar from "./SubNavbar";

function ManageMachine() {
  const [machines, setMachines] = useState([]); 
  const [machineTypes, setMachineTypes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [deletedMachines, setDeletedMachines] = useState([]);
  
  const [formData, setFormData] = useState({
    machine_id: "",
    machine_type_id: "",
    machine_type_name: "", 
    machine_supplier: "", 
    machine_model: ""      
  });
  
  useEffect(() => {
    fetchMachines();
    fetchMachineTypes();
  }, []);

  const fetchMachines = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/machine`);
      setMachines(response.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const fetchMachineTypes = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/machine-types`);
      setMachineTypes(response.data);
    } catch (error) {
      console.error("Error fetching machine types:", error);
    }
  };

  const fetchDeletedMachines = async () => {
  try {
    const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/machine/deleted`);
    setDeletedMachines(res.data);
  } catch (err) {
    console.error(err);
  }
};

  const filteredMachines = machines.filter((item) => {
    const name = item?.machine_type_name || ""; 
    const id = item?.machine_id || "";
    
    return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           id.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleAddNew = () => {
    setIsEditMode(false);
    setFormData({ machine_id: "", machine_type_id: "", machine_supplier: "", machine_model: "" });
    setShowModal(true);
  };

  const handleEdit = (machine) => {
    setIsEditMode(true);
    setFormData({
      machine_id: machine.machine_id || "",
      machine_type_id: machine.machine_type_id || "",
      machine_supplier: machine.machine_supplier || "",
      machine_model: machine.machine_model || ""
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      machine_type_id: formData.machine_type_id,
      machine_supplier: formData.machine_supplier,
      machine_model: formData.machine_model
    };

    try {
      if (isEditMode) {
        await axios.put(`${process.env.REACT_APP_API_URL}/api/machine/${formData.machine_id}`, payload);
        alert("แก้ไขข้อมูลสำเร็จ");
      } else {
        await axios.post(
            `${process.env.REACT_APP_API_URL}/api/machine`,
            { ...payload, machine_id: formData.machine_id },
            { headers: { "Content-Type": "application/json" } }
        );
        alert("เพิ่มข้อมูลสำเร็จ");
      }
      
      fetchMachines(); 
      setShowModal(false);

    } catch (error) {
      console.error("Error saving data:", error);
      alert("เกิดข้อผิดพลาด: " + (error.response?.data || error.message));
    }
  };

  const handleDelete = async (sn) => {
    if (window.confirm(`คุณต้องการลบเครื่องเลขที่ ${sn} ใช่หรือไม่?`)) {
      try {
        await axios.delete(`${process.env.REACT_APP_API_URL}/api/machine/${sn}`);
        fetchMachines(); 
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

  return (
    <div className="manage-machine-container fade-in">
      <div className="page-header">
        <SubNavbar />
        <div>
          <h2 className="page-title-text">จัดการข้อมูลครุภัณฑ์</h2>
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
              <th style={{ width: "20%" }}>รหัสครุภัณฑ์ </th>
              <th style={{ width: "30%" }}>ชื่อครุภัณฑ์</th>
              <th style={{ width: "30%" }}>ยี่ห้อ - รุ่น</th>
              <th style={{ width: "20%" }} className="text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredMachines.length > 0 ? (
              filteredMachines.map((machine) => (
                <tr key={machine.machine_id}>
                  <td className="fw-bold text-primary">{machine.machine_id}</td>
                  <td>{machine.machine_type_name}</td>
                  <td>{machine.machine_supplier} - {machine.machine_model}</td>
                  <td className="text-center">
                    <button 
                      className="action-btn edit-btn" 
                      onClick={() => handleEdit(machine)}
                    >
                      <FaEdit />
                    </button>
                    <button 
                      className="action-btn delete-btn" 
                      onClick={() => handleDelete(machine.machine_id)}
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="empty-state">
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
                  <label>รหัสครุภัณฑ์ <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    name="machine_id"
                    value={formData.machine_id}
                    onChange={handleChange}
                    disabled={isEditMode}
                    required
                    placeholder="ระบุรหัสครุภัณฑ์"
                  />
                  {isEditMode && <small className="text-muted">รหัสครุภัณฑ์ไม่สามารถแก้ไขได้</small>}
                </div>

                <div className="form-group">
                  <label>ชื่อ/ประเภทครุภัณฑ์ <span className="text-danger">*</span></label>
                  <select
                    name="machine_type_id" 
                    value={formData.machine_type_id}
                    onChange={handleChange}
                    required 
                  >
                    <option value="">-- กรุณาเลือกประเภทครุภัณฑ์ --</option>
                    {machineTypes.map((type) => (
                      <option key={type.machine_type_id} value={type.machine_type_id}>
                        {type.machine_type_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>ยี่ห้อ (Supplier)</label>
                  <input
                    type="text"
                    name="machine_supplier"
                    value={formData.machine_supplier}
                    onChange={handleChange}
                    placeholder="ระบุยี่ห้อ (ถ้ามี)"
                  />
                </div>

                <div className="form-group">
                  <label>รุ่น (Model)</label>
                  <input
                    type="text"
                    name="machine_model"
                    value={formData.machine_model}
                    onChange={handleChange}
                    placeholder="ระบุรุ่น (ถ้ามี)"
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