import React, { useEffect, useState } from "react";
import axios from "axios";
import "./UserList.css";
import { Link } from "react-router-dom";

export default function UserList() {
    const [users, setUsers] = useState([]);

    const loadUsers = async () => {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/users`);
        setUsers(res.data);
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const deleteUser = async (id) => {
        if (!window.confirm("ต้องการลบผู้ใช้นี้หรือไม่?")) return;
        await axios.delete(`${process.env.REACT_APP_API_URL}/api/users/${id}`);
        loadUsers();
    };

    return (
        <div className="content-body">
            <div className="userlist-wrapper">
                <div className="userlist-header">
                    <h2>รายการผู้ใช้งาน</h2>
                    <Link to="/users/add" className="btn-add">+ เพิ่มผู้ใช้</Link>
                </div>

                <table className="user-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Email</th>
                            <th>ชื่อ - สกุล</th>
                            <th>ตำแหน่ง</th>
                            <th>เบอร์โทร</th>
                            <th>Role</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>

                    <tbody>
                        {users.map((u) => (
                            <tr key={u.user_id}>
                                <td>{u.user_id}</td>
                                <td>{u.email}</td>
                                <td>{u.fullname}</td>
                                <td>{u.position}</td>
                                <td>{u.phone_number}</td>
                                <td>{u.role_id}</td>

                                <td>
                                    <Link className="btn-edit" to={`/users/edit/${u.user_id}`}>
                                        แก้ไข
                                    </Link>
                                    <button className="btn-delete" onClick={() => deleteUser(u.user_id)}>
                                        ลบ
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

            </div>
        </div>
    );
}
