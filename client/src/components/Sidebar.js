import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaHome, FaSearch, FaHistory, FaUser } from 'react-icons/fa';
import './Sidebar.css';

function Sidebar() {
    return (
        <nav className="sidebar-container">
            {/* ส่วนหัวของ Sidebar (ใส่โลโก้หรือชื่อโปรเจกต์) */}
            <div className="sidebar-header">
                <h3>MEMS</h3>
            </div>

            {/* รายการเมนู */}
            <ul className="sidebar-nav">
                <li>
                    <NavLink 
                        to="/dashboard" 
                        className={({isActive}) => isActive ? "nav-link active" : "nav-link"}
                    >
                        <FaHome /> <span>หน้าหลัก</span>
                    </NavLink>
                </li>
                <li>
                    <NavLink 
                        to="/search" 
                        className={({isActive}) => isActive ? "nav-link active" : "nav-link"}
                    >
                        <FaSearch /> <span>ค้นหา</span>
                    </NavLink>
                </li>
                <li>
                    <NavLink 
                        to="/history" 
                        className={({isActive}) => isActive ? "nav-link active" : "nav-link"}
                    >
                        <FaHistory /> <span>ประวัติ</span>
                    </NavLink>
                </li>
                <li>
                    <NavLink 
                        to="/profile" 
                        className={({isActive}) => isActive ? "nav-link active" : "nav-link"}
                    >
                        <FaUser /> <span>โปรไฟล์</span>
                    </NavLink>
                </li>
            </ul>
        </nav>
    );
}

export default Sidebar;