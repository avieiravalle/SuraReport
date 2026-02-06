/**
 * utils.js - Funções utilitárias compartilhadas para cálculos de métricas de QA.
 */

/**
 * Calcula a porcentagem de cobertura de testes com base no número de User Stories e Execuções.
 * Meta: Configurável (padrão 4) casos de teste por User Story.
 */
function calculateTestCoverage(usCount, executedCount, targetDensity = 4) {
    if (!usCount || usCount === 0) return 0;
    const targetTestCases = usCount * targetDensity;
    const coverage = targetTestCases > 0 
        ? Math.round((executedCount / targetTestCases) * 100)
        : 0;
    return Math.min(100, coverage);
}

/**
 * Calcula a cobertura de testes consolidada do mês (Execução vs Meta).
 */
function getMonthTestCoverage(centerData, targetDensity = 4) {
    if (!centerData) return 0;
    const s1 = centerData.sprint1 || {};
    const s2 = centerData.sprint2 || {};
    const totalUS = (s1.usSprint || 0) + (s2.usSprint || 0);
    
    const getExec = (s) => {
        if (s.listaUserStories && s.listaUserStories.length > 0) {
            return s.listaUserStories.reduce((acc, us) => {
                const passed = (us.passed !== undefined && us.passed !== null && us.passed !== '') ? Number(us.passed) : 0;
                const failed = (us.failed !== undefined && us.failed !== null && us.failed !== '') ? Number(us.failed) : 0;
                return acc + passed + failed;
            }, 0);
        }
        return s.ctExecutados || 0;
    };

    const totalExecuted = getExec(s1) + getExec(s2);
    return calculateTestCoverage(totalUS, totalExecuted, targetDensity);
}

/**
 * Calcula a média de cobertura de código para uma sprint.
 */
function getSprintAverageCodeCoverage(sprintData) {
    if (!sprintData || !sprintData.coberturaCodigo) return 0;
    const coverage = sprintData.coberturaCodigo;
    const values = [coverage.linhas, coverage.classes, coverage.metodos, coverage.branches];
    const validValues = values.filter(v => typeof v === 'number');
    if (validValues.length === 0) return 0;
    return validValues.reduce((a, b) => a + b, 0) / validValues.length;
}

/**
 * Retorna o total de bugs não produtivos de uma sprint.
 */
function getSprintTotalNonProdBugs(sprintData) {
    if (!sprintData || !sprintData.bugsNaoProdutivos) {
        return 0;
    }
    const bugs = sprintData.bugsNaoProdutivos;
    // Nova estrutura (array de objetos)
    if (Array.isArray(bugs)) {
        return bugs.length;
    }
    // Estrutura antiga (objeto com contagens)
    return (bugs.baixa || 0) + (bugs.media || 0) + (bugs.alta || 0);
}

/**
 * Retorna o total numérico de bugs de produção.
 */
function getTotalProductionBugs(centerData) {
    if (!centerData) return 0;

    const countBugs = (bugs) => {
        if (!bugs) return 0;
        // Nova estrutura (array de objetos)
        if (Array.isArray(bugs)) {
            return bugs.length;
        }
        // Estrutura antiga (objeto com contagens)
        return (bugs.baixa || 0) + (bugs.media || 0) + (bugs.alta || 0);
    };

    const s1_bugs = centerData.sprint1?.bugsProducao;
    const s2_bugs = centerData.sprint2?.bugsProducao;

    return countBugs(s1_bugs) + countBugs(s2_bugs);
}

/**
 * Formata o nome do produto para exibição correta na interface.
 * Centraliza a regra de negócio para nomes como 'Integracoes'.
 */
function formatProductName(name) {
    return name === 'Integracoes' ? 'Integrações' : name;
}