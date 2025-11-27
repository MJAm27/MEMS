// ไฟล์: WithdrawPage.js

import React from 'react';

function WithdrawPage() {
    return (
        // style นี้เพื่อให้เห็นขอบเขตชัดเจน (นำออกได้)
        <div style={{ 
            padding: '20px', 
            background: '#ffffff', 
            borderRadius: '8px', 
            marginTop: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
            <h2>หน้าเบิกอะไหล่ (เนื้อหาจริง)</h2>
            
            <p>คุณสามารถสร้างฟอร์ม หรือ ตารางสำหรับเบิกอะไหล่ที่นี่</p>
            
            <form>
                <div>
                    <label htmlFor="part-id">รหัสอะไหล่: </label>
                    <input id="part-id" type="text" style={{ marginLeft: '10px', padding: '5px' }} />
                </div>
                <div style={{ marginTop: '10px' }}>
                    <label htmlFor="part-qty">จำนวน: </label>
                    <input id="part-qty" type="number" style={{ marginLeft: '10px', padding: '5px' }} />
                </div>
                <button type="submit" style={{ marginTop: '15px', padding: '8px 12px' }}>
                    ยืนยันการเบิก
                </button>
            </form>

            
        </div>
    );
}

export default WithdrawPage;