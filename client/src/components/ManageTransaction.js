import React, { useState, useEffect } from "react";
import "./ManageTransaction.css";
import { FaPlus, FaSearch, FaEye, FaTimes, FaTrash } from "react-icons/fa";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL;

function ManageTransaction() {
  // State หลัก
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // State สำหรับ Modal และ Form
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState(false); // true=ดูรายละเอียด, false=เพิ่มใหม่
  const [options, setOptions] = useState({ users: [], machines: [], types: [], equipments: [] });

  // Form Data (Header)
  const [headerData, setHeaderData] = useState({
    transaction_type_id: "",
    user_id: "",
    machine_SN: "",
    notes: ""
  });

  // Form Data (Items - รายการในตะกร้า)
  const [cartItems, setCartItems] = useState([]); // รายการที่กดเพิ่มไว้
  const [currentItem, setCurrentItem] = useState({ equipment_id: "", quantity: 1 }); // รายการที่กำลังเลือก

  // State สำหรับดูรายละเอียด (View Detail)
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);

  useEffect(() => {
    fetchTransactions();
    fetchOptions();
  }, []);

  // โหลดข้อมูลประวัติ
  const fetchTransactions = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/transactions`);
      setTransactions(res.data);
      setLoading(false);
    } catch (error) {
      console.error(error);
    }
  };

  // โหลดตัวเลือกต่างๆ (User, Machine, Type)
  const fetchOptions = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/transaction-options`);
      setOptions(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  // ฟังก์ชันเพิ่มของลงตะกร้า (ยังไม่บันทึกลง DB)
  const handleAddItemToCart = () => {
    if (!currentItem.equipment_id || currentItem.quantity <= 0) {
      alert("กรุณาเลือกอุปกรณ์และระบุจำนวนให้ถูกต้อง");
      return;
    }
    
    // หาข้อมูลชื่ออุปกรณ์มาแสดง
    const eqInfo = options.equipments.find(e => e.equipment_id == currentItem.equipment_id);
    
    const newItem = {
      ...currentItem,
      equipment_name: eqInfo.equipment_name,
      model_size: eqInfo.model_size
    };

    setCartItems([...cartItems, newItem]);
    setCurrentItem({ equipment_id: "", quantity: 1 }); // Reset ช่องเลือก
  };

  // ลบของออกจากตะกร้า
  const handleRemoveFromCart = (index) => {
    const newCart = [...cartItems];
    newCart.splice(index, 1);
    setCartItems(newCart);
  };

  // บันทึก Transaction ทั้งหมด
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      alert("กรุณาเพิ่มรายการอุปกรณ์อย่างน้อย 1 รายการ");
      return;
    }
    
    if (!headerData.transaction_type_id || !headerData.user_id) {
       alert("กรุณาระบุประเภทและผู้ทำรายการ");
       return; 
    }

    try {
      const payload = {
        ...headerData,
        items: cartItems
      };
      await axios.post(`${API_BASE_URL}/api/transactions`, payload);
      alert("บันทึกรายการสำเร็จ!");
      setShowModal(false);
      fetchTransactions(); // โหลดใหม่
      // Reset Form
      setHeaderData({ transaction_type_id: "", user_id: "", machine_SN: "", notes: "" });
      setCartItems([]);
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  // เปิดดูรายละเอียด
  const handleViewDetail = async (trans) => {
    setSelectedTransaction(trans);
    setViewMode(true);
    setShowModal(true);
    try {
        const res = await axios.get(`${API_BASE_URL}/api/transactions/${trans.transaction_id}/items`);
        setSelectedItems(res.data);
    } catch (error) {
        console.error(error);
    }
  };

  const handleOpenAdd = () => {
      setViewMode(false);
      setCartItems([]);
      setHeaderData({ transaction_type_id: "", user_id: "", machine_SN: "", notes: "" });
      setShowModal(true);
  }

  // Filter
  const filteredData = transactions.filter(t => 
    t.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.fullname && t.fullname.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="manage-transaction-container fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title-text">จัดการประวัติการเบิก-คืน</h2>
        </div>
        <button className="btn-primary" onClick={handleOpenAdd}>
          <FaPlus style={{ marginRight: "8px" }} /> เพิ่มประวัติการเบิก-คืน
        </button>
      </div>

      {/* Search */}
      <div className="search-bar-wrapper">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="ค้นหาเลขที่รายการ หรือ ชื่อผู้ทำรายการ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table List */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>เลขที่รายการ</th>
              <th>วันที่</th>
              <th>ประเภท</th>
              <th>ผู้ดำเนินการ</th>
              <th>ครุภัณฑ์</th>
              <th style={{textAlign:'center'}}>จำนวน</th>
              <th style={{textAlign:'center'}}>ดูข้อมูล</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item) => (
              <tr key={item.transaction_id}>
                <td className="text-primary fw-bold">{item.transaction_id}</td>
                <td>{new Date(item.transaction_date).toLocaleString('th-TH')}</td>
                <td>
                    <span className={`badge ${item.transaction_type_name?.includes('เบิก') ? 'bg-warning' : 'bg-success'}`}>
                        {item.transaction_type_name}
                    </span>
                </td>
                <td>{item.fullname}</td>
                <td>{item.machine_name || "-"}</td>
                <td style={{textAlign:'center'}}>{item.item_count}</td>
                <td style={{textAlign:'center'}}>
                  <button className="action-btn view-btn" onClick={() => handleViewDetail(item)}>
                    <FaEye />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content transaction-modal"> {/* เพิ่ม class พิเศษเพื่อให้กว้างขึ้น */}
            <div className="modal-header">
              <h3>{viewMode ? "รายละเอียดรายการ" : "สร้างรายการใหม่"}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}><FaTimes /></button>
            </div>
            
            <div className="modal-body">
                {viewMode ? (
                    // --- View Mode ---
                    <div>
                        <div className="info-grid">
                            <p><strong>ID:</strong> {selectedTransaction?.transaction_id}</p>
                            <p><strong>วันที่:</strong> {new Date(selectedTransaction?.date).toLocaleString()}</p>
                            <p><strong>ประเภท:</strong> {selectedTransaction?.transaction_type_name}</p>
                            <p><strong>ผู้ทำรายการ:</strong> {selectedTransaction?.fullname}</p>
                            <p><strong>ครุภัณฑ์:</strong> {selectedTransaction?.machine_name || "-"}</p>
                        </div>
                        <hr/>
                        <h5>รายการอะไหล่</h5>
                        <table className="mini-table">
                            <thead>
                                <tr>
                                    <th>อุปกรณ์</th>
                                    <th>รุ่น/ขนาด</th>
                                    <th>จำนวน</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedItems.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>{item.equipment_name}</td>
                                        <td>{item.model_size}</td>
                                        <td style={{fontWeight:'bold'}}>{item.quantity}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    // --- Add Mode ---
                    <form onSubmit={handleSubmit}>
                        {/* Section 1: Header Info */}
                        <div className="section-box">
                            <h4>1. ข้อมูลทั่วไป</h4>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>ประเภทรายการ <span className="text-danger">*</span></label>
                                    <select 
                                        className="form-control"
                                        value={headerData.transaction_type_id}
                                        onChange={e => setHeaderData({...headerData, transaction_type_id: e.target.value})}
                                        required
                                    >
                                        <option value="">-- เลือกประเภท --</option>
                                        {options.types.map(t => <option key={t.transaction_type_id} value={t.transaction_type_id}>{t.transaction_type_name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>ผู้ทำรายการ <span className="text-danger">*</span></label>
                                    <select 
                                        className="form-control"
                                        value={headerData.user_id}
                                        onChange={e => setHeaderData({...headerData, user_id: e.target.value})}
                                        required
                                    >
                                        <option value="">-- เลือกผู้ใช้ --</option>
                                        {options.users.map(u => <option key={u.user_id} value={u.user_id}>{u.fullname}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>ครุภัณฑ์</label>
                                    <select 
                                        className="form-control"
                                        value={headerData.machine_SN}
                                        onChange={e => setHeaderData({...headerData, machine_SN: e.target.value})}
                                    >
                                        <option value="">-- ไม่ระบุ --</option>
                                        {options.machines.map(m => <option key={m.machine_SN} value={m.machine_SN}>{m.machine_name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>หมายเหตุ</label>
                                    <input 
                                        type="text" 
                                        className="form-control"
                                        value={headerData.notes}
                                        onChange={e => setHeaderData({...headerData, notes: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Add Items */}
                        <div className="section-box">
                            <h4>2. เพิ่มรายการอะไหล่</h4>
                            <div className="add-item-row">
                                <select 
                                    style={{flex: 2}}
                                    className="form-control"
                                    value={currentItem.equipment_id}
                                    onChange={e => setCurrentItem({...currentItem, equipment_id: e.target.value})}
                                >
                                    <option value="">-- เลือกอุปกรณ์ --</option>
                                    {options.equipments.map(e => (
                                        <option key={e.equipment_id} value={e.equipment_id}>
                                            {e.equipment_name} ({e.model_size})
                                        </option>
                                    ))}
                                </select>
                                <input 
                                    type="number" 
                                    style={{flex: 1}}
                                    className="form-control"
                                    placeholder="จำนวน"
                                    min="1"
                                    value={currentItem.quantity}
                                    onChange={e => setCurrentItem({...currentItem, quantity: parseInt(e.target.value) || 0})}
                                />
                                <button type="button" className="btn-secondary" onClick={handleAddItemToCart}>
                                    <FaPlus /> เพิ่ม
                                </button>
                            </div>

                            {/* Mini Table List */}
                            <div className="mini-table-container">
                                <table className="mini-table">
                                    <thead>
                                        <tr>
                                            <th>รายการ</th>
                                            <th>จำนวน</th>
                                            <th>ลบ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cartItems.length > 0 ? (
                                            cartItems.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td>{item.equipment_name} ({item.model_size})</td>
                                                    <td>{item.quantity}</td>
                                                    <td>
                                                        <span className="delete-icon" onClick={() => handleRemoveFromCart(idx)}>
                                                            <FaTrash />
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan="3" style={{textAlign:'center', color:'#999'}}>ยังไม่มีรายการ</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="modal-footer" style={{marginTop: '20px'}}>
                             <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>ยกเลิก</button>
                             <button type="submit" className="btn-primary">บันทึกข้อมูล</button>
                        </div>
                    </form>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageTransaction;