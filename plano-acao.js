document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('centers-grid');
    const saveBtn = document.getElementById('save-all-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    
    // Estado local dos dados
    let currentData = structuredClone(dadosRelatorio);

    // Inicialização
    loadCenters();

    // Event Listeners
    saveBtn.addEventListener('click', saveAllData);
    if (exportPdfBtn) exportPdfBtn.addEventListener('click', exportToPDF);

    function loadCenters() {
        gridContainer.innerHTML = '';

        // Identificar todos os centers únicos e meses disponíveis
        const allCenters = new Set();
        const months = Object.keys(currentData).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
        
        months.forEach(m => {
            Object.keys(currentData[m]).forEach(c => allCenters.add(c));
        });

        const sortedCenters = Array.from(allCenters).sort();

        sortedCenters.forEach(centerKey => {
            const stats = calculateCenterStats(centerKey, months);
            const card = createCenterCard(centerKey, stats);
            gridContainer.appendChild(card);
        });
    }

    function calculateCenterStats(centerKey, months) {
        let totalCov = 0, countCov = 0;
        let totalPass = 0, countPass = 0;
        let totalBugsProd = 0;
        let totalBugsNonProd = 0;
        let totalAuto = 0;
        let totalUS = 0;
        let totalCTs = 0;
        let latestPlan = '';
        let latestMonth = '';
        let monthsWithData = 0;
        const monthlyHistory = [];

        months.forEach(month => {
            const data = currentData[month][centerKey];
            if (!data) return;

            monthsWithData++;
            latestMonth = month; // Assumindo ordem cronológica em 'months'
            if (data.planoDeAcao) latestPlan = data.planoDeAcao;

            const s1 = data.sprint1 || {};
            const s2 = data.sprint2 || {};

            // --- Coleta de dados para Média Geral ---
            const cov1 = getSprintAverageCodeCoverage(s1);
            const cov2 = getSprintAverageCodeCoverage(s2);
            if (s1.coberturaCodigo) { totalCov += cov1; countCov++; }
            if (s2.coberturaCodigo) { totalCov += cov2; countCov++; }

            if (s1.passRate !== undefined) { totalPass += s1.passRate; countPass++; }
            if (s2.passRate !== undefined) { totalPass += s2.passRate; countPass++; }

            const mBugsProd = getTotalProductionBugs(data);
            const mBugsNonProd = (getSprintTotalNonProdBugs(s1) + getSprintTotalNonProdBugs(s2));
            totalBugsProd += mBugsProd;
            totalBugsNonProd += mBugsNonProd;

            const mAuto = (s1.testesAutomatizados?.cenarios || 0) + (s2.testesAutomatizados?.cenarios || 0);
            totalAuto += mAuto;

            const mUS = (s1.usSprint || 0) + (s2.usSprint || 0);
            const mCTs = (s1.casosTestePorUs || 0) + (s2.casosTestePorUs || 0);
            totalUS += mUS;
            totalCTs += mCTs;

            // --- Coleta de dados para Tendência (Mês Atual) ---
            // Calcula a média/total específica deste mês para comparar com o anterior
            let monthCov = 0, monthCovCount = 0;
            if (s1.coberturaCodigo) { monthCov += cov1; monthCovCount++; }
            if (s2.coberturaCodigo) { monthCov += cov2; monthCovCount++; }
            
            let monthPass = 0, monthPassCount = 0;
            if (s1.passRate !== undefined) { monthPass += s1.passRate; monthPassCount++; }
            if (s2.passRate !== undefined) { monthPass += s2.passRate; monthPassCount++; }

            monthlyHistory.push({
                cov: monthCovCount > 0 ? monthCov / monthCovCount : 0,
                pass: monthPassCount > 0 ? monthPass / monthPassCount : 0,
                bugsTotal: mBugsProd + mBugsNonProd,
                auto: mAuto,
                density: mUS > 0 ? mCTs / mUS : 0
            });
        });

        // Médias
        const avgCov = countCov > 0 ? Math.round(totalCov / countCov) : 0;
        const avgPass = countPass > 0 ? Math.round(totalPass / countPass) : 0;
        const avgBugsProd = monthsWithData > 0 ? Math.round(totalBugsProd / monthsWithData) : 0;
        const avgBugsNonProd = monthsWithData > 0 ? Math.round(totalBugsNonProd / monthsWithData) : 0;
        const avgAuto = monthsWithData > 0 ? Math.round(totalAuto / monthsWithData) : 0;
        const density = totalUS > 0 ? Math.round(totalCTs / totalUS) : 0;

        // Cálculo de Tendência (Último vs Penúltimo)
        const curr = monthlyHistory[monthlyHistory.length - 1] || {};
        const prev = monthlyHistory[monthlyHistory.length - 2] || {};

        const getTrendHtml = (currVal, prevVal, higherIsBetter) => {
            if (currVal === undefined || prevVal === undefined) return '';
            const diff = currVal - prevVal;
            if (Math.abs(diff) < 0.01) return '<span title="Estável" style="color:#ccc;font-size:0.8em;margin-left:3px">→</span>';
            
            const isGood = higherIsBetter ? diff > 0 : diff < 0;
            const arrow = diff > 0 ? '↑' : '↓';
            const color = isGood ? 'var(--secondary-color)' : 'var(--tertiary-color)';
            return `<span title="${isGood ? 'Melhoria' : 'Piora'} vs Mês Anterior" style="color:${color};font-weight:bold;font-size:0.8em;margin-left:3px">${arrow}</span>`;
        };

        const trends = {
            cov: getTrendHtml(curr.cov, prev.cov, true),
            pass: getTrendHtml(curr.pass, prev.pass, true),
            bugs: getTrendHtml(curr.bugsTotal, prev.bugsTotal, false), // Menos bugs é melhor
            auto: getTrendHtml(curr.auto, prev.auto, true),
            density: getTrendHtml(curr.density, prev.density, true)
        };

        return {
            avgCov, avgPass, avgBugsProd, avgBugsNonProd, avgAuto, density, latestPlan, latestMonth, trends
        };
    }

    function createCenterCard(centerKey, stats) {
        const card = document.createElement('div');
        card.className = 'center-card';

        const densityTarget = currentData.metas?.densidadeTestes || 4;

        card.innerHTML = `
            <div class="center-header">
                <h2>${formatProductName(centerKey)}</h2>
                <span style="font-size: 0.8em; color: #666;">(Médias Históricas)</span>
            </div>
            
            <div class="metrics-summary">
                <div class="metric-item">
                    <span class="metric-label">Cobertura (Méd)</span>
                    <span class="metric-value ${stats.avgCov < 50 ? 'bad' : 'good'}">${stats.avgCov}% ${stats.trends.cov}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Pass Rate (Méd)</span>
                    <span class="metric-value ${stats.avgPass < 90 ? 'bad' : 'good'}">${stats.avgPass}% ${stats.trends.pass}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Bugs/Mês (P/NP)</span>
                    <span class="metric-value ${stats.avgBugsProd > 0 ? 'bad' : 'good'}">${stats.avgBugsProd} / ${stats.avgBugsNonProd} ${stats.trends.bugs}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Auto/Mês</span>
                    <span class="metric-value ${stats.avgAuto > 0 ? 'good' : 'bad'}">+${stats.avgAuto} ${stats.trends.auto}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Densidade</span>
                    <span class="metric-value ${stats.density >= densityTarget ? 'good' : 'bad'}">${stats.density} ${stats.trends.density}</span>
                </div>
            </div>

            <label style="font-size: 0.9rem; font-weight: bold; margin-bottom: 5px;">Plano de Ação (Último Mês):</label>
            <textarea data-center="${centerKey}" data-month="${stats.latestMonth}" placeholder="Descreva as ações para corrigir métricas abaixo da meta ou observações gerais...">${stats.latestPlan}</textarea>
        `;

        // Listener para atualizar o objeto local ao digitar
        const textarea = card.querySelector('textarea');
        textarea.addEventListener('input', (e) => {
            const month = e.target.dataset.month;
            if (currentData[month] && currentData[month][centerKey]) {
                currentData[month][centerKey].planoDeAcao = e.target.value;
            }
        });

        return card;
    }

    async function saveAllData() {
        // Atualiza o objeto global com os dados da sessão atual
        // (Embora o listener 'input' já faça isso, é bom garantir)
        const textareas = document.querySelectorAll('textarea[data-center]');
        textareas.forEach(ta => {
            const center = ta.dataset.center;
            const month = ta.dataset.month;
            if (month && currentData[month] && currentData[month][center]) {
                currentData[month][center].planoDeAcao = ta.value;
            }
        });

        try {
            const response = await fetch('/save-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentData)
            });

            if (response.ok) {
                showToast();
            } else {
                alert('Erro ao salvar dados no servidor.');
            }
        } catch (error) {
            console.error(error);
            alert('Erro de conexão ao tentar salvar.');
        }
    }

    function showToast() {
        const toast = document.getElementById('toast');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    async function exportToPDF() {
        if (!window.jspdf || !window.html2canvas) {
            alert('Bibliotecas PDF não carregadas.');
            return;
        }

        const originalText = exportPdfBtn.textContent;
        exportPdfBtn.textContent = 'Gerando...';
        exportPdfBtn.disabled = true;

        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            let yOffset = margin;

            // Título
            pdf.setFontSize(16);
            pdf.setTextColor(0, 51, 160);
            pdf.text("Planos de Ação por Center (Médias Históricas)", pageWidth / 2, yOffset, { align: 'center' });
            yOffset += 15;

            const cards = document.querySelectorAll('.center-card');
            
            for (const card of cards) {
                const canvas = await html2canvas(card, { 
                    scale: 1.5, 
                    useCORS: true, 
                    logging: false,
                    backgroundColor: '#ffffff'
                });
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = pageWidth - (margin * 2);
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                if (yOffset + imgHeight > pageHeight - margin) {
                    pdf.addPage();
                    yOffset = margin;
                }

                pdf.addImage(imgData, 'PNG', margin, yOffset, imgWidth, imgHeight);
                yOffset += imgHeight + 10;
            }

            pdf.save('Planos_de_Acao_Centers.pdf');
        } catch (error) {
            console.error(error);
            alert('Erro ao gerar PDF.');
        } finally {
            exportPdfBtn.textContent = originalText;
            exportPdfBtn.disabled = false;
        }
    }
});