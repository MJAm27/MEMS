import React, { useEffect, useState } from "react";
import axios from "axios";
import "./UserForm.css";
import { useParams } from "react-router-dom";

export default function EditUser() {
    const { id } = useParams();
    const [form, setForm] = useState({
        email: "",
        fullname: "",
        position: "",
        phone_number: "",
        role_id: ""
    });

    useEffect(() => {
        axios.get(`${process.env.REACT_APP_API_URL}/api/users/${id}`)
            .then(res => setForm(res.data));
    }, [id]);

    const onChange = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        await axios.put(`${process.env.REACT_APP_API_URL}/api/users/${id}`, form);
        alert("แก้ไขข้อมูลสำเร็จ");
    };

    return (
        <div className="content-body">
            <div className="userform-wrapper">
                <h2>แก้ไขผู้ใช้งาน</h2>

                <form onSubmit={submit} className="user-form">

                    <input type="email" name="email" value={form.email}
                        onChange={onChange} required />

                    <input type="text" name="fullname" value={form.fullname}
                        onChange={onChange} required />

                    <input type="text" name="position" value={form.position}
                        onChange={onChange} />

                    <input type="text" name="phone_number" value={form.phone_number}
                        onChange={onChange} />

                    <select name="role_id" value={form.role_id} onChange={onChange}>
                        <option value="R-ADM">Admin</option>
                        <option value="R-ENG">Engineer</option>
                        <option value="R-MGR">Manager</option>
                    </select>

                    <button type="submit" className="btn-submit">บันทึก</button>
                </form>
            </div>
        </div>
    );
}
