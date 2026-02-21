import React, { useState, useEffect } from "react";
import "./ManageUser.css";
import { FaPlus, FaSearch, FaEdit, FaTrash, FaTimes, FaFilter } from "react-icons/fa";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL;

function ManageUser() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form Data (ปรับให้ตรงกับ Backend ใหม่)
  const [formData, setFormData] = useState({
    user_id: "",
    fullname: "",      
    email: "",
    password: "",
    position: "",      
    phone_number: "",  
    role_id: "",
    profile_img:""
  });

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/users`);
      setUsers(res.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/roles`);
      setRoles(res.data);
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setFormData({
      user_id: "",
      fullname: "",
      email: "",
      password: "",
      position: "",
      phone_number: "",
      role_id: "",
      profile_img:""
    });
    setShowModal(true);
  };

  const handleOpenEdit = (user) => {
    setIsEditMode(true);
    setFormData({
      user_id: user.user_id,
      fullname: user.fullname || "",
      email: user.email || "",
      password: "",
      position: user.position || "",
      phone_number: user.phone_number || "",
      role_id: user.role_id,
      profile_img: user.profile_img
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditMode) {
        await axios.put(`${API_BASE_URL}/api/users/${formData.user_id}`, formData);
        alert("แก้ไขข้อมูลสำเร็จ");
      } else {
        await axios.post(`${API_BASE_URL}/api/users`, formData);
        alert("สร้างผู้ใช้งานสำเร็จ");
      }
      setShowModal(false);
      fetchUsers();
    } catch (error) {
      alert("เกิดข้อผิดพลาด: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("คุณแน่ใจหรือไม่ที่จะลบผู้ใช้นี้?")) {
      try {
        await axios.delete(`${API_BASE_URL}/api/users/${id}`);
        fetchUsers();
      } catch (error) {
        alert("ลบไม่สำเร็จ");
      }
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.fullname && u.fullname.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = filterRole ? u.role_id.toString() === filterRole.toString() : true;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="manage-user-container fade-in">
      <div className="page-header">
        <h2 className="page-title-text">จัดการผู้ใช้งาน</h2>
        <button className="btn-primary" onClick={handleOpenAdd}>
          <FaPlus style={{ marginRight: "8px" }} /> เพิ่มผู้ใช้ใหม่
        </button>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        
        <div className="search-bar-wrapper" style={{ flex: 1, minWidth: "250px", marginBottom: 0 }}>
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ หรือ อีเมล..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-wrapper" style={{ position: "relative" }}>
            <FaFilter style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#888" }} />
            <select
                className="form-control"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                style={{ paddingLeft: "35px", height: "100%", cursor: "pointer" }}
            >
                <option value="">ทั้งหมด</option>
                {roles.map((r) => (
                    <option key={r.role_id} value={r.role_id}>
                        {r.role_name}
                    </option>
                ))}
            </select>
        </div>

      </div>

      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>ชื่อ-นามสกุล</th>
              <th>ตำแหน่ง</th>
              <th>เบอร์โทร</th>
              <th>Email</th>
              <th style={{textAlign:'center'}}>Role</th>
              <th style={{textAlign:'center'}}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.user_id}>
                <td className="fw-bold text-primary">
                    <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                        <div className="user-avatar" style={{ overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#eee" }}>
                            {user.profile_img ? (
                                <img 
                                    src={`${API_BASE_URL}/profile-img/${user.profile_img}`} 
                                    alt="profile"
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    // onError={(e) => {
                                    //     e.target.style.display = 'none';
                                    //     e.target.parentElement.innerText = user.fullname ? user.fullname.charAt(0).toUpperCase() : "?";
                                    // }}
                                />
                            ) : (
                                <span>{user.fullname ? user.fullname.charAt(0).toUpperCase() : "?"}</span>
                            )}
                          </div>
                        {user.fullname}
                    </div>
                </td>
                <td>{user.position || "-"}</td>
                <td>{user.phone_number || "-"}</td>
                <td>{user.email}</td>
                <td style={{textAlign:'center'}}>
                    <span className={`role-badge role-${user.role_name?.toLowerCase() || 'default'}`}>
                        {user.role_name || "ไม่มีสิทธิ์"}
                    </span>
                </td>
                <td style={{textAlign:'center'}}>
                  <button className="action-btn edit-btn" onClick={() => handleOpenEdit(user)}><FaEdit /></button>
                  <button className="action-btn delete-btn" onClick={() => handleDelete(user.user_id)}><FaTrash /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '600px'}}>
            <div className="modal-header">
              <h3>{isEditMode ? "แก้ไขข้อมูลผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}><FaTimes /></button>
            </div>
            
            <form onSubmit={handleSubmit}>
                <div className="modal-body">
                    <div className="form-grid-user">
                        <div className="form-group">
                            <label>ชื่อ-นามสกุล <span className="text-danger">*</span></label>
                            <input 
                                type="text" name="fullname" className="form-control"
                                value={formData.fullname} onChange={handleInputChange} required 
                            />
                        </div>
                        <div className="form-group">
                            <label>Email <span className="text-danger">*</span></label>
                            <input 
                                type="email" name="email" className="form-control"
                                value={formData.email} onChange={handleInputChange} required 
                            />
                        </div>
                        <div className="form-group">
                            <label>Password {isEditMode ? "(เว้นว่างถ้าไม่เปลี่ยน)" : <span className="text-danger">*</span>}</label>
                            <input 
                                type="password" name="password" className="form-control"
                                value={formData.password} onChange={handleInputChange}
                                required={!isEditMode} placeholder={isEditMode ? "********" : ""}
                            />
                        </div>
                        <div className="form-group">
                            <label>ตำแหน่ง</label>
                            <input 
                                type="text" name="position" className="form-control"
                                value={formData.position} onChange={handleInputChange} 
                            />
                        </div>
                        <div className="form-group">
                            <label>เบอร์โทรศัพท์</label>
                            <input 
                                type="text" name="phone_number" className="form-control"
                                value={formData.phone_number} onChange={handleInputChange} 
                            />
                        </div>
                        <div className="form-group">
                            <label>Role <span className="text-danger">*</span></label>
                            <select 
                                name="role_id" className="form-control"
                                value={formData.role_id} onChange={handleInputChange} required
                            >
                                <option value="">-- เลือกสิทธิ์ --</option>
                                {roles.map(r => (
                                    <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                                ))}
                            </select>
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
    </div>
  );
}

export default ManageUser;