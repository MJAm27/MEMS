import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

function InventoryBalanceReportChart() {
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/inventoryBalanceReportChart`)
      .then((res) => res.json())
      .then((data) => setChartData(data));
  }, []);

  const data = {
    labels: chartData.map((i) => i.name),
    datasets: [
      {
        label: "Current Quantity",
        data: chartData.map((i) => i.quantity),
        backgroundColor: "#FFB300",
      },
    ],
  };

  const options = {
    indexAxis: "y",
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: "Inventory Balance",
        font: { size: 18 }
      },
    },
    scales: {
      x: {
        beginAtZero: true,
      },
      y: {
        ticks: { autoSkip: false }
      }
    }
  };

//   useEffect(() => {
//   fetch(`${process.env.REACT_APP_API_URL}/api/inventoryBalanceReportChart`)
//     .then((res) => res.json())
//     .then((data) => {
//       console.log("chart data =", data);   // <<<<< สำคัญ
//       setChartData(data);
//     });
// }, []);


  return (
    <div style={{ width: "100%", padding: 20 }}>
      <Bar data={data} options={options} />
    </div>
  );
}


export default InventoryBalanceReportChart;
