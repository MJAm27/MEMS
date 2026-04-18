import React, { useState, useEffect, useCallback } from "react"; 
import "./ManageTransaction.css";
import { FaPlus, FaSearch, FaEye, FaTimes, FaTrash, FaFilter, FaEdit } from "react-icons/fa";
import axios from "axios";
import SubNavbar from "./SubNavbar";

const API_BASE_URL = process.env.REACT_APP_API_URL;

function ManageTransaction() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true); 
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState(false); 
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTransactionId, setEditTransactionId] = useState(null);

  const [options, setOptions] = useState({ 
    users: [], 
    machines: [], 
    types: [], 
    equipments: [],
    lots: [],
    repair_type: [], 
    department: []
  });

  const [headerData, setHeaderData] = useState({
    type_mode: "withdraw", 
    user_id: "",
    machine_id: "",
    parent_transaction_id: "",
    machine_number: "",
    machine_SN: "",
    repair_type_id: "",
    department_id: "",
    is_pending: 0,
    manager_acknowledged: 0,
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
        setCurrentItem({ lot_id: "", equipment_id: "", quantity: 1 }); 
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
    
    if (!headerData.type_mode || !headerData.user_id) {
       alert("กรุณาระบุประเภทและผู้ทำรายการ");
       return; 
    }

    try {
      const payload = {
        ...headerData,
        items: cartItems
      };

      if (isEditMode) {
        await axios.put(`${API_BASE_URL}/api/transactions/${editTransactionId}`, payload);
        alert("แก้ไขรายการสำเร็จ!");
      } else {
        await axios.post(`${API_BASE_URL}/api/transactions`, payload);
        alert("บันทึกรายการสำเร็จ!");
      }

      setShowModal(false);
      fetchTransactions(); 
      handleResetForm();
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการบันทึก: " + (error.response?.data?.error || error.message));
    }
  };

  const handleResetForm = () => {
    setHeaderData({ 
        type_mode: "withdraw", 
        user_id: "", 
        machine_id: "",
        department_id: "",       
        repair_type_id: "",      
        machine_number: "",      
        machine_SN: "",          
        parent_transaction_id: "", 
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('th-TH', { hour12: false }).slice(0, 5)
    });
    setCartItems([]);
    setIsEditMode(false);
    setEditTransactionId(null);
  };

  const handleOpenAdd = () => {
      handleResetForm();
      setViewMode(false);
      setShowModal(true);
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

  const handleEdit = async (trans) => {
    setViewMode(false);
    setIsEditMode(true);
    setEditTransactionId(trans.transaction_id);

    let mappedTypeMode = "withdraw";
    if (trans.transaction_type_name?.includes("คืนอะไหล่")) mappedTypeMode = "return";
    if (trans.transaction_type_name?.includes("เบิกอะไหล่ล่วงหน้า")) mappedTypeMode = "borrow";

    // +++ นำ ID ที่ได้จาก Backend มาเซ็ตค่าให้ Form +++
    setHeaderData({
      type_mode: mappedTypeMode,
      user_id: trans.user_id || "", 
      machine_id: trans.machine_id || "",
      department_id: trans.department_id || "",     
      repair_type_id: trans.repair_type_id || "",   
      machine_number: trans.machine_number || "",   
      machine_SN: trans.machine_SN || "",           
      parent_transaction_id: trans.parent_transaction_id || "",
      date: trans.date ? new Date(trans.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      time: trans.time || new Date().toLocaleTimeString('th-TH', { hour12: false }).slice(0, 5)
    });

    try {
        const res = await axios.get(`${API_BASE_URL}/api/transactions/${trans.transaction_id}/items`);
        setCartItems(res.data);
    } catch (error) {
        console.error("Fetch Items Error:", error);
    }
    
    setShowModal(true);
  };

  const handleDelete = async (transaction_id) => {
    if (window.confirm(`คุณต้องการลบรายการเลขที่ ${transaction_id} ใช่หรือไม่? \n(คำเตือน: หากลบแล้วจะไม่สามารถกู้คืนได้)`)) {
      try {
        await axios.delete(`${API_BASE_URL}/api/transactions/${transaction_id}`);
        fetchTransactions(); 
        alert("ลบข้อมูลสำเร็จ");
      } catch (error) {
        console.error("Error deleting:", error);
        alert("ไม่สามารถลบได้ เกิดข้อผิดพลาดจากระบบฐานข้อมูล");
      }
    }
  };

 const filteredData = transactions.filter(t => {
    if (!t) return false;
    const searchLower = (searchTerm || "").toLowerCase().trim();
    const matchesSearch = searchLower === "" || 
        (t.transaction_id || "").toString().toLowerCase().includes(searchLower) ||
        (t.parent_transaction_id || "").toString().toLowerCase().includes(searchLower) ||
        (t.fullname || "").toString().toLowerCase().includes(searchLower) ||
        (t.machine_type_name || "").toString().toLowerCase().includes(searchLower) ||
        (t.transaction_type_name || "").toString().toLowerCase().includes(searchLower);

    let matchesType = true;
    if (filterType !== "") {
        const selectedOption = options.types.find(
            opt => opt.transaction_type_id.toString() === filterType.toString()
        );
        matchesType = selectedOption ? (t.transaction_type_name === selectedOption.transaction_type_name) : false;
    }

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
                <option value="">ทั้งหมดประเภท</option>
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
              <th>เลขที่ทำรายการ</th>
              <th>อ้างอิง</th>
              <th>วันที่</th>
              <th style={{ minWidth: '150px'}}>ประเภท</th>
              <th>ผู้ทำรายการ</th>
              <th>สถานะ</th>
              <th style={{textAlign:'center'}}>จำนวนรายการ</th>
              <th style={{textAlign:'center', minWidth: '150px'}}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((item) => (
                <tr key={item.transaction_id}>
                  <td className="text-primary fw-bold">{item.transaction_id}</td>
                  <td>{item.parent_transaction_id || "-"}</td>
                  <td>{new Date(item.date).toLocaleDateString('th-TH')} {item.time}</td>
                  <td>
                      <span className={`badge ${item.transaction_type_name && item.transaction_type_name.indexOf('เบิก') !== -1 ? 'bg-warning' : 'bg-success'}`}>
                          {item.transaction_type_name || "ไม่ระบุ"}
                      </span>
                  </td>
                  <td>{item.fullname}</td>
                  <td>
                      <span className={`badge ${item.is_pending ? 'bg-warning' : 'bg-success'}`} style={{fontSize: '0.75rem'}}>
                          {item.is_pending ? 'รอดำเนินการ' : 'เสร็จสิ้น'}
                      </span>
                  </td>
                  <td style={{textAlign:'center'}}>{item.item_count}</td>
                  <td style={{textAlign:'center'}}>
                    <div>
                      <div>
                        <button className="action-btn view-btn" onClick={() => handleViewDetail(item)} title="ดูรายละเอียด">
                          <FaEye /> 
                          <span style={{ fontSize: "0.8rem", marginLeft: "5px", fontWeight: "normal" }}>ดูรายการ</span>
                        </button>
                      </div>
                      <div>
                        <button className="action-btn edit-btn" onClick={() => handleEdit(item)} title="แก้ไขรายการ">
                          <FaEdit />
                        </button>
                        <button className="action-btn delete-btn" onClick={() => handleDelete(item.transaction_id)} title="ลบรายการ">
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
                <tr><td colSpan="8" style={{textAlign:'center', padding: '20px'}}>ไม่พบข้อมูลที่ค้นหา</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content transaction-modal" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h3>{viewMode ? "รายละเอียดรายการ" : (isEditMode ? `แก้ไขรายการ: ${editTransactionId}` : "สร้างรายการใหม่")}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}><FaTimes /></button>
            </div>
            
            <div className="modal-body">
                {viewMode ? (
                    <div>
                        <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <p><strong>ID:</strong> {selectedTransaction?.transaction_id}</p>
                            <p><strong>อ้างอิง:</strong> {selectedTransaction?.parent_transaction_id || "-"}</p>
                            <p><strong>วันที่:</strong> {new Date(selectedTransaction?.date).toLocaleDateString('th-TH')} {selectedTransaction?.time}</p>
                            <p><strong>ประเภท:</strong> {selectedTransaction?.transaction_type_name}</p>
                            <p><strong>ผู้ทำรายการ:</strong> {selectedTransaction?.fullname}</p>
                            <p><strong>แผนก/ตึก:</strong> {selectedTransaction?.department_name  || "-"} {selectedTransaction?.buildings  || "-"}</p>
                            <p><strong>ประเภทงานซ่อม:</strong> {selectedTransaction?.repair_type_name || "-"}</p>
                            <p><strong>เครื่องที่ใช้:</strong> {selectedTransaction?.machine_type_name || "-"}</p>
                            <p><strong>เลขครุภัณฑ์:</strong> {selectedTransaction?.machine_number || "-"}</p>
                            <p><strong>SN (โรงงาน):</strong> {selectedTransaction?.machine_SN || "-"}</p>
                            <p><strong>สถานะ:</strong> {selectedTransaction?.is_pending ? "รอดำเนินการ" : "เสร็จสิ้น"}</p>
                            <p><strong>รับทราบโดยผู้จัดการ:</strong> {selectedTransaction?.manager_acknowledged ? "รับทราบแล้ว" : "ยังไม่รับทราบ"}</p>
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
                            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div className="form-group">
                                    <label>ประเภทรายการ <span className="text-danger">*</span></label>
                                    <select 
                                        className="form-control" 
                                        value={headerData.type_mode} 
                                        onChange={e => {
                                            const newMode = e.target.value;
                                            setHeaderData({
                                                ...headerData, 
                                                type_mode: newMode,
                                                // ถ้ารูปแบบไม่ใช่ borrow (เบิกอะไหล่ล่วงหน้า) ให้รีเซ็ตค่ากลับเป็น 0 (ปกติ)
                                                is_pending: newMode === 'borrow' ? headerData.is_pending : 0,
                                                manager_acknowledged: newMode === 'borrow' ? headerData.manager_acknowledged : 0
                                            });
                                        }} 
                                        required
                                    >
                                        <option value="withdraw">เบิกอะไหล่</option>
                                        <option value="return">คืนอะไหล่</option>
                                        <option value="borrow">เบิกอะไหล่ล่วงหน้า</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>ผู้ทำรายการ <span className="text-danger">*</span></label>
                                    <select className="form-control" value={headerData.user_id} onChange={e => setHeaderData({...headerData, user_id: e.target.value})} required>
                                        <option value="">-- เลือกผู้ใช้ --</option>
                                        {options.users.map(u => <option key={u.user_id} value={u.user_id}>{u.fullname}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>รหัสอ้างอิง (Parent ID)</label>
                                    <input type="text" className="form-control" placeholder="ถ้ามี..." value={headerData.parent_transaction_id} onChange={e => setHeaderData({...headerData, parent_transaction_id: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label>แผนก / ตึก</label>
                                    <select className="form-control" value={headerData.department_id} onChange={e => setHeaderData({...headerData, department_id: e.target.value})}>
                                        <option value="">เลือกแผนก</option>
                                        {options.department && options.department.map(d => (
                                            <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>ประเภทงานซ่อม</label>
                                    <select className="form-control" value={headerData.repair_type_id} onChange={e => setHeaderData({...headerData, repair_type_id: e.target.value})}>
                                        <option value="">-- ไม่ระบุ --</option>
                                        {options.repair_type?.map(r => <option key={r.repair_type_id} value={r.repair_type_id}>{r.repair_type_name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>สถานะรายการ</label>
                                    <select className="form-control" value={headerData.is_pending} onChange={e => setHeaderData({...headerData, is_pending: Number(e.target.value)})}>
                                        <option value={0}>ปกติ / เสร็จสิ้น</option>
                                        <option value={1}>รอดำเนินการ (Pending)</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
                                    <input 
                                        type="checkbox" 
                                        id="mgrAck" 
                                        checked={headerData.manager_acknowledged === 1} 
                                        onChange={e => setHeaderData({...headerData, manager_acknowledged: e.target.checked ? 1 : 0})} 
                                        style={{ marginRight: '8px', transform: 'scale(1.2)' }} 
                                        disabled={headerData.type_mode !== 'borrow'}
                                    />
                                    <label 
                                        htmlFor="mgrAck" 
                                        style={{ 
                                            marginBottom: 0, 
                                            cursor: headerData.type_mode !== 'borrow' ? 'not-allowed' : 'pointer',
                                            color: headerData.type_mode !== 'borrow' ? '#aaa' : '#333' 
                                        }}
                                    >รับทราบโดยผู้จัดการแล้ว</label>
                                </div>
                            </div>
                        </div>

                        <div className="section-box">
                            <h4>2. ข้อมูลเครื่องมือ / ครุภัณฑ์</h4>
                            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                                <div className="form-group">
                                    <label>เครื่องที่นำไปใช้</label>
                                    <select className="form-control" value={headerData.machine_id} onChange={e => setHeaderData({...headerData, machine_id: e.target.value})}>
                                        <option value="">-- ไม่ระบุ --</option>
                                        {options.machines.map(m => (
                                            <option key={m.machine_id} value={m.machine_id}>
                                                {m.machine_type_name ? `${m.machine_type_name} - ${m.machine_supplier || ''} - ${m.machine_model || ''}` : (m.machine_type_name || m.machine_id)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>เลขครุภัณฑ์ (รพ.)</label>
                                    <input type="text" className="form-control" placeholder="เลขครุภัณฑ์..." value={headerData.machine_number} onChange={e => setHeaderData({...headerData, machine_number: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label>SN (โรงงาน)</label>
                                    <input type="text" className="form-control" placeholder="Serial Number..." value={headerData.machine_SN} onChange={e => setHeaderData({...headerData, machine_SN: e.target.value})} />
                                </div>
                            </div>
                        </div>

                        <div className="section-box">
                            <h4>3. เพิ่มรายการอะไหล่</h4>
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
                                            equipment_id: selectedLot ? selectedLot.equipment_id : "" 
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
                             <button type="submit" className="btn-primary">{isEditMode ? "บันทึกการแก้ไข" : "บันทึกข้อมูล"}</button>
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