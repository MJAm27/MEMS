import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom"; 
import InventoryBalanceReportChart from "./InventoryBalanceReportChart"; 
import EquipmentUsageReportChart from "./EquipmentUsageReportChart";
import EquipmentAgeReportChart from "./EquipmentAgeReportChart";
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

  const [accessLogs, setAccessLogs] = useState([]);
  const [accessLogFilter] = useState("all");

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      // ใช้ Promise.allSettled เพื่อให้ตัวที่สำเร็จยังคืนค่ามาได้ แม้จะมีบางตัวพัง
      const [summaryRes, usageRes, accessLogsRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/report/summary`),
        axios.get(`${API_BASE_URL}/api/report/usage`),
        axios.get(`${API_BASE_URL}/api/report/accesslogs`)
      ]);

      // เซ็ตข้อมูล summary ถ้าสำเร็จ
      if (summaryRes.status === "fulfilled") {
        setSummary(summaryRes.value.data);
      } else {
        console.error("โหลด summary ไม่สำเร็จ", summaryRes.reason);
      }

      // เซ็ตข้อมูล usage ถ้าสำเร็จ
      if (usageRes.status === "fulfilled") {
        setUsage(usageRes.value.data);
      } else {
        console.error("โหลด usage ไม่สำเร็จ", usageRes.reason);
      }

      // เซ็ตข้อมูล accesslogs ถ้าสำเร็จ
      if (accessLogsRes.status === "fulfilled") {
        setAccessLogs(accessLogsRes.value.data);
      } else {
        console.error("โหลด accesslogs ไม่สำเร็จ", accessLogsRes.reason);
        setAccessLogs([]); // ตั้งค่าเป็น array ว่างเพื่อป้องกัน map() error
      }

    } catch (err) {
      console.error("เกิดข้อผิดพลาดในการเชื่อมต่อ API", err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const filteredAccessLogs = accessLogs.filter((log) => {
    if (accessLogFilter === "all") return true;
    return log.action_type_name === accessLogFilter;
  });

const parseItems = (itemsJson) => {
    if (!itemsJson) return [];
    try {
        return typeof itemsJson === 'string' ? JSON.parse(itemsJson) : itemsJson;
    } catch (error) {
        return [];
    }
  };

  return (
    <div className="report-page fade-in">
      <h1 className="page-title">Dashboard ภาพรวม</h1>

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

      <h3 className="section-title">สถิติและกราฟ</h3>
      <div className="chart-dashboard-grid">
        
        <div 
            className="chart-widget-card clickable" 
            onClick={() => navigate('/report/inventory-balance')} 
        >
            <div className="widget-header">
                <h4>ปริมาณคงเหลือ (Top 5)</h4>
                <span className="view-more">ดูทั้งหมด &gt;</span>
            </div>
            <div className="widget-body">
                <InventoryBalanceReportChart isPreview={true} />
            </div>
        </div>

        <div 
            className="chart-widget-card clickable" 
            onClick={() => navigate('/report/equipment-usage')} 
        >
            <div className="widget-header">
                <h4>ยอดการใช้อะไหล่สูงสุด</h4>
                <span className="view-more">ดูทั้งหมด &gt;</span>
            </div>
            <div className="widget-body">
                <EquipmentUsageReportChart isPreview={true} />
            </div>
        </div>

        <div 
            className="chart-widget-card clickable"
            onClick={() => navigate('/report/equipment-age')}
        >
            <div className="widget-header">
                <h4>อายุอะไหล่คงคลังเฉลี่ย</h4>
                <span className="view-more">ดูทั้งหมด &gt;</span>
            </div>
            <div className="widget-body">
                <EquipmentAgeReportChart isPreview={true} />
            </div>
        </div>

      </div>
      <div className="accesslog-section">
        <div className="accesslog-header">
          <h3 className="section-title" style={{ margin: 0 }}>รายงานการใช้งานกล่อง</h3>
        </div>
        <div className="table-responsive">
          <table className="report-table">
            <thead>
              <tr>
                <th>วันที่/เวลา</th>
                <th>ผู้ทำรายการ</th>
                <th>ประเภทงาน</th>
                <th>ตึก/แผนก</th>
                <th>เครื่องที่นำใช้</th>
                <th>เลขครุภัณฑ์ (รพ.)</th>
                <th>SN (โรงงาน)</th>
                <th>รายการอะไหล่</th>
                <th>เวลาเปิด-ปิดตู้</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccessLogs.length > 0 ? (
                filteredAccessLogs.map((row) => (
                  <tr key={row.transaction_id || row.log_id}>
                    <td>
                      <div>{formatDate(row.date)}</div>
                      <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>{row.time}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: '500', color: '#1e293b' }}>{row.fullname || "-"}</div>
                      <small className="tx-id-sub">Ref: {row.transaction_id || "-"}</small>
                    </td>
                    <td>{row.repair_type_name || "-"}</td>
                    <td>
                      <div>{row.buildings || "-"}</div>
                      <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>{row.department_name || "-"}</div>
                    </td>
                    <td>{row.machine_type_name || "-"}</td>
                    <td>{row.machine_number || "-"}</td>
                    <td>{row.machine_SN || "-"}</td>
                    <td>
                      <div className="items-list-vertical">
                        {parseItems(row.items_json).map((it, i) => (
                          <div key={i} className="item-pill-vertical">
                            <span className="item-name">{it.name}</span>
                            <span className="item-qty">x{it.qty}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={{ minWidth: '130px' }}>
                      <div className="time-row">
                        <span className="time-label-open">เปิด</span> 
                        <b>{row.open_time || '--:--'}</b>
                      </div>
                      <div className="time-row">
                        <span className="time-label-close">ปิด</span> 
                        <b>{row.close_time || '--:--'}</b>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="text-center py-4" style={{ color: '#94a3b8' }}>
                    ไม่มีข้อมูลการใช้งาน
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ReportPage;