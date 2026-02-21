import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function EquipmentAgeReportChart({ isPreview = false }) {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    // ดึงข้อมูลอายุเฉลี่ยของอะไหล่ (คำนวณจาก DateDiff ของ import_date กับปัจจุบัน)
    fetch(`${process.env.REACT_APP_API_URL}/api/reports/equipment-age`)
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;

        // เรียงลำดับจากอายุมากไปน้อย (Top 5 สำหรับ Preview)
        const sorted = data.sort((a, b) => (b.avg_age_days || 0) - (a.avg_age_days || 0));
        const finalData = isPreview ? sorted.slice(0, 5) : sorted;

        setChartData({
          labels: finalData.map((item) => item.equipment_name),
          datasets: [
            {
              label: "อายุเฉลี่ย (วัน)",
              data: finalData.map((item) => Number(item.avg_age_days || 0).toFixed(1)),
              backgroundColor: "#FF9800", // สีส้ม เพื่อความแตกต่าง
              borderRadius: 4,
              barThickness: isPreview ? 20 : 35,
            },
          ],
        });
      })
      .catch((err) => console.error("Error fetching age data:", err));
  }, [isPreview]);

  const options = {
    indexAxis: "y", // กราฟแนวนอน
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        right: 30,
        left: 10,
        top: 10,
        bottom: 10
      }
    },
    plugins: {
      legend: { display: false },
      title: {
        display: !isPreview,
        text: "อายุของอะไหล่ในคลัง (วัน)",
        font: { size: 20 },
        padding: { bottom: 25, top: 10 },
      },
      tooltip: { 
        enabled: true,
        callbacks: {
          label: function(context) {
            return `อายุคงเหลือ: ${context.raw} วัน`;
          }
        }
      },
    },
    scales: {
      x: { 
        beginAtZero: true,
        title: {
          display: !isPreview,
          text: 'จำนวนวัน',
          font: { size: 14 }
        },
        grid: { display: false }
      },
      y: {
        ticks: {
          autoSkip: false,
          font: { size: isPreview ? 10 : 12 },
          padding: 10,
        },
        grid: { drawBorder: false }
      },
    },
  };

  if (!chartData) {
    return <div style={{ textAlign: 'center', padding: '20px' }}>กำลังโหลดข้อมูล...</div>;
  }

  const chartHeight = isPreview 
    ? "200px" 
    : `${Math.max(400, chartData.labels.length * 50)}px`;

  return (
    <div style={{ height: chartHeight, width: "100%", padding: "10px 15px" }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

export default EquipmentAgeReportChart;