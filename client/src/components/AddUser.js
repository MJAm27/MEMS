import React, { useState } from "react";
import axios from "axios";
import "./UserForm.css";

export default function AddUser() {
    const [form, setForm] = useState({
        email: "",
        fullname: "",
        position: "",
        phone_number: "",
        role_id: "R-ENG",
        password: ""
    });

    const onChange = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        await axios.post(`${process.env.REACT_APP_API_URL}/api/users`, form);
        alert("เพิ่มผู้ใช้สำเร็จ");
    };

    return (
        <div className="content-body">
            <div className="userform-wrapper">
                <h2>เพิ่มผู้ใช้งาน</h2>

                <form onSubmit={submit} className="user-form">

                    <input type="email" name="email" placeholder="Email"
                        value={form.email} onChange={onChange} required />

                    <input type="text" name="fullname" placeholder="ชื่อ - สกุล"
                        value={form.fullname} onChange={onChange} required />

                    <input type="text" name="position" placeholder="ตำแหน่ง"
                        value={form.position} onChange={onChange} />

                    <input type="text" name="phone_number" placeholder="เบอร์โทร"
                        value={form.phone_number} onChange={onChange} />

                    <select name="role_id" value={form.role_id} onChange={onChange}>
                        <option value="R-ADM">Admin</option>
                        <option value="R-ENG">Engineer</option>
                        <option value="R-MGR">Manager</option>
                    </select>

                    <input type="password" name="password" placeholder="รหัสผ่าน"
                        value={form.password} onChange={onChange} required />

                    <button type="submit" className="btn-submit">บันทึก</button>
                </form>
            </div>
        </div>
    );
}
