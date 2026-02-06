const express = require('express');
const fs = require('fs');
const path = require('path');

// Configuração das Portas
const PORT_RELATORIO = 3000;
const PORT_FORMULARIO = 3001;
const PORT_COMPARACAO = 3002;
const PORT_METAS = 3003;
const PORT_PLANOS = 3004;
const PORT_BUGS = 3005;

// Função para configurar e iniciar uma instância do Express
function startServer(port, defaultFile, saveOptions = null) {
    const app = express();

    // Middlewares
    app.use(express.json({ limit: '50mb' })); // Aumentado para suportar PDFs grandes
    app.use(express.static(__dirname));

    // Rota Raiz redireciona para o arquivo específico
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, defaultFile));
    });

    // Endpoint de Salvamento (Apenas necessário onde está o formulário)
    if (saveOptions) {
        app.post('/save-data', (req, res) => {
            const fileName = saveOptions.fileName || 'dadosPreenchimento.js';
            const varName = saveOptions.varName || 'dadosRelatorio';
            
            const fileContent = `const ${varName} = ${JSON.stringify(req.body, null, 2)};`;
            const filePath = path.join(__dirname, fileName);

            fs.writeFile(filePath, fileContent, 'utf8', (err) => {
                if (err) {
                    console.error(`Erro ao salvar o arquivo ${fileName}:`, err);
                    return res.status(500).send('Erro ao salvar o arquivo no servidor.');
                }
                console.log(`Arquivo ${fileName} atualizado com sucesso!`);
                res.send({ message: 'Arquivo atualizado com sucesso!' });
            });
        });
    }

    app.listen(port);
}

// Inicia os servidores
startServer(PORT_RELATORIO, 'relatorio-mensal.html');
startServer(PORT_FORMULARIO, 'formulario-dados.html', { fileName: 'dadosPreenchimento.js', varName: 'dadosRelatorio' }); // Habilita save-data na porta 3001
startServer(PORT_COMPARACAO, 'comparacao-mensal-visual.html');
startServer(PORT_METAS, 'metas-2026.html', { fileName: 'dadosMetas.js', varName: 'dadosMetas' }); // Habilita save-data na porta 3003
startServer(PORT_PLANOS, 'plano-acao-centers.html', { fileName: 'dadosPreenchimento.js', varName: 'dadosRelatorio' }); // Habilita save-data na porta 3004
startServer(PORT_BUGS, 'relatorio-bugs.html');

// Logs no Console
console.log('===========================================================');
console.log('🚀 Servidores Iniciados com Sucesso!');
console.log('===========================================================');
console.log(`📊 Relatório Mensal:       http://localhost:${PORT_RELATORIO}`);
console.log(`📝 Formulário de Dados:    http://localhost:${PORT_FORMULARIO}`);
console.log(`📈 Comparação Mensal:      http://localhost:${PORT_COMPARACAO}`);
console.log(`🎯 Metas & Planejamento:   http://localhost:${PORT_METAS}`);
console.log(`📋 Planos de Ação (Centers): http://localhost:${PORT_PLANOS}`);
console.log(`🐞 Relatório de Bugs:       http://localhost:${PORT_BUGS}`);
console.log('===========================================================');