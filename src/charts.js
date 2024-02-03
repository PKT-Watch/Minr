const Chart = require("chart.js");

const el = {
    cpuChartContainer: document.querySelector('#cpu-chart-container'),
    chartEncryptions: document.querySelector('#chart-encryptions'),
    chartMiningIncome: document.querySelector('#chart-mining-income'),
    chartMiningIncomeDashboard: document.querySelector('#chart-mining-income-dashboard')
}

const charts = {};
let darkModeOn = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    darkModeOn = event.matches; // ? "dark" : "light";

    updateChartCPUStyle();
    updateChartEncryptionsStyle();
    updateChartMiningIncomeStyle();
});

let chartsReadyToUse = false;
exports.chartsReady = () => {
    return chartsReadyToUse;
};

function buildChartCPU() {
    var options = {
        type: 'doughnut',
        data: {
            datasets: [{
                //label: '# of Votes',
                data: [0, 100],
                backgroundColor: darkModeOn ? ["#801eb8", "#121212"] : ["#9B2ADD", "#F7F8FA"],
                borderColor: darkModeOn ? "#121212" : "#F7F8FA"
            }]
        },
        options: {
            rotation: 0, // start angle in degrees
            circumference: 360, // sweep angle in degrees
            radius: '100%',
            cutout: '90%',
            centertext: '0%',
            events: []
        }
    }
    
    var ctx = document.getElementById('chart-cpu').getContext('2d');

    charts.cpu = new Chart(ctx, options);
}

function buildChartEncryptions() {
    const dummyData = [0, 100, 50, 60, 76, 72];
    const dummyData2 = [50, 34, 72, 65, 25, 15];

    var options = {
        type: 'line',
        data: {
            labels: dummyData,
            datasets: [{
                data: dummyData,
                backgroundColor: darkModeOn ? "#121212" : "#F7F8FA",
                borderColor: darkModeOn ? "#121212" : "#F7F8FA",
                yAxisID: 'y',
                isDummyData: true
            },
            {
                data: dummyData2,
                backgroundColor: darkModeOn ? "#121212" : "#F7F8FA",
                borderColor: darkModeOn ? "#121212" : "#F7F8FA",
                yAxisID: 'y2',
                isDummyData: true
            }]
        },
        options: {
            maintainAspectRatio: false,
            responsive: true,
            plugins: { legend: { display: false }, },
            tension: 0.4,
            scales: {
                x: {
                    ticks: {
                        display: false
                    },
                    grid: {
                        // 
                    }
                },
                y: {
                    min: 0,
                    grid: {
                        display: false
                    },
                    ticks: {
                        display: false
                    }
                },
                y2: {
                    position: 'right',
                    min: 0,
                    grid: {
                        display: false
                    },
                    ticks: {
                        display: false
                    }
                }
            },
            events: []
        }
    }
    
    var ctx = el.chartEncryptions.getContext('2d');

    charts.encryptions = new Chart(ctx, options);
}

function buildChartMiningIncome() {
    const dummyData = [46, 100, 50, 60, 76, 72, 100, 50, 60, 76, 72, 100, 50, 60, 76, 72, 100, 50, 60, 76, 72, 100, 50, 60, 76, 72, 100, 50, 60, 76, 72];

    var options = {
        type: 'bar',
        data: {
            labels: dummyData,
            datasets: [{
                data: dummyData,
                backgroundColor: darkModeOn ? "#121212" : "#F7F8FA",
                borderColor: darkModeOn ? "#121212" : "#F7F8FA",
                barPercentage: 1.0,
                categoryPercentage: 1.0
            }]
        },
        options: {
            maintainAspectRatio: false,
            responsive: true,
            plugins: { 
                legend: { display: false },
                tooltip: { 
                    enabled: false,
                    mode: 'index',
                    intersect: false
                }
            },
            animation: {
                duration: 0
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        display: false
                    }
                },
                y: {
                    min: 0,
                    grid: {
                        //
                    },
                    ticks: {
                        //
                    }
                }
            },
        }
    }
    
    var ctx = el.chartMiningIncome.getContext('2d');

    charts.miningIncome = new Chart(ctx, options);
}

exports.buildCharts = () => {
    buildChartCPU();
    buildChartEncryptions();
    buildChartMiningIncome();

    chartsReadyToUse = true;
}

exports.updateChartCPU = (cpuUsage) => {
    charts.cpu.data.datasets[0].data = [cpuUsage, 100-cpuUsage];
    charts.cpu.options.centertext = `${parseInt(cpuUsage)}%`;

    updateChartCPUStyle();

    charts.cpu.update();

    el.cpuChartContainer.dataset.value = parseInt(cpuUsage);
}
function updateChartCPUStyle() {
    charts.cpu.data.datasets[0].backgroundColor = darkModeOn ? ["#801eb8", "#121212"] : ["#9B2ADD", "#F7F8FA"];
    charts.cpu.data.datasets[0].borderColor = darkModeOn ? "#121212" : "#F7F8FA";
    charts.cpu.update();
}

exports.updateChartEncryptions = (data) => {
    if (data.encryptions.length > 1) {
        if (data.encryptions.length > 6) {
            charts.encryptions.data.labels = data.encryptions;
        }
        charts.encryptions.data.datasets[0].data = data.encryptions;
        charts.encryptions.data.datasets[0].isDummyData = false;

        charts.encryptions.data.datasets[1].data = data.upload;
        charts.encryptions.data.datasets[1].isDummyData = false;

        updateChartEncryptionsStyle();

        charts.encryptions.options.scales.y.ticks.display = true;
        charts.encryptions.options.scales.y2.ticks.display = true;

        // Add 25% to the scale so that the lines dont overlap
        let suggestedMax = Math.max.apply( Math, data.upload );
        suggestedMax = suggestedMax + (suggestedMax/4)
        charts.encryptions.options.scales.y2.suggestedMax = suggestedMax;

        charts.encryptions.update();
    } 
}
function updateChartEncryptionsStyle() {
    if (!charts.encryptions.data.datasets[0].isDummyData) {
        charts.encryptions.data.datasets[0].backgroundColor = darkModeOn ? "#801eb8" : "#9B2ADD";
        charts.encryptions.data.datasets[0].borderColor = 'rgba(155, 42, 221, .5)';

        charts.encryptions.data.datasets[1].backgroundColor = '#39B4F3';
        charts.encryptions.data.datasets[1].borderColor = 'rgba(57, 180, 243, .5)';
    } else {
        charts.encryptions.data.datasets[0].backgroundColor = darkModeOn ? "#121212" : "#F7F8FA";
        charts.encryptions.data.datasets[0].borderColor = darkModeOn ? "#121212" : "#F7F8FA";

        charts.encryptions.data.datasets[1].backgroundColor = darkModeOn ? "#121212" : "#F7F8FA";
        charts.encryptions.data.datasets[1].borderColor = darkModeOn ? "#121212" : "#F7F8FA";
    }

    charts.encryptions.update();
}

exports.updateChartMiningIncome = (data, dates) => {
    charts.miningIncome.data.datasets[0].data = data;
    charts.miningIncome.data.labels = dates;
    charts.miningIncome.options.plugins.tooltip.enabled = true;
    updateChartMiningIncomeStyle();
    charts.miningIncome.update();
}

function updateChartMiningIncomeStyle() {
    charts.miningIncome.data.datasets[0].backgroundColor = darkModeOn ? "rgba(155, 42, 221, .5)" : "#9B2ADD";
    charts.miningIncome.update();
}