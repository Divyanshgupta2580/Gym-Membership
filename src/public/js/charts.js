window.GymflowCharts = {
  theme: {
    textColor: '#94a3b8',
    gridColor: '#1e293b',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },

  renderAttendanceTrend(canvasId, trendData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || typeof Chart === 'undefined') return;

    const labels = trendData.map((d) => d.dateString.slice(5)); // MM-DD
    const values = trendData.map((d) => d.count);

    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Daily Check-ins',
            data: values,
            backgroundColor: '#10b981',
            borderRadius: 4,
            maxBarThickness: 32
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: '#334155',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: this.theme.textColor, font: { family: this.theme.fontFamily } }
          },
          y: {
            beginAtZero: true,
            grid: { color: this.theme.gridColor },
            ticks: {
              color: this.theme.textColor,
              stepSize: 1,
              font: { family: this.theme.fontFamily }
            }
          }
        }
      }
    });
  },

  renderWeightProgress(canvasId, weightLogs, unit = 'kg') {
    const ctx = document.getElementById(canvasId);
    if (!ctx || typeof Chart === 'undefined') return;

    const labels = weightLogs.map((w) => w.dateString);
    const values = weightLogs.map((w) => w.weight);

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: `Body Weight (${unit})`,
            data: values,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#3b82f6',
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: '#334155',
            borderWidth: 1,
            callbacks: {
              label: (context) => `${context.parsed.y} ${unit}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: this.theme.gridColor },
            ticks: { color: this.theme.textColor, font: { family: this.theme.fontFamily } }
          },
          y: {
            grid: { color: this.theme.gridColor },
            ticks: { color: this.theme.textColor, font: { family: this.theme.fontFamily } }
          }
        }
      }
    });
  }
};
