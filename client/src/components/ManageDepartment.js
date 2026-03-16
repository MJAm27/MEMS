import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaPlus, FaSearch, FaEdit, FaTrash, FaTimes,FaFilter } from "react-icons/fa";
import "./ManageDepartment.css";
import SubNavbar from "./SubNavbar";


const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

function ManageDepartment() {
    const [departments, setDepartments] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterBuilding, setFilterBuilding] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [formData, setFormData] = useState({
        department_id: "",
        department_name: "",
        buildings: ""
    });

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/departments`);
            setDepartments(res.data);
        } catch (error) {
            console.error("Error fetching departments:", error);
        }
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const openModal = (dept = null) => {
        if (dept) {
            setIsEditMode(true);
            setFormData(dept);
        } else {
            setIsEditMode(false);
            setFormData({ department_id: "", department_name: "", buildings: "" });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditMode) {
                await axios.put(`${API_BASE_URL}/api/departments/${formData.department_id}`, formData);
                alert("อัปเดตข้อมูลหน่วยงานสำเร็จ");
            } else {
                await axios.post(`${API_BASE_URL}/api/departments`, formData);
                alert("เพิ่มหน่วยงานใหม่สำเร็จ");
            }
            setShowModal(false);
            fetchDepartments();
        } catch (error) {
            console.error("Error saving department:", error);
            alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล (รหัสหน่วยงานอาจซ้ำ)");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("คุณต้องการลบหน่วยงานนี้ใช่หรือไม่?")) {
            try {
                await axios.delete(`${API_BASE_URL}/api/departments/${id}`);
                alert("ลบหน่วยงานสำเร็จ");
                fetchDepartments();
            } catch (error) {
                console.error("Error deleting department:", error);
                alert("เกิดข้อผิดพลาด หรือมีการใช้งานหน่วยงานนี้อยู่");
            }
        }
    };

    const uniqueBuildings = [...new Set(departments.map(dept => dept.buildings).filter(b => b))];

    const filteredDepartments = departments.filter(dept => {
        const matchesSearch = dept.department_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              dept.department_id.toString().includes(searchTerm);
        const matchesBuilding = filterBuilding === "" || dept.buildings === filterBuilding;
        return matchesSearch && matchesBuilding;
    });

    return (
        <div className="manage-department-container">
            <div className="page-header">
                <SubNavbar />
                <h2>จัดการข้อมูลหน่วยงาน</h2>
                <button className="btn-primary" onClick={() => openModal()}>
                    <FaPlus /> เพิ่มหน่วยงาน
                </button>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div className="search-bar-wrapper" style={{ margin: 0, flex: 1, minWidth: '250px', maxWidth: '400px' }}>
                    <FaSearch className="search-icon" />
                    <input 
                        type="text" 
                        placeholder="ค้นหารหัส หรือชื่อหน่วยงาน..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div style={{ position: "relative", minWidth: "200px" }}>
                    <FaFilter style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#888" }} />
                    <select 
                        className="form-control" 
                        style={{ width: '200px',paddingLeft: "35px", borderRadius: '8px', border: '1px solid #dee2e6' }}
                        value={filterBuilding}
                        onChange={(e) => setFilterBuilding(e.target.value)}
                    >
                        <option value="">อาคารทั้งหมด</option>
                        {uniqueBuildings.map((building, index) => (
                            <option key={index} value={building}>{building}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="table-container">
                <table className="custom-table">
                    <thead>
                        <tr>
                            <th>รหัสหน่วยงาน</th>
                            <th>ชื่อหน่วยงาน</th>
                            <th>อาคาร</th>
                            <th style={{ textAlign: "center" }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDepartments.map((dept) => (
                            <tr key={dept.department_id}>
                                <td>{dept.department_id}</td>
                                <td>{dept.department_name}</td>
                                <td>{dept.buildings || "-"}</td>
                                <td style={{ textAlign: "center" }}>
                                    <button className="action-btn edit-btn" onClick={() => openModal(dept)} title="แก้ไข">
                                        <FaEdit />
                                    </button>
                                    <button className="action-btn delete-btn" onClick={() => handleDelete(dept.department_id)} title="ลบ">
                                        <FaTrash />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredDepartments.length === 0 && (
                            <tr>
                                <td colSpan="4" style={{ textAlign: "center", color: "#999" }}>ไม่พบข้อมูลหน่วยงาน</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h3>{isEditMode ? "แก้ไขข้อมูลหน่วยงาน" : "เพิ่มหน่วยงานใหม่"}</h3>
                            <button className="close-btn" onClick={() => setShowModal(false)}><FaTimes /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>รหัสหน่วยงาน <span className="text-danger">*</span></label>
                                    <input 
                                        type="text" 
                                        name="department_id" 
                                        className="form-control"
                                        value={formData.department_id} 
                                        onChange={handleInputChange} 
                                        required 
                                        disabled={isEditMode} // ห้ามแก้รหัสตอนแก้ไข
                                        placeholder="ระบุรหัสหน่วยงาน"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>ชื่อหน่วยงาน <span className="text-danger">*</span></label>
                                    <input 
                                        type="text" 
                                        name="department_name" 
                                        className="form-control"
                                        value={formData.department_name} 
                                        onChange={handleInputChange} 
                                        required 
                                        placeholder="ระบุชื่อหน่วยงาน"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>อาคาร</label>
                                    <input 
                                        type="text" 
                                        name="buildings" 
                                        className="form-control"
                                        value={formData.buildings} 
                                        onChange={handleInputChange} 
                                        placeholder="ระบุชื่ออาคาร"
                                    />
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
        </div>
    );
}

export default ManageDepartment;