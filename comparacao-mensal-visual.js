// --- Global State ---
const appState = {
    selectedProduct: '',
    selectedPeriod: '12',
    chartInstances: {}
};

// --- Constantes e Configurações ---
const METRIC_TARGETS = {
    coberturaCodigo: { value: 50, higherIsBetter: true }, // Média
    passRate: { value: 90, higherIsBetter: true },
    densidadeTestes: { value: 4, higherIsBetter: true },
    coberturaTestesPercentual: { value: 100, higherIsBetter: true },
    bugsNaoProdutivos: { total: { value: 10, higherIsBetter: false } },
    bugsProducao: { total: { value: 2, higherIsBetter: false } },
    automacao: { cenariosNovos: { value: 5, higherIsBetter: true } }
};

// --- Chart.js Global Config ---
Chart.register(ChartDataLabels);
Chart.defaults.plugins.datalabels.display = false;
Chart.defaults.font.family = 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    updateMetricTargets();
    initializeControls();
    updateDashboard();
});

function updateMetricTargets() {
    if (typeof dadosRelatorio === 'undefined' || !dadosRelatorio.metas) return;
    const metas = dadosRelatorio.metas;
    const setVal = (obj, key, val) => { if (obj && obj[key]) obj[key].value = val; };

    if (metas.coberturaCodigo) METRIC_TARGETS.coberturaCodigo.value = metas.coberturaCodigo.geral || 50;
    if (metas.passRate !== undefined) METRIC_TARGETS.passRate.value = metas.passRate;
    if (metas.densidadeTestes !== undefined) METRIC_TARGETS.densidadeTestes.value = metas.densidadeTestes;
    if (metas.coberturaTestesPercentual !== undefined) METRIC_TARGETS.coberturaTestesPercentual.value = metas.coberturaTestesPercentual;
    if (metas.bugsNaoProdutivos) METRIC_TARGETS.bugsNaoProdutivos.total.value = metas.bugsNaoProdutivos.total;
    if (metas.bugsProducao) METRIC_TARGETS.bugsProducao.total.value = metas.bugsProducao.total;
    if (metas.automacao && metas.automacao.cenariosNovos !== undefined) {
        METRIC_TARGETS.automacao.cenariosNovos.value = metas.automacao.cenariosNovos;
    }
}

// --- Control Initialization ---
function initializeControls() {
    const productSelect = document.getElementById('product-select');
    const periodSelect = document.getElementById('period-select');
    const returnBtn = document.getElementById('return-btn');
    const savePdfBtn = document.getElementById('save-pdf-btn');

    const allProducts = new Set();
    Object.keys(dadosRelatorio).forEach(monthKey => {
        if (!/^\d{4}-\d{2}$/.test(monthKey)) return;
        Object.keys(dadosRelatorio[monthKey]).forEach(product => allProducts.add(product));
    });
    const productList = Array.from(allProducts).sort();
    
    productSelect.innerHTML = '';
    productList.forEach(productKey => {
        const option = new Option(formatProductName(productKey), productKey);
        productSelect.appendChild(option);
    });

    appState.selectedProduct = productList.includes('Policy') ? 'Policy' : (productList[0] || '');
    productSelect.value = appState.selectedProduct;
    periodSelect.value = appState.selectedPeriod;

    productSelect.addEventListener('change', (e) => { appState.selectedProduct = e.target.value; updateDashboard(); });
    periodSelect.addEventListener('change', (e) => { appState.selectedPeriod = e.target.value; updateDashboard(); });
    returnBtn.addEventListener('click', () => window.location.href = 'relatorio-mensal.html');
    savePdfBtn.addEventListener('click', () => alert('Função de salvar PDF não implementada para esta página.'));
}

// --- Main Update Function ---
function updateDashboard() {
    if (!appState.selectedProduct) return;
    const processedData = processDataForProduct(appState.selectedProduct, appState.selectedPeriod);
    
    updateSummaryCards(processedData);
    updateTrendTable(processedData);
    createAllCharts(processedData);
}

// --- Data Processing ---
function processDataForProduct(product, period) {
    const allMonths = Object.keys(dadosRelatorio).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    
    let monthsToShow;
    if (period === 'all') {
        monthsToShow = allMonths;
    } else {
        const numMonths = parseInt(period, 10);
        monthsToShow = allMonths.slice(-numMonths);
    }

    const labels = monthsToShow.map(month => {
        const [year, monthNum] = month.split('-');
        return new Date(year, monthNum - 1).toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
    });

    const monthlyData = monthsToShow.map(month => dadosRelatorio[month]?.[product] || {});

    return { labels, months: monthsToShow, monthlyData };
}

// --- UI Update Functions ---
function updateSummaryCards(data) {
    const latestData = data.monthlyData[data.monthlyData.length - 1] || {};
    if (Object.keys(latestData).length === 0) return; // No data for latest month

    const { sprint1 = {}, sprint2 = {} } = latestData;

    const passRate1 = sprint1.passRate || 0;
    const passRate2 = sprint2.passRate || 0;
    const avgPassRate = (passRate1 > 0 && passRate2 > 0) ? (passRate1 + passRate2) / 2 : (passRate1 || passRate2);
    document.getElementById('pass-rate-value').textContent = `${avgPassRate.toFixed(1)}%`;

    const testCoverage = getMonthTestCoverage(latestData, dadosRelatorio.metas?.densidadeTestes || 4);
    document.getElementById('test-coverage-value').textContent = `${testCoverage.toFixed(1)}%`;

    const cov1 = getSprintAverageCodeCoverage(sprint1);
    const cov2 = getSprintAverageCodeCoverage(sprint2);
    const avgCodeCoverage = (cov1 > 0 && cov2 > 0) ? (cov1 + cov2) / 2 : (cov1 || cov2);
    document.getElementById('coverage-value').textContent = `${avgCodeCoverage.toFixed(1)}%`;
}

function updateTrendTable(data) {
    const tableBody = document.getElementById('trend-table-body');
    tableBody.innerHTML = '';

    const currentData = data.monthlyData[data.monthlyData.length - 1] || {};
    const previousData = data.monthlyData[data.monthlyData.length - 2] || {};

    const metricsConfig = [
        { 
            label: 'Pass Rate', unit: '%', target: METRIC_TARGETS.passRate,
            getValue: (d) => {
                if (!d || !d.sprint1) return 0;
                const pr1 = d.sprint1.passRate || 0;
                const pr2 = d.sprint2?.passRate || 0;
                return (pr1 > 0 && pr2 > 0) ? (pr1 + pr2) / 2 : (pr1 || pr2);
            }
        },
        { 
            label: 'Cobertura de Testes', unit: '%', target: { value: 90, higherIsBetter: true },
            getValue: (d) => getMonthTestCoverage(d, METRIC_TARGETS.densidadeTestes.value)
        },
        { 
            label: 'Cobertura de Código', unit: '%', target: METRIC_TARGETS.coberturaCodigo,
            getValue: (d) => {
                if (!d || !d.sprint1) return 0;
                const cov1 = getSprintAverageCodeCoverage(d.sprint1);
                const cov2 = getSprintAverageCodeCoverage(d.sprint2);
                return (cov1 > 0 && cov2 > 0) ? (cov1 + cov2) / 2 : (cov1 || cov2);
            }
        },
        { 
            label: 'Novos Cenários Autom.', unit: '', target: METRIC_TARGETS.automacao.cenariosNovos,
            getValue: (d) => {
                if (!d || !d.sprint1) return 0;
                return (d.sprint1.testesAutomatizados?.cenarios || 0) + (d.sprint2?.testesAutomatizados?.cenarios || 0);
            }
        },
    ];

    if (Object.keys(currentData).length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Dados do mês atual não disponíveis.</td></tr>';
        return;
    }

    metricsConfig.forEach(metric => {
        const currentValue = metric.getValue(currentData);
        const previousValue = metric.getValue(previousData);
        const row = document.createElement('tr');
        
        let variationText = '-';
        let variationClass = 'trend-neutral';
        if (Object.keys(previousData).length > 0) {
            if (previousValue > 0) {
                const diff = ((currentValue - previousValue) / previousValue) * 100;
                const isGood = metric.target.higherIsBetter ? diff >= 0 : diff <= 0;
                variationClass = Math.abs(diff) < 0.1 ? 'trend-neutral' : (isGood ? 'trend-positive' : 'trend-negative');
                variationText = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
            } else if (currentValue > 0) {
                variationText = 'N/A';
                variationClass = metric.target.higherIsBetter ? 'trend-positive' : 'trend-negative';
            }
        }

        const isMet = metric.target.higherIsBetter ? currentValue >= metric.target.value : currentValue <= metric.target.value;
        const statusClass = isMet ? 'badge-positive' : 'badge-negative';
        const statusText = isMet ? 'Atingida' : 'Não Atingida';
        const formatValue = (val, unit) => (unit === '') ? val.toFixed(0) : val.toFixed(1) + unit;

        row.innerHTML = `
            <td>${metric.label}</td>
            <td>${Object.keys(previousData).length > 0 ? formatValue(previousValue, metric.unit) : '-'}</td>
            <td>${formatValue(currentValue, metric.unit)}</td>
            <td class="${variationClass}">${variationText}</td>
            <td><span class="metric-badge ${statusClass}">${statusText}</span></td>
        `;
        tableBody.appendChild(row);
    });
}

function createAllCharts(data) {
    // Destrói todas as instâncias de gráficos anteriores para evitar vazamentos de memória
    Object.values(appState.chartInstances).forEach(chart => chart.destroy());
    appState.chartInstances = {};

    // Cria os novos gráficos
    createOverallHealthChart(data);
    createBugsChart(data);
    createCodeCoverageChart(data);
    createAutomatedTestsChart(data);
    createTestCasesPerUsChart(data);
}

// --- Chart Creation Functions ---

/**
 * Calcula um score de saúde (0-10) baseado nos KPIs do mês.
 * Pesos: Pass Rate (25%), Cob. Testes (25%), Cob. Código (10%), Bugs (40%)
 */
function calculateMonthlyHealthScore(monthData) {
    if (!monthData || !monthData.sprint1) return 0;

    // 1. Pass Rate (Meta 90%)
    const pr1 = monthData.sprint1.passRate || 0;
    const pr2 = monthData.sprint2?.passRate || 0;
    const avgPR = (pr1 > 0 && pr2 > 0) ? (pr1 + pr2) / 2 : (pr1 || pr2);
    const scorePR = Math.min(1, avgPR / 90);

    // 2. Cobertura de Código (Meta 50%)
    const cov1 = getSprintAverageCodeCoverage(monthData.sprint1);
    const cov2 = getSprintAverageCodeCoverage(monthData.sprint2);
    const avgCov = (cov1 > 0 && cov2 > 0) ? (cov1 + cov2) / 2 : (cov1 || cov2);
    const scoreCov = Math.min(1, avgCov / 50);

    // 3. Cobertura de Testes Funcionais (Meta 90%)
    const testCov = getMonthTestCoverage(monthData, 4);
    const scoreTestCov = Math.min(1, testCov / 90);

    // 4. Bugs (Penalidade)
    const getCount = (bugs) => Array.isArray(bugs) ? bugs.length : ((bugs?.baixa || 0) + (bugs?.media || 0) + (bugs?.alta || 0));
    const prodBugs = getCount(monthData.sprint1.bugsProducao) + getCount(monthData.sprint2?.bugsProducao);
    const nonProdBugs = getCount(monthData.sprint1.bugsNaoProdutivos) + getCount(monthData.sprint2?.bugsNaoProdutivos);
    
    const penaltyProd = Math.min(1, prodBugs / 5); // Penalidade máxima com 5 bugs de prod
    const penaltyNonProd = Math.min(1, nonProdBugs / 15); // Penalidade máxima com 15 bugs internos
    const scoreBugs = 1 - (penaltyProd * 0.9 + penaltyNonProd * 0.1); // Produção agora pesa 90% da penalidade

    // Média ponderada ajustada: Bugs agora valem 40% da nota final
    const finalScore = (scorePR * 0.25 + scoreCov * 0.1 + scoreTestCov * 0.25 + scoreBugs * 0.4) * 10;
    return parseFloat(finalScore.toFixed(1));
}

function createOverallHealthChart(data) {
    const chartId = 'overall-health-chart';
    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;

    const healthScores = data.monthlyData.map(monthData => calculateMonthlyHealthScore(monthData));

    appState.chartInstances[chartId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Índice de Qualidade (0-10)',
                data: healthScores,
                borderColor: 'rgba(0, 51, 160, 1)',
                backgroundColor: 'rgba(0, 51, 160, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Tendência Geral de Qualidade (Health Score)',
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 10,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

function createBugsChart(data) {
    const chartId = 'bugs-chart';
    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;

    if (appState.chartInstances[chartId]) {
        appState.chartInstances[chartId].destroy();
    }

    const getTotalSprintBugs = (sprint) => {
        if (!sprint) return 0;
        const getCount = (bugs) => {
            if (!bugs) return 0;
            if (Array.isArray(bugs)) return bugs.length;
            // Fallback para estrutura antiga
            return (bugs.baixa || 0) + (bugs.media || 0) + (bugs.alta || 0);
        };
        return getCount(sprint.bugsProducao) + getCount(sprint.bugsNaoProdutivos);
    };

    const bugsS1 = data.monthlyData.map(monthData => getTotalSprintBugs(monthData?.sprint1));
    const bugsS2 = data.monthlyData.map(monthData => getTotalSprintBugs(monthData?.sprint2));

    appState.chartInstances[chartId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'Bugs Sprint 1',
                    data: bugsS1,
                    backgroundColor: 'rgba(0, 167, 157, 0.7)', // Sura Green
                    borderColor: 'rgba(0, 167, 157, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Bugs Sprint 2',
                    data: bugsS2,
                    backgroundColor: 'rgba(0, 51, 160, 0.7)', // Sura Blue
                    borderColor: 'rgba(0, 51, 160, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Evolução de Bugs por Sprint',
                    font: { size: 14, weight: '600' },
                    padding: { top: 5, bottom: 15 }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                },
                legend: {
                    position: 'bottom',
                }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Quantidade de Bugs'
                    },
                    ticks: {
                        callback: function(value) { if (Number.isInteger(value)) { return value; } },
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function createCodeCoverageChart(data) {
    const chartId = 'code-coverage-chart';
    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;

    const linesData = data.monthlyData.map(d => {
        if (!d || !d.sprint1) return 0;
        const s1 = d.sprint1.coberturaCodigo?.linhas || 0;
        const s2 = d.sprint2?.coberturaCodigo?.linhas || 0;
        if (s1 > 0 && s2 > 0) return (s1 + s2) / 2;
        return s1 || s2;
    });

    const branchesData = data.monthlyData.map(d => {
        if (!d || !d.sprint1) return 0;
        const s1 = d.sprint1.coberturaCodigo?.branches || 0;
        const s2 = d.sprint2?.coberturaCodigo?.branches || 0;
        if (s1 > 0 && s2 > 0) return (s1 + s2) / 2;
        return s1 || s2;
    });

    appState.chartInstances[chartId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                { label: 'Linhas (%)', data: linesData, borderColor: 'rgba(0, 51, 160, 1)', tension: 0.1 },
                { label: 'Branches (%)', data: branchesData, borderColor: 'rgba(0, 167, 157, 1)', tension: 0.1 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Evolução da Cobertura de Código', font: { size: 14, weight: '600' } } },
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });
}

function createAutomatedTestsChart(data) {
    const chartId = 'automated-tests-chart';
    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;

    let cumulativeScenarios = 0;
    const scenariosData = data.monthlyData.map(d => {
        const s1_scenarios = d.sprint1?.testesAutomatizados?.cenarios || 0;
        const s2_scenarios = d.sprint2?.testesAutomatizados?.cenarios || 0;
        cumulativeScenarios += s1_scenarios + s2_scenarios;
        return cumulativeScenarios;
    });

    appState.chartInstances[chartId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Cenários Acumulados',
                data: scenariosData,
                borderColor: 'rgba(0, 167, 157, 1)',
                backgroundColor: 'rgba(0, 167, 157, 0.2)',
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Crescimento da Automação', font: { size: 14, weight: '600' } } },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Nº Cenários' } } }
        }
    });
}

function createTestCasesPerUsChart(data) {
    const chartId = 'test-cases-per-us-chart';
    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;

    const densityData = data.monthlyData.map(d => {
        const s1_us = d.sprint1?.usSprint || 0;
        const s1_cts = d.sprint1?.casosTestePorUs || 0;
        const s2_us = d.sprint2?.usSprint || 0;
        const s2_cts = d.sprint2?.casosTestePorUs || 0;
        const totalUs = s1_us + s2_us;
        const totalCts = s1_cts + s2_cts;
        return totalUs > 0 ? (totalCts / totalUs) : 0;
    });

    appState.chartInstances[chartId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                { label: 'Média de CTs por US', data: densityData, borderColor: '#f39c12', tension: 0.1 },
                { label: 'Meta', data: Array(data.labels.length).fill(METRIC_TARGETS.densidadeTestes.value), borderColor: '#c0392b', borderDash: [5, 5], pointRadius: 0, fill: false }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Densidade de Testes (CTs/US)', font: { size: 14, weight: '600' } } },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'CTs por US' } } }
        }
    });
}