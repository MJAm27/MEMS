import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom"; 
import InventoryBalanceReportChart from "./InventoryBalanceReportChart"; 
import "./ReportPage.css";

const API_BASE_URL = process.env.REACT_APP_API_URL;

function ReportPage() {
  const navigate = useNavigate();

  const [summary, setSummary] = useState({
    total: 0,
    nearExpire: 0,
    nearOutOfStock: 0
  });

  const [usage, setUsage] = useState({
    borrow: { daily: 0, monthly: 0 },
    return: { daily: 0, monthly: 0 }
  });

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      const [summaryRes, usageRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/report/summary`),
        axios.get(`${API_BASE_URL}/api/report/usage`)
      ]);

      setSummary(summaryRes.data);
      setUsage(usageRes.data);
    } catch (err) {
      console.error("โหลดรายงานไม่สำเร็จ", err);
    }
  };

  return (
    <div className="report-page fade-in">
      <h1 className="page-title">Dashboard ภาพรวม</h1>

      {/* ส่วนสรุปตัวเลข */}
      <div className="report-summary-grid">
        <div className="summary-card">
          อะไหล่ทั้งหมด
          <strong>{summary.total}</strong>
        </div>
        <div className="summary-card warning">
          ใกล้หมดอายุ
          <strong>{summary.nearExpire}</strong>
        </div>
        <div className="summary-card danger">
          ใกล้หมดสต็อก
          <strong>{summary.nearOutOfStock}</strong>
        </div>
      </div>

      {/* แก้ไขตรงนี้: นำค่าจาก usage มาแสดงผล */}
      <div className="report-usage-grid">
        <div className="usage-card">
          <span>เบิกรายวัน</span>
          <strong>{usage.borrow.daily}</strong>
        </div>
        <div className="usage-card">
          <span>เบิกรายเดือน</span>
          <strong>{usage.borrow.monthly}</strong>
        </div>
        <div className="usage-card">
          <span>คืนรายวัน</span>
          <strong>{usage.return.daily}</strong>
        </div>
        <div className="usage-card">
          <span>คืนรายเดือน</span>
          <strong>{usage.return.monthly}</strong>
        </div>
      </div>

      {/* --- ส่วนที่เพิ่มใหม่: Chart Grid 4 ช่อง --- */}
      <h3 className="section-title">สถิติและกราฟ</h3>
      <div className="chart-dashboard-grid">
        
        {/* กราฟที่ 1: Inventory Balance (Active) */}
        <div 
            className="chart-widget-card clickable" 
            onClick={() => navigate('/report/inventory-balance')} 
            title="คลิกเพื่อดูรายละเอียด"
        >
            <div className="widget-header">
                <h4>ปริมาณคงเหลือ (Top 5)</h4>
                <span className="view-more">ดูทั้งหมด &gt;</span>
            </div>
            <div className="widget-body">
                <InventoryBalanceReportChart isPreview={true} />
            </div>
        </div>

        {/* กราฟที่ 2 (Placeholder) */}
        <div className="chart-widget-card placeholder">
            <div className="empty-state">Coming Soon: กราฟยอดเบิกจ่าย</div>
        </div>

        {/* กราฟที่ 3 (Placeholder) */}
        <div className="chart-widget-card placeholder">
            <div className="empty-state">Coming Soon: กราฟมูลค่าคลัง</div>
        </div>

        {/* กราฟที่ 4 (Placeholder) */}
        <div className="chart-widget-card placeholder">
             <div className="empty-state">Coming Soon: กราฟของเสีย</div>
        </div>

      </div>
    </div>
  );
}

export default ReportPage;