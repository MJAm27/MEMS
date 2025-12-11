import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import "./LowStockAlert.css";

export default function LowStockAlert({ serverUrl = `${process.env.REACT_APP_API_URL}/api/lowStockAlert` }) {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const socket = io(serverUrl, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      console.log('connected to socket server');
    });

    socket.on('low_stock', data => {
      setCount(data.count);
      setItems(data.items || []);
    });

    // cleanup
    return () => socket.disconnect();
  }, [serverUrl]);

    return (
        <div className="content-body"> {/* ให้จัดอยู่ในโซนเนื้อหาเหมือนหน้าอื่น */}
            <div className="lowstock-wrapper">
                <button className="lowstock-button" onClick={() => setOpen(o => !o)}>
                    🛒 Stock
                    {count > 0 && <span className="lowstock-badge">{count}</span>}
                </button>

                {open && (
                    <div className="lowstock-panel fade-in">
                        <h4 className="lowstock-title">อะไหล่คงเหลือน้อย ({count})</h4>

                        {items.length === 0 && (
                            <div className="lowstock-empty">ไม่มีอะไหล่คงเหลือน้อย 👍</div>
                        )}

                        <ul className="lowstock-list">
                            {items.map((it) => (
                                <li key={it.id} className="lowstock-item">
                                    <strong>{it.name}</strong> — {it.quantity}
                                    <span className="limit-text">(limit {it.limit_quantity})</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}