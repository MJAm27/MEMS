import React, { useState, useEffect, useCallback } from "react"; 
import "./ManageTransaction.css";
import { FaPlus, FaSearch, FaEye, FaTimes, FaTrash, FaFilter } from "react-icons/fa";
import axios from "axios";
import SubNavbar from "./SubNavbar";


const API_BASE_URL = process.env.REACT_APP_API_URL;

function ManageTransaction() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true); 
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState(false); // true=ดูรายละเอียด, false=เพิ่มใหม่
  const [options, setOptions] = useState({ 
    users: [], 
    machines: [], 
    types: [], 
    equipments: [] ,
    lots: []
  });

  // Form Data (Header)
  const [headerData, setHeaderData] = useState({
    type_mode: "withdraw", // withdraw, return, borrow
    user_id: "",
    machine_SN: "",
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('th-TH', { hour12: false }).slice(0, 5)
  });

  const [cartItems, setCartItems] = useState([]); 
  const [currentItem, setCurrentItem] = useState({ lot_id: "",equipment_id: "", quantity: 1 });

  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);

  const fetchOptions = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/transaction-options`);
      setOptions(res.data);
    } catch (error) {
      console.error("Error fetching options:", error);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/transactions`);
      setTransactions(res.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchOptions();
  }, [fetchTransactions, fetchOptions]); 

  const handleAddItemToCart = () => {
    if (!currentItem.equipment_id || currentItem.quantity <= 0) {
      alert("กรุณาเลือกอุปกรณ์และระบุจำนวนให้ถูกต้อง");
      return;
    }
    
    const lotInfo = options.lots.find(l => String(l.lot_id) === String(currentItem.lot_id));
    
    if (lotInfo) {
        const newItem = {
          ...currentItem,
          equipment_name: lotInfo.equipment_name,
          model_size: lotInfo.model_size
        };
        setCartItems([...cartItems, newItem]);
        setCurrentItem({ lot_id: "", equipment_id: "", quantity: 1 }); // รีเซ็ตค่าหลังกดเพิ่ม
    }
  };

  const handleRemoveFromCart = (index) => {
    const newCart = [...cartItems];
    newCart.splice(index, 1);
    setCartItems(newCart);
  };

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
      fetchTransactions(); 
      setHeaderData({ transaction_type_id: "", user_id: "", machine_SN: "" });
      setCartItems([]);
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    }
  };

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
      setHeaderData({ transaction_type_id: "", user_id: "", machine_SN: "" });
      setShowModal(true);
  }

  const filteredData = transactions.filter(t => {
    const matchesSearch = 
        t.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.fullname && t.fullname.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = filterType ? t.transaction_type_id.toString() === filterType.toString() : true;

    return matchesSearch && matchesType;
  });

  if (loading) {
    return <div className="loading-container">กำลังโหลดข้อมูลประวัติ...</div>;
  }

  return (
    <div className="manage-transaction-container fade-in">
      <div className="page-header">
        <SubNavbar />
        <div>
          <h2 className="page-title-text">จัดการประวัติการเบิก-คืน</h2>
        </div>
        <button className="btn-primary" onClick={handleOpenAdd}>
          <FaPlus style={{ marginRight: "8px" }} /> เพิ่มประวัติการเบิก-คืน
        </button>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        
        <div className="search-bar-wrapper" style={{ flex: 1, minWidth: "250px", marginBottom: 0 }}>
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="ค้นหาเลขที่รายการ หรือ ชื่อผู้ดำเนินการ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-wrapper" style={{ position: "relative", minWidth: "200px" }}>
            <FaFilter style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#888" }} />
            <select
                className="form-control"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{ paddingLeft: "35px", height: "100%", cursor: "pointer" }}
            >
                <option value="">ทั้งหมด</option>
                {options.types.map((t) => (
                    <option key={t.transaction_type_id} value={t.transaction_type_id}>
                        {t.transaction_type_name}
                    </option>
                ))}
            </select>
        </div>

      </div>

      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>เลขที่รายการ</th>
              <th>วันที่</th>
              <th>ประเภท</th>
              <th>ผู้ดำเนินการ</th>
              <th>ครุภัณฑ์</th>
              <th style={{textAlign:'center'}}>จำนวนรายการ</th>
              <th style={{textAlign:'center'}}>ดูข้อมูล</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((item) => (
                <tr key={item.transaction_id}>
                  <td className="text-primary fw-bold">{item.transaction_id}</td>
                  <td>{new Date(item.date).toLocaleDateString('th-TH')} {item.time}</td>
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
              ))
            ) : (
                <tr><td colSpan="7" style={{textAlign:'center', padding: '20px'}}>ไม่พบข้อมูลที่ค้นหา</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content transaction-modal">
            <div className="modal-header">
              <h3>{viewMode ? "รายละเอียดรายการ" : "สร้างรายการใหม่"}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}><FaTimes /></button>
            </div>
            
            <div className="modal-body">
                {viewMode ? (
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
                                        <td style={{fontWeight:'bold'}}>{item.quantity} {item.unit}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="section-box">
                            <h4>1. ข้อมูลทั่วไป</h4>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>ประเภทรายการ <span className="text-danger">*</span></label>
                                    <select 
                                        className="form-control"
                                        value={headerData.type_mode}
                                        onChange={e => {
                                            const mode = e.target.value;
                                            // ถ้าเป็น คืน หรือ ยืม ให้เคลียร์ค่าครุภัณฑ์ทิ้งอัตโนมัติ
                                            const resetMachine = (mode === 'return' || mode === 'borrow') ? "" : headerData.machine_SN;
                                            setHeaderData({...headerData, type_mode: mode, machine_SN: resetMachine});
                                        }}
                                        required
                                    >
                                        <option value="withdraw">เบิก</option>
                                        <option value="return">คืน</option>
                                        <option value="borrow">เบิกล่วงหน้า</option>
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
                                        disabled={headerData.type_mode === 'return' || headerData.type_mode === 'borrow'}
                                    >
                                        <option value="">-- ไม่ระบุ --</option>
                                        {options.machines.map(m => <option key={m.machine_SN} value={m.machine_SN}>{m.machine_name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="section-box">
                            <h4>2. เพิ่มรายการอะไหล่</h4>
                            <div className="add-item-row">
                                <select 
                                    className="form-control" 
                                    style={{flex: 2}}
                                    value={currentItem.lot_id || ""}
                                    onChange={(e) => {
                                        const selectedLotId = e.target.value;
                                        const selectedLot = options.lots.find(l => String(l.lot_id) === String(selectedLotId));
                                        setCurrentItem({
                                            ...currentItem, 
                                            lot_id: selectedLotId,
                                            equipment_id: selectedLot ? selectedLot.equipment_id : "" // แนบ equipment_id ไปด้วย
                                        });
                                    }}
                                >
                                    <option value="">-- เลือก Lot อะไหล่ --</option>
                                    {options.lots && options.lots.map(lot => (
                                        <option key={lot.lot_id} value={lot.lot_id}>
                                            {`${lot.lot_id} ${lot.equipment_id} ${lot.model_size || ''} ${lot.equipment_type_id} ${lot.equipment_name}`}
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