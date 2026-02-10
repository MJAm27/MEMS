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
            const res = await axios.get(`${API_BASE}/api/inventory/details/${equipmentId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedPart(res.data);
            setShowModal(true);
        } catch (err) {
            console.error("Fetch details error:", err);
            alert("ไม่สามารถดึงข้อมูลรายละเอียดได้");
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
                                <div className="card-top">
                                    <div className="part-icon"><FaBox /></div>
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
                                        onClick={() => handleViewDetails(item.equipment_id)} // เรียกใช้ฟังก์ชันที่นี่
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

            {/* ส่วนแสดง Modal รายละเอียดสต็อก */}
            {showModal && selectedPart && (
                <div className="modal-overlay">
                    <div className="modal-content fade-in">
                        <div className="modal-header">
                            <h3><FaInfoCircle /> รายละเอียดสต็อก: {selectedPart.equipment_name}</h3>
                            <button className="close-btn" onClick={() => setShowModal(false)}><FaTimes /></button>
                        </div>
                        <div className="modal-body">
                            <div className="part-summary">
                                <p><strong>รหัสอุปกรณ์:</strong> {selectedPart.equipment_id}</p>
                                <p><strong>ขนาด/รุ่น:</strong> {selectedPart.model_size}</p>
                                <p><strong>จำนวนรวมทุกล็อต:</strong> <span className="total-qty">{selectedPart.total_quantity}</span> {selectedPart.unit}</p>
                            </div>
                            <hr />
                            <h4><FaWarehouse /> ข้อมูลแยกตามล็อต</h4>
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
                                                <FaCalendarAlt /> {lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString('th-TH') : 'ไม่มี'}
                                            </td>
                                            <td><strong>{lot.current_quantity}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SearchPartPageENG;