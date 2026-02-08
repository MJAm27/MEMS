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

function EquipmentUsageReportChart({ isPreview = false }) {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    
    fetch(`${process.env.REACT_APP_API_URL}/api/reports/equipment-usage`)
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        
        const sorted = data.sort((a, b) => (b.total_usage || 0) - (a.total_usage || 0));
        const finalData = isPreview ? sorted.slice(0, 5) : sorted;

        setChartData({
          labels: finalData.map((item) => item.equipment_name),
          datasets: [
            {
              label: "จำนวนที่ถูกเบิก",
              data: finalData.map((item) => Number(item.total_usage || 0)),
              backgroundColor: "#42A5F5", 
              borderRadius: 5,
              barThickness: isPreview ? 20 : 35,
            },
          ],
        });
      })
      .catch((err) => console.error("Error fetching usage data:", err));
  }, [isPreview]);

  const options = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: !isPreview,
        text: "รายงานการใช้อะไหล่",
        font: { size: 20 },
        padding : {bottom: 25, top: 10},
      },
      tooltip: { enabled: true },
    },
    scales: {
      x: { beginAtZero: true },
      y: {
        ticks: {
          autoSkip: false,
          font: { size: isPreview ? 10 : 12 },
          padding: 10,
        },
        grid: {
          display: false, 
        }
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
      <div style={{ height: chartHeight, width: "100%", paddingRight: "10px" }}>
        <Bar data={chartData} options={options} />
      </div>
    );
}

export default EquipmentUsageReportChart;