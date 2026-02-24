import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaSearch, FaBoxOpen, FaLayerGroup, FaExclamationCircle } from "react-icons/fa";
import "./ManagerEquipmentPage.css";

const API_BASE_URL = process.env.REACT_APP_API_URL ;

function ManagerEquipmentPage() {
    const [equipmentData, setEquipmentData] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_BASE_URL}/api/manager/equipment-details`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setEquipmentData(res.data);
            } catch (err) {
                console.error("Error fetching equipment details:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filtered = equipmentData.filter(item => 
        item.equipment_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.equipment_type_id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="loading-state">กำลังดึงข้อมูลคลังอะไหล่...</div>;

    return (
        <div className="manager-eq-container fade-in">
            <header className="section-header">
                <h2 className="title"><FaBoxOpen /> รายการอะไหล่ทั้งหมด (Read-only)</h2>
                <div className="search-box">
                    <FaSearch />
                    <input 
                        type="text" 
                        placeholder="ค้นหารหัส หรือชื่ออะไหล่..." 
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </header>

            <div className="table-responsive-wrapper">
                <div className="table-card">
                    <table className="custom-table">
                        <thead>
                            <tr>
                                <th>รหัสประเภท</th>
                                <th>ชื่ออะไหล่</th>
                                <th>จำนวนล็อต</th>
                                <th>คงคลังรวม</th>
                                <th>ช่วงราคา</th>
                                <th>สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((item) => {
                                const isLow = (item.total_stock || 0) <= (item.alert_quantity || 0);
                                return (
                                    <tr key={item.equipment_id}>
                                        <td><span className="id-tag">{item.equipment_type_id}</span></td>
                                        <td className="eq-name"><strong>{item.equipment_name}</strong></td>
                                        <td><FaLayerGroup /> {item.total_lots} ล็อต</td>
                                        <td>
                                            <span className={`stock-text ${isLow ? 'danger' : 'success'}`}>
                                                {item.total_stock} {item.unit}
                                            </span>
                                        </td>
                                        <td>
                                            {item.min_price ? 
                                                `${Number(item.min_price).toLocaleString()} - ${Number(item.max_price).toLocaleString()} บ.` : 
                                                "ไม่มีข้อมูล"}
                                        </td>
                                        <td>
                                            <span className={`alert-badge ${isLow ? 'low' : 'ok'}`}>
                                                {isLow ? <><FaExclamationCircle /> สต็อกต่ำ</> : 'ปกติ'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default ManagerEquipmentPage;