import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { 
    FaSearch, FaBox, FaBarcode, FaWarehouse, 
    FaExclamationCircle, FaTimes, FaCalendarAlt, FaInfoCircle 
} from "react-icons/fa";
import "./SearchPartPageENG.css";

const API_BASE = process.env.REACT_APP_API_URL;

function SearchPartPageENG() {
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedPart, setSelectedPart] = useState(null); // เก็บข้อมูลรายละเอียดสต็อกที่ดึงมา
    const [showModal, setShowModal] = useState(false);     // ควบคุมการแสดง Modal

    // ฟังก์ชันสำหรับดึงรายละเอียดสต็อกรายล็อต
    const handleViewDetails = async (equipmentId) => {
        try {
            const token = localStorage.getItem('token');
            // เรียก API รวม
            const res = await axios.get(`${API_BASE}/api/inventory`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // กรองข้อมูลเฉพาะของ ID ที่กด
            const specificLots = res.data.filter(item => item.equipment_id === equipmentId);
            
            if (specificLots.length > 0) {
                // สร้าง Object ใหม่เพื่อจัดรูปแบบให้เหมือนในรูปภาพ
                const partInfo = {
                    equipment_name: specificLots[0].equipment_name,
                    equipment_id: specificLots[0].equipment_id,
                    model_size: specificLots[0].model_size,
                    supplier_name: specificLots[0].supplier_name, // ชื่อบริษัท (A)
                    unit: specificLots[0].unit,
                    img: specificLots[0].img,
                    total_quantity: specificLots.reduce((sum, lot) => sum + lot.current_quantity, 0),
                    lots: specificLots // รายการล็อตทั้งหมดเพื่อไปแสดงวันหมดอายุ
                };
                setSelectedPart(partInfo);
                setShowModal(true);
            }
        } catch (err) {
            console.error("Fetch error:", err);
        }
    };

    const handleSearch = useCallback(async () => {
        if (!searchTerm.trim()) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE}/api/search/parts?term=${searchTerm}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setResults(res.data);
        } catch (err) {
            console.error("Search error:", err);
        } finally {
            setLoading(false);
        }
    }, [searchTerm]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            handleSearch();
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [handleSearch]);

    return (
        <div className="search-page-container fade-in">
            <div className="search-header-box">
                <h2><FaSearch /> ค้นหาข้อมูลอะไหล่</h2>
                <div className="search-input-wrapper">
                    <input 
                        type="text" 
                        placeholder="พิมพ์ชื่ออะไหล่, รหัสอะไหล่ หรือรหัสล็อต..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                    <FaSearch className="inner-search-icon" />
                </div>
            </div>

            <div className="search-results-section">
                {loading ? (
                    <div className="search-loading">กำลังค้นหา...</div>
                ) : results.length > 0 ? (
                    <div className="search-grid">
                        {results.map((item) => (
                            <div key={item.equipment_id} className="search-result-card">
                                {/* เพิ่มส่วนแสดงรูปภาพบน Card */}
                                <div className="card-image-preview">
                                    {item.img ? (
                                        <img src={`${API_BASE}/uploads/${item.img}`} alt={item.equipment_name} onError={(e) => e.target.src="https://via.placeholder.com/150?text=No+Image"} />
                                    ) : (
                                        <div className="no-image-placeholder"><FaBox size={40} /></div>
                                    )}
                                </div>
                                
                                <div className="card-top">
                                    <div className="part-main-info">
                                        <h4>{item.equipment_name}</h4>
                                        <span className="model-tag">{item.model_size}</span>
                                    </div>
                                </div>
                                <div className="card-details">
                                    <p><FaBarcode /> <strong>ID:</strong> {item.equipment_id}</p>
                                    <p><FaWarehouse /> <strong>ล็อตล่าสุด:</strong> {item.lot_id || 'ไม่มีข้อมูล'}</p>
                                </div>
                                <div className="card-footer">
                                    <button 
                                        className="btn-view-more" 
                                        onClick={() => handleViewDetails(item.equipment_id)}
                                    >
                                        ดูรายละเอียดสต็อก
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : searchTerm && !loading ? (
                    <div className="no-results">
                        <FaExclamationCircle /> ไม่พบข้อมูลอะไหล่ที่ค้นหา
                    </div>
                ) : (
                    <div className="search-placeholder">
                        <p>ระบุคำค้นหาเพื่อเริ่มค้นหาข้อมูลอะไหล่ในระบบ</p>
                    </div>
                )}
            </div>

            {/* ส่วนแสดง Modal รายละเอียดสต็อก (เพิ่มรูปภาพขนาดใหญ่) */}
            {showModal && selectedPart && (
                <div className="modal-overlay">
                    <div className="modal-content fade-in">
                        <div className="modal-header">
                            <h3><FaInfoCircle /> รายละเอียด: {selectedPart.equipment_name}</h3>
                            <button className="close-btn" onClick={() => setShowModal(false)}><FaTimes /></button>
                        </div>
                        <div className="modal-body">
                            <div className="modal-detail-grid">
                                {/* ฝั่งซ้าย: รูปภาพขนาดใหญ่ */}
                                <div className="modal-image-section">
                                    {selectedPart.img ? (
                                        <img src={`${API_BASE}/uploads/${selectedPart.img}`} alt="Part" className="large-part-img" />
                                    ) : (
                                        <div className="large-no-image"><FaBox size={80} /></div>
                                    )}
                                </div>

                                {/* ฝั่งขวา: ข้อมูลทั่วไป */}
                                <div className="modal-info-section">
                                    <div className="part-summary">
                                        <p><strong>รหัสอุปกรณ์:</strong> {selectedPart.equipment_id}</p>
                                        <p><strong>ขนาด/รุ่น:</strong> {selectedPart.model_size}</p>
                                        <p><strong>ผู้ผลิต/Supplier:</strong> {selectedPart.supplier_name}</p>
                                        <p className="total-highlight">
                                            <strong>จำนวนรวมทุกล็อต:</strong> 
                                            <span className="total-qty"> {selectedPart.total_quantity}</span> {selectedPart.unit}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <hr className="modal-divider" />
                            
                            <h4><FaWarehouse /> ข้อมูลแยกตามล็อต</h4>
                            <div className="table-responsive">
                                <table className="lot-table">
                                    <thead>
                                        <tr>
                                            <th>รหัสล็อต</th>
                                            <th>วันที่นำเข้า</th>
                                            <th>วันหมดอายุ</th>
                                            <th>จำนวนคงเหลือ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedPart.lots && selectedPart.lots.map((lot) => (
                                            <tr key={lot.lot_id} className={new Date(lot.expiry_date) < new Date() ? "expired-row" : ""}>
                                                <td>{lot.lot_id}</td>
                                                <td>{new Date(lot.import_date).toLocaleDateString('th-TH')}</td>
                                                <td>
                                                    <FaCalendarAlt className="mr-1" /> 
                                                    {lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString('th-TH') : 'ไม่มี'}
                                                </td>
                                                <td><strong className="text-pink">{lot.current_quantity}</strong></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SearchPartPageENG;