// import React, { useEffect, useState } from "react";
// import { Bar } from "react-chartjs-2";
// import {
//   Chart as ChartJS,
//   CategoryScale,
//   LinearScale,
//   BarElement,
//   Title,
//   Tooltip,
// } from "chart.js";

// ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

// function InventoryBalanceReportChart() {
//   const [chartData, setChartData] = useState([]);

//   useEffect(() => {
//     fetch(`${process.env.REACT_APP_API_URL}/api/inventoryBalanceReportChart`)
//       .then((res) => res.json())
//       .then((data) => {
//         // เรียงจากมากไปน้อย
//         console.log("Raw data from API:", data);
//         const sorted = data.sort((a, b) => b.quantity - a.quantity);
//         setChartData(sorted);
//         console.log(sorted); 
//       });
//   }, []);
// const getBarColor = (current_quantity, alert_quantity) => {
//   const qty = Number(current_quantity);
//   const alert = Number(alert_quantity || 0); // fallback ถ้า null/undefined

//   if (qty > alert) return "#2E7D32";       
//   if (qty > alert / 2) return "#FB8C00";   
//   return "#D32F2F";                            
// };
// const data = {
//   labels: chartData.map(i => i.name),
//   datasets: [
//     {
//       label: "ปริมาณคงเหลือ",
//       data: chartData.map((i) => i.quantity),
//       backgroundColor: chartData.map(i =>
//         getBarColor(i.quantity, i.alert)
//       ),
//       borderRadius: 8,
//       barThickness: 18,
//     },
//   ],
// };
//   const options = {
//     indexAxis: "y",
//     responsive: true,
//     maintainAspectRatio: false,
//     plugins: {
//       title: {
//         display: true,
//         text: "รายงานปริมาณคงเหลือสินค้า",
//         font: { size: 20 },
//         padding: { bottom: 20 },
//       },
//       tooltip: {
//         callbacks: {
//           label: (ctx) => {
//             const d = chartData[ctx.dataIndex];
//             return `คงเหลือ ${d.quantity} | จุดเตือน ${d.alert}`;
//           },
//         },
//       },

//     },
//     scales: {
//       x: {
//         beginAtZero: true,
//         grid: {
//           color: "#e0e0e0",
//         },
//         ticks: {
//           stepSize: 10,
//         },
//       },
//       y: {
//         grid: {
//           display: false,
//         },
//         ticks: {
//           autoSkip: false,
//           font: { size: 12 },
//         },
//       },
//     },
//   };

//   if (chartData.length === 0) {
//   return <div>Loading data...</div>;
// }

//   return (
//     <div
//       style={{
//         width: "100%",
//         height: `${chartData.length * 35}px`,
//         padding: 20,
//       }}
//     >
//       <Bar data={data} options={options} />
//     </div>
//   );
// }

// export default InventoryBalanceReportChart;

import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend, // เพิ่ม Legend
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// รับ prop: isPreview เพื่อเช็คว่าเป็นหน้าเต็ม หรือ Widget หน้าหลัก
function InventoryBalanceReportChart({ isPreview = false }) {
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/inventoryBalanceReportChart`)
      .then((res) => res.json())
      .then((data) => {
        // เรียงจากมากไปน้อย
        const sorted = data.sort((a, b) => b.quantity - a.quantity);
        // ถ้าเป็น Preview ให้ตัดมาโชว์แค่ 5 อันดับแรกพอกราฟจะได้ไม่แน่นเกินไป
        setChartData(isPreview ? sorted.slice(0, 5) : sorted);
      });
  }, [isPreview]);

  const getBarColor = (current_quantity, alert_quantity) => {
    const qty = Number(current_quantity);
    const alert = Number(alert_quantity || 0);

    if (qty > alert) return "#2E7D32";
    if (qty > alert / 2) return "#FB8C00";
    return "#D32F2F";
  };

  const data = {
    labels: chartData.map((i) => i.name),
    datasets: [
      {
        label: "ปริมาณ",
        data: chartData.map((i) => i.quantity),
        backgroundColor: chartData.map((i) =>
          getBarColor(i.quantity, i.alert)
        ),
        borderRadius: 4,
        barThickness: isPreview ? 20 : 30, // ถ้าเป็น Preview ให้แท่งเล็กลง
      },
    ],
  };

  const options = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // ซ่อน Legend
      },
      title: {
        display: !isPreview, // ถ้าเป็น Preview ไม่ต้องโชว์ Title (เพราะการ์ดข้างนอกมีหัวข้อแล้ว)
        text: "รายงานปริมาณคงเหลือสินค้า",
        font: { size: 20 },
        padding: { bottom: 20 },
      },
      tooltip: {
        enabled: !isPreview, // ถ้าเป็น Preview อาจจะปิด Tooltip เพื่อให้คลิกง่ายขึ้น (แล้วแต่ชอบ)
      },
    },
    scales: {
      x: {
        display: !isPreview, // ซ่อนแกน X ถ้าเป็น Preview เพื่อความสะอาดตา
        beginAtZero: true,
      },
      y: {
        ticks: {
          autoSkip: false,
          font: { size: isPreview ? 10 : 12 } // ลดขนาดฟอนต์ถ้าเป็น Preview
        },
        grid: {
          display: false,
        }
      },
    },
    // ถ้าเป็น Preview ให้ปิด interactive events เพื่อให้คลิกที่ Div ครอบได้ง่าย
    events: isPreview ? [] : ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
  };

  return (
    <div style={{ width: "100%", height: "100%" }}>
      {chartData.length > 0 ? (
        <Bar data={data} options={options} />
      ) : (
        <p style={{textAlign:'center', fontSize:'0.8rem', color:'#999'}}>Loading...</p>
      )}
    </div>
  );
}

export default InventoryBalanceReportChart;