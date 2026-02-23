import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaCogs, FaIndustry, FaUsers, FaTruck, FaExchangeAlt } from "react-icons/fa";
import "./SubNavbar.css";

const SubNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menus = [
    { name: "จัดการข้อมูลครุภัณฑ์", path: "/dashboard/admin/machine", icon: <FaIndustry /> },
    { name: "จัดกาขข้อมูลรอะไหล่", path: "/dashboard/admin/equipment", icon: <FaCogs /> },
    { name: "จัดการประวัติการเบิกคืน", path: "/dashboard/admin/transactions", icon: <FaExchangeAlt /> },
    { name: "จัดการข้อมูลบริษัทนำเข้าอะไหล่", path: "/dashboard/admin/supplier", icon: <FaTruck /> },
    { name: "จัดการข้อมูลผู้ใช้งาน", path: "/dashboard/admin/user", icon: <FaUsers /> },
  ];

  return (
    <div className="sub-nav-container">
      {menus.map((menu) => (
        <button
          key={menu.path}
          className={`sub-nav-item ${location.pathname === menu.path ? "active" : ""}`}
          onClick={() => navigate(menu.path)}
        >
          {menu.icon}
          <span>{menu.name}</span>
        </button>
      ))}
    </div>
  );
};

export default SubNavbar;