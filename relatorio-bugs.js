// --- Estado da Aplicação ---
const appState = {
    currentMonth: '',
    currentCenter: '',
};

// --- Constantes e Configurações ---
const METRIC_TARGETS = {
    bugsNaoProdutivos: {
        baixa: { value: 5, higherIsBetter: false },
        media: { value: 3, higherIsBetter: false },
        alta: { value: 1, higherIsBetter: false },
        total: { value: 10, higherIsBetter: false }
    },
    bugsProducao: {
        baixa: { value: 5, higherIsBetter: false },
        media: { value: 2, higherIsBetter: false },
        alta: { value: 0, higherIsBetter: false },
        total: { value: 2, higherIsBetter: false }
    }
};

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', function() {
    updateMetricTargets();
    initializeControls();
    document.getElementById('back-btn').addEventListener('click', () => {
        window.location.href = 'relatorio-mensal.html';
    });
    updateReport();
});

function updateMetricTargets() {
    if (typeof dadosRelatorio === 'undefined' || !dadosRelatorio.metas) return;
    const metas = dadosRelatorio.metas;
    const setVal = (obj, key, val) => { if (obj && obj[key]) obj[key].value = val; };

    if (metas.bugsNaoProdutivos) {
        setVal(METRIC_TARGETS.bugsNaoProdutivos, 'baixa', metas.bugsNaoProdutivos.baixa);
        setVal(METRIC_TARGETS.bugsNaoProdutivos, 'media', metas.bugsNaoProdutivos.media);
        setVal(METRIC_TARGETS.bugsNaoProdutivos, 'alta', metas.bugsNaoProdutivos.alta);
        setVal(METRIC_TARGETS.bugsNaoProdutivos, 'total', metas.bugsNaoProdutivos.total);
    }

    if (metas.bugsProducao) {
        setVal(METRIC_TARGETS.bugsProducao, 'baixa', metas.bugsProducao.baixa);
        setVal(METRIC_TARGETS.bugsProducao, 'media', metas.bugsProducao.media);
        setVal(METRIC_TARGETS.bugsProducao, 'alta', metas.bugsProducao.alta);
        setVal(METRIC_TARGETS.bugsProducao, 'total', metas.bugsProducao.total);
    }
}

function initializeControls() {
    const monthSelect = document.getElementById('month-select');
    const productSelect = document.getElementById('product-select');

    const months = Object.keys(dadosRelatorio).filter(k => /^\d{4}-\d{2}$/.test(k)).sort().reverse();
    if (months.length === 0) {
        showDataError();
        return;
    }
    monthSelect.innerHTML = '';
    months.forEach(monthKey => {
        const date = new Date(monthKey);
        const monthName = date.toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' });
        const year = date.getFullYear();
        const option = document.createElement('option');
        option.value = monthKey;
        option.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
        monthSelect.appendChild(option);
    });

    const allProducts = new Set();
    Object.keys(dadosRelatorio).forEach(monthKey => {
        if (!/^\d{4}-\d{2}$/.test(monthKey)) return;
        Object.keys(dadosRelatorio[monthKey]).forEach(product => allProducts.add(product));
    });
    const productList = Array.from(allProducts).sort();

    productSelect.innerHTML = '';
    productList.forEach(productKey => {
        const option = document.createElement('option');
        option.value = productKey;
        option.textContent = formatProductName(productKey);
        productSelect.appendChild(option);
    });

    appState.currentMonth = months[0];
    appState.currentCenter = productList.includes('Policy') ? 'Policy' : productList[0];
    monthSelect.value = appState.currentMonth;
    productSelect.value = appState.currentCenter;

    monthSelect.addEventListener('change', function() { appState.currentMonth = this.value; updateReport(); });
    productSelect.addEventListener('change', function() { appState.currentCenter = this.value; updateReport(); });
}

// --- Funções Principais de Atualização da UI ---

function updateReport() {
    if (!dadosRelatorio?.[appState.currentMonth]?.[appState.currentCenter]) {
        showDataError();
        return;
    }
    const centerData = dadosRelatorio[appState.currentMonth][appState.currentCenter];

    updateReportDate();
    updateBugsBySprint(centerData);
}

function showDataError() {
    const errorMessageHTML = '<p style="color: var(--tertiary-color); text-align: center;">Dados não disponíveis para a seleção atual.</p>';
    const contentIds = ['sprint1-escaped-bugs-content', 'sprint1-internal-bugs-content', 'sprint2-escaped-bugs-content', 'sprint2-internal-bugs-content'];
    contentIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.innerHTML = errorMessageHTML;
    });
}

function updateReportDate() {
    const date = new Date(appState.currentMonth);
    const monthName = date.toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' });
    const year = date.getFullYear();
    document.getElementById('report-date').textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
}

function updateBugsBySprint(centerData) {
    const { sprint1, sprint2 } = centerData;

    // Atualiza os títulos das colunas com os nomes das sprints
    document.getElementById('sprint1-header').textContent = sprint1?.nome || 'Sprint 1';
    document.getElementById('sprint2-header').textContent = sprint2?.nome || 'Sprint 2';

    // Preenche os dados da Sprint 1
    const s1ProdBugs = sprint1?.bugsProducao || [];
    const s1InternalBugs = sprint1?.bugsNaoProdutivos || [];
    
    document.getElementById('sprint1-escaped-bugs-content').replaceChildren(
        generateBugsTableHTML(s1ProdBugs, METRIC_TARGETS.bugsProducao, true)
    );
    document.getElementById('sprint1-internal-bugs-content').replaceChildren(
        generateBugsTableHTML(s1InternalBugs, METRIC_TARGETS.bugsNaoProdutivos, true, 'internos')
    );

    // Preenche os dados da Sprint 2
    const s2ProdBugs = sprint2?.bugsProducao || [];
    const s2InternalBugs = sprint2?.bugsNaoProdutivos || [];

    document.getElementById('sprint2-escaped-bugs-content').replaceChildren(
        generateBugsTableHTML(s2ProdBugs, METRIC_TARGETS.bugsProducao, true)
    );
    document.getElementById('sprint2-internal-bugs-content').replaceChildren(
        generateBugsTableHTML(s2InternalBugs, METRIC_TARGETS.bugsNaoProdutivos, true)
    );
}

// --- Funções de Geração de HTML ---

function generateBugsTableHTML(bugsData, targets, isSprintView = false, type = 'prod') {
    if (!bugsData || bugsData.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'Nenhum bug registrado para esta sprint.';
        p.style.textAlign = 'center';
        return p;
    }

    const table = createTable(['ID', 'Descrição', 'Criticidade'], []);
    const tbody = table.querySelector('tbody');
    const counts = { alta: 0, media: 0, baixa: 0 };

    bugsData.forEach(bug => {
        const row = tbody.insertRow();
        row.insertCell().textContent = bug.id || '-';
        row.insertCell().textContent = bug.descricao || '-';
        const critCell = row.insertCell();
        const criticidade = bug.criticidade ? bug.criticidade.charAt(0).toUpperCase() + bug.criticidade.slice(1) : '-';
        critCell.textContent = criticidade;

        if (bug.criticidade === 'alta') {
            critCell.className = 'negative';
        }
        if (bug.criticidade) counts[bug.criticidade.toLowerCase()]++;
    });
    
    // Adiciona linha de total
    const tfoot = table.createTFoot();
    const totalRow = tfoot.insertRow();
    totalRow.className = 'total-row';
    totalRow.insertCell().textContent = 'Total';

    const totalValueCell = totalRow.insertCell();
    totalValueCell.colSpan = 2;
    totalValueCell.textContent = `${bugsData.length} bugs (Alta: ${counts.alta}, Média: ${counts.media}, Baixa: ${counts.baixa})`;

    // Se for visão de sprint, a meta do total é metade da meta mensal.
    const totalTarget = isSprintView ? Math.ceil(targets.total.value / 2) : targets.total.value;

    if (bugsData.length > totalTarget) {
        totalValueCell.className = 'negative';
    }

    return table;
}

// --- Funções Utilitárias ---

function createMetricRow(label, value, unit, targetConfig) {
    const row = document.createElement('tr');
    row.insertCell().textContent = label;
    const valueCell = row.insertCell();
    valueCell.textContent = `${value.toLocaleString('pt-BR')}${unit}`;
    row.insertCell().textContent = (targetConfig) ? `${targetConfig.value.toLocaleString('pt-BR')}${unit}` : '-';
 
    if (targetConfig && !targetConfig.higherIsBetter && value > targetConfig.value) {
        valueCell.className = 'negative';
    }
    return row;
}

function createTable(headers, rows) {
    const table = document.createElement('table');
    table.className = 'data-table';
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    headers.forEach(headerText => headerRow.insertCell().outerHTML = `<th>${headerText}</th>`);
    const tbody = table.createTBody();
    rows.forEach(row => tbody.appendChild(row));
    return table;
}