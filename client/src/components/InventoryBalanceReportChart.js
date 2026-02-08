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

function InventoryBalanceReportChart({ isPreview = false }) {
  const [chartData, setChartData] = useState(null); 

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/inventoryBalanceReportChart`)
      .then((res) => res.json())
      .then((data) => {
      if (!Array.isArray(data)) return;
      const sorted = data.sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
      const finalData = isPreview ? sorted.slice(0, 5) : sorted;
      setChartData({
          labels: finalData.map((item) => item.equipment_name),
          datasets: [
            {
              label: "จำนวนคงเหลือ",
              data: finalData.map((item) => Number(item.quantity || 0)),
              backgroundColor: finalData.map((item) =>
                getBarColor(item.quantity, item.alert_quantity)
              ),
              borderRadius: 5,
              barThickness: isPreview ? 20 : 30
            },
          ],
        });
      })
      .catch(err => console.error("Fetch error:", err));
  }, [isPreview]);

  const getBarColor = (current_quantity, alert_quantity) => {
    const qty = Number(current_quantity);
    const alert = Number(alert_quantity || 0);

    if (qty > alert) return "#2E7D32";
    if (qty > alert / 2) return "#FB8C00";
    return "#D32F2F";
  };

  const options = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, 
      },
      title: {
        display: !isPreview, 
        text: "รายงานปริมาณคงเหลือสินค้า",
        font: { size: 20 },
        padding: { bottom: 20 },
      },
      tooltip: {
        enabled: !isPreview, 
      },
    },
    scales: {
      x: {
        display: !isPreview, 
        beginAtZero: true,
      },
      y: {
        ticks: {
          autoSkip: false,
          font: { size: isPreview ? 10 : 12 } 
        },
        grid: {
          display: false,
        }
      },
    },
    
    events: isPreview ? [] : ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
  };
  if (!chartData) {
    return <div style={{ textAlign: 'center', padding: '20px' }}>กำลังโหลดข้อมูล...</div>;
  }

  const chartHeight = isPreview 
    ? "200px" 
    : `${Math.max(400, chartData.labels.length * 40)}px`;

  return (
    <div style={{ height: chartHeight, width: "100%", paddingRight: "10px" }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

export default InventoryBalanceReportChart;