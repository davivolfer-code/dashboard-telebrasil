let clientesData = [];
let filteredData = [];
let currentFilter = 'todos';
let searchTerm = '';
let selectedConsultor = null;
let currentUser = sessionStorage.getItem('usuario');

// --- CONTROLE DOS GRÁFICOS ---
let instanciaGraficos = { movel: null, fixa: null };

const ADMIN_USERS = ['renata', 'franciele', 'admin', 'davi', 'pedro', 'danila', 'alvaro', 'gabriela', 'ricardo',];

function hasFullAccess(username) {
    const manualAdmins = ['renata', 'franciele', 'admin', 'davi', 'pedro', 'danila', 'alvaro', 'gabriela', 'ricardo'];
    return manualAdmins.includes(username?.toLowerCase()) || IS_ADMIN_SESSION;
}

// ================== FILTROS ==================
const filtros = [
    { id: 'todos', nome: 'Todos os Clientes', filtro: () => true },
    {
        id: 'oportunidade_movel',
        nome: 'Móvel Migração',
        filtro: (c) => parseInt(c.m_movel) >= 17 && (c.situacao || '').includes('2 - ATIVA')
    },
    {
        id: 'fixa_migracao',
        nome: 'Fixa & Fibra',
        filtro: (c) => parseInt(c.m_fixa) >= 7 && (c.situacao || '').includes('2 - ATIVA')
    },
    {
        id: 'clientes_vivotech',
        nome: 'Gestão Vivo Tech',
        filtro: (c) => {
            const data = String(c.data_fim_vtech || '').trim();
            return data !== "" && data !== "0" && data !== "-";
        }
    },
    {
        id: 'oportunidades_vivotec',
        nome: 'Oportunidades Vivo Tech',
        filtro: (c) => {
            const data = String(c.data_fim_vtech || '').trim();
            const info = String(c.vivo_tech || '').trim();
            return (data === "" || data === "0" || data === "-") && (info !== "" && info !== "0" && info !== "-");
        }
    },
    {
        id: 'migracao_vvn',
        nome: 'Disponibilidade Migração VVN',
        filtro: (c) => {
            const metalico = parseInt(c.term_metalico) || 0;
            const disp = String(c.disponibilidade || '').toUpperCase().trim();
            return metalico >= 1 && (disp === "" || disp === "NÃO" || disp === "NAO" || disp === "0");
        }
    },
    {
        id: 'filtro_ddr',
        nome: 'DDR / VOX DIGITAL',
        filtro: (c) => String(c.ddr || '').toUpperCase().trim() === 'SIM' || String(c.vox_digital || '').toUpperCase().trim() === 'SIM'
    },
    {
        id: 'filtro_0800',
        nome: '0800',
        filtro: (c) => String(c.zero800 || '').toUpperCase().trim() === 'SIM'
    },
    {
        id: 'filtro_sip',
        nome: 'SIP VOZ',
        filtro: (c) => String(c.sip_voz || '').toUpperCase().trim() === 'SIM'
    },
];

// ================== INICIALIZAÇÃO ==================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const welcomeEl = document.getElementById('userWelcome');
        if (currentUser && welcomeEl) {
            welcomeEl.textContent = currentUser.charAt(0).toUpperCase() + currentUser.slice(1);
        }
        await carregarDados();
        inicializarEventListeners();
        renderizarFiltros();
    } catch (error) {
        console.error('Erro na inicialização:', error);
    } finally {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';
    }
});

async function carregarDados() {
    try {
        const response = await fetch('/dados/clientes.json?nocache=' + new Date().getTime());
        if (!response.ok) throw new Error("Erro ao carregar arquivo");
        const dadosBrutos = await response.json();

        clientesData = dadosBrutos.map(c => {
            // Prioridade total para o que vem do mapa (CONSULTOR)
            const nomeConsultor = String(c.consultor || c.CONSULTOR || c.CV || 'NÃO INFORMADO').trim();

            return {
                ...c,
                nome: String(c.nome || c.NM_CLIENTE || '').trim(),
                consultor: nomeConsultor,
                cnpj: String(c.cnpj || c.NR_CNPJ || '').trim(),
                cidade: String(c.cidade || c.DS_CIDADE || '').trim(),
                situacao: String(c.situacao || c.SITUACAO_RECEITA || '').toUpperCase(),
                m_movel: parseInt(c.m_movel || c.QT_MOVEL_TERM) || 0,
                m_fixa: parseInt(c.m_fixa || c.QT_BASICA_TERM_FIBRA) || 0,
                checked: c.checked || false,
                // Mantendo os outros campos
                data_fim_vtech: String(c.data_fim_vtech || '').trim(),
                vivo_tech: String(c.vivo_tech || '').trim(),
                term_metalico: parseInt(c.term_metalico || 0),
                disponibilidade: String(c.disponibilidade || '').trim(),
                ddr: String(c.ddr || '').toUpperCase().trim(),
                vox_digital: String(c.vox_digital || '').toUpperCase().trim(),
                zero800: String(c.zero800 || '').toUpperCase().trim(),
                sip_voz: String(c.sip_voz || '').toUpperCase().trim(),
                cd_pessoa: String(c.cd_pessoa || '').trim(),
                recomendacao: String(c.recomendacao || '').trim(),
                telefone: String(c.telefone || c.CELULAR_CONTATO_PRINCIPAL_SFA || '')
            };
        });

        popularFiltroConsultores();
        aplicarFiltros();
    } catch (error) {
        console.error("Erro ao processar JSON:", error);
    }
}
function popularFiltroConsultores() {
    const select = document.getElementById('consultor-filter');
    if (!select) return;

    // Extrai nomes únicos diretamente dos dados carregados (coluna consultor)
    const consultoresUnicos = [...new Set(clientesData
        .map(c => c.consultor)
        .filter(nome => nome && nome !== "" && nome !== "0" && nome !== "-" && nome !== "undefined")
    )].sort();

    select.innerHTML = '<option value="">Todos os Consultores</option>';

    consultoresUnicos.forEach(con => {
        const opt = document.createElement('option');
        opt.value = con;
        opt.textContent = con;
        select.appendChild(opt);
    });
}
function aplicarFiltros() {
    let res = clientesData;

    // Filtro de Categorias (Botões)
    if (currentFilter !== 'todos') {
        const f = filtros.find(x => x.id === currentFilter);
        if (f) res = res.filter(f.filtro);
    }

    // FILTRO DE CONSULTOR (Coluna CV)
    if (selectedConsultor) {
        res = res.filter(c => c.consultor === selectedConsultor);
    }

    // Filtro de Busca
    if (searchTerm) {
        res = res.filter(c =>
            c.nome?.toLowerCase().includes(searchTerm) ||
            c.cnpj?.toString().includes(searchTerm)
        );
    }

    filteredData = res;
    renderizarClientes();
    atualizarContadores(res);
    atualizarGraficos(res);
}

// ================== FUNÇÕES DE RENDERIZAÇÃO ==================
function renderizarClientes() {
    const container = document.getElementById('clients-container');
    if (!container) return;
    container.innerHTML = '';

    const usuarioLogado = currentUser?.toLowerCase().trim();
    const isAdmin = hasFullAccess(usuarioLogado);

    filteredData.forEach(cliente => {
        const card = document.createElement('div');
        card.className = `client-card ${cliente.checked ? 'checked-card' : ''}`;
        const consultorLimpo = String(cliente.consultor || '').toLowerCase().trim();
        
        // 1. Verifica se é o dono direto
        const ehDonoDoCliente = consultorLimpo === usuarioLogado;
        
        // 2. Verifica se o cliente está "sem dono" (vazio, zero, traço ou termos genéricos)
        const semConsultor = consultorLimpo === "" || 
                             consultorLimpo === "0" || 
                             consultorLimpo === "-" || 
                             consultorLimpo === "undefined" || 
                             consultorLimpo === "não informado";

        // 3. Regra final: Pode editar se for Admin OU Dono OU se o cliente estiver sem consultor
        const podeEditar = isAdmin || ehDonoDoCliente || semConsultor;
        // --------------------------------

        const isChecked = cliente.checked ? 'checked' : '';
        const corMovel = cliente.m_movel >= 17 ? '#10b981' : '#64748b';
        const corFixa = cliente.m_fixa >= 7 ? '#10b981' : '#64748b';
        const statusFunil = cliente.status_funil || 'aberto';

        // --- Bloco EXTRA ---
        let htmlCodigoExtra = '';
        if (cliente.nome.toUpperCase().includes('EXTRA')) {
            const valorFinal = (cliente.cd_pessoa && cliente.cd_pessoa !== "0") ? cliente.cd_pessoa : "NÃO LOCALIZADO";
            htmlCodigoExtra = `
                <div style="background: #fff1f2; border: 2px solid #e11d48; border-radius: 8px; padding: 10px; margin-bottom: 15px; text-align: center;">
                    <span style="font-size: 0.7rem; color: #9f1239; font-weight: 900;">⚠️ IDENTIFICADO COMO EXTRA</span><br>
                    <b style="font-family: monospace; font-size: 1.1rem; color: #be123c;">ID: ${valorFinal}</b>
                </div>`;
        }

        // --- Bloco Serviços ---
        let htmlServicos = '<div style="display:flex; gap:5px; margin-bottom:10px; flex-wrap:wrap;">';
        if (cliente.ddr === 'SIM' || cliente.vox_digital === 'SIM') {
            const label = cliente.vox_digital === 'SIM' ? 'VOX DIGITAL' : 'DDR';
            htmlServicos += `<span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:10px; font-size:0.65rem; font-weight:800;">📞 ${label}</span>`;
        }
        if (cliente.zero800 === 'SIM') htmlServicos += '<span style="background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:10px; font-size:0.65rem; font-weight:800;">☎️ 0800</span>';
        if (cliente.sip_voz === 'SIM') htmlServicos += '<span style="background:#ede9fe; color:#6d28d9; padding:2px 6px; border-radius:10px; font-size:0.65rem; font-weight:800;">🌐 SIP</span>';
        htmlServicos += '</div>';

        // --- MONTAGEM DO HTML ---
        card.innerHTML = `
            <div class="client-header" style="border-bottom: 2px solid #660099; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                    <div style="font-weight: 800; color: #1e293b; font-size: 1rem;">${cliente.nome}</div>
                    <div style="font-size: 0.8rem; color: #64748b;">📍 ${cliente.cidade} | CNPJ: ${formatarCNPJ(cliente.cnpj)}</div>
                </div>
                <div style="margin-left: 10px; text-align: center;">
                    <input type="checkbox" ${isChecked} 
                        ${!podeEditar ? 'disabled' : ''} 
                        style="width: 22px; height: 22px; cursor: ${podeEditar ? 'pointer' : 'not-allowed'}; accent-color: #660099;" 
                        onclick="event.stopPropagation(); toggleCheck('${cliente.cnpj}', this.checked)">
                    <div style="font-size: 0.5rem; font-weight: bold; color: #64748b; margin-top: 2px;">VISTO</div>
                </div>
            </div>

            <div style="margin-top: 10px; border-top: 1px dashed #e2e8f0; padding-top: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <label style="font-size: 0.65rem; font-weight: bold; color: #64748b;">NOTAS E STATUS:</label>
                    <div style="display: flex; gap: 4px;">
                        <button onclick="atualizarFunil('${cliente.cnpj}', 'ganho')" 
                            ${!podeEditar ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
                            style="background: ${statusFunil === 'ganho' ? '#10b981' : '#f1f5f9'}; color: ${statusFunil === 'ganho' ? 'white' : '#64748b'}; border: 1px solid #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: bold;">🏆 GANHO</button>
                        <button onclick="atualizarFunil('${cliente.cnpj}', 'perdido')" 
                            ${!podeEditar ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
                            style="background: ${statusFunil === 'perdido' ? '#ef4444' : '#f1f5f9'}; color: ${statusFunil === 'perdido' ? 'white' : '#64748b'}; border: 1px solid #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: bold;">❌ PERDIDO</button>
                    </div>
                </div>
                
                <textarea 
                    class="obs-input" 
                    placeholder="${podeEditar ? 'Escreva uma observação...' : 'Apenas visualização'}" 
                    ${!podeEditar ? 'readonly' : ''}
                    onchange="salvarNotaCompleta('${cliente.cnpj}', this.value)"
                    style="width: 100%; font-size: 0.75rem; border: 1px solid #e2e8f0; border-radius: 4px; padding: 5px; resize: none; min-height: 40px; background: ${podeEditar ? '#fff' : '#f8fafc'};"
                >${cliente.observacao || ''}</textarea>
                
                <div style="font-size: 0.6rem; color: #94a3b8; margin-top: 2px; text-align: right;">
                    📅 ${cliente.data_obs || 'Sem registro'}
                </div>
            </div>

            ${htmlCodigoExtra} 
            ${htmlServicos}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0;">
                <div style="background:#f8fafc; padding:5px; border-radius:5px; text-align:center; border: 1px solid #e2e8f0;">
                    <small style="color: #64748b; font-weight: bold;">MÓVEL</small><br><b style="color:${corMovel}">M ${cliente.m_movel}</b>
                </div>
                <div style="background:#f8fafc; padding:5px; border-radius:5px; text-align:center; border: 1px solid #e2e8f0;">
                    <small style="color: #64748b; font-weight: bold;">FIXA</small><br><b style="color:${corFixa}">M ${cliente.m_fixa}</b>
                </div>
            </div>

            <div style="background:#fffbeb; padding:10px; border-radius:6px; font-size:0.8rem; margin-bottom:10px; border: 1px solid #fde68a; color: #92400e; font-weight: 500;">
                💡 ${cliente.recomendacao}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display: flex; flex-direction: column;">
                    <b style="color:#25d366; font-family: monospace; font-size: 1rem;">${cliente.telefone}</b>
                    <span style="font-size: 0.65rem; color: #64748b;">👤 Consultor: ${cliente.consultor || 'SEM CONSULTOR'}</span>
                </div>
                <a href="https://wa.me/55${cliente.telefone.replace(/\D/g, '')}" target="_blank" 
                   style="background:#25d366; color:white; padding:6px 12px; border-radius:6px; text-decoration:none; font-size:0.75rem; font-weight:bold;">
                   WhatsApp
                </a>
            </div>
        `;
        container.appendChild(card);
    });
}
// FUNÇÃO PARA ENVIAR O CHECK PARA O SERVIDOR
async function toggleCheck(cnpj, isChecked) {
    try {
        const response = await fetch('/api/check_cliente', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cnpj: cnpj, checked: isChecked })
        });

        if (response.ok) {
            // Atualiza os dados locais para manter a interface rápida
            const cliente = clientesData.find(c => String(c.cnpj) === String(cnpj));
            if (cliente) {
                cliente.checked = isChecked;
                // Re-aplica os filtros para atualizar a cor do card na tela
                aplicarFiltros();
            }
        } else {
            alert("Erro ao salvar status. Verifique sua conexão.");
        }
    } catch (error) {
        console.error("Erro no fetch do check:", error);
    }
}
// ================== FUNÇÃO DOS GRÁFICOS ==================
function atualizarGraficos(dados) {
    const ctxSituacao = document.getElementById('chartSituacao')?.getContext('2d');
    const ctxCidades = document.getElementById('chartCidades')?.getContext('2d');

    if (!ctxSituacao || !ctxCidades) return;

    // --- GRÁFICO 1: SITUAÇÃO DA BASE (Pizza/Doughnut) ---
    const contagemSituacao = dados.reduce((acc, c) => {
        const sit = c.situacao || 'NÃO INFORMADO';
        acc[sit] = (acc[sit] || 0) + 1;
        return acc;
    }, {});

    if (instanciaGraficos.situacao) instanciaGraficos.situacao.destroy();
    instanciaGraficos.situacao = new Chart(ctxSituacao, {
        type: 'doughnut',
        data: {
            labels: Object.keys(contagemSituacao),
            datasets: [{
                data: Object.values(contagemSituacao),
                backgroundColor: ['#660099', '#10b981', '#f59e0b', '#ef4444', '#64748b'],
                borderWidth: 2
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // --- GRÁFICO 2: TOP 5 CIDADES (Barras) ---
    const contagemCidades = dados.reduce((acc, c) => {
        const cid = c.cidade || 'OUTROS';
        acc[cid] = (acc[cid] || 0) + 1;
        return acc;
    }, {});

    // Ordena e pega as 5 maiores
    const topCidades = Object.entries(contagemCidades)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (instanciaGraficos.cidades) instanciaGraficos.cidades.destroy();
    instanciaGraficos.cidades = new Chart(ctxCidades, {
        type: 'bar',
        data: {
            labels: topCidades.map(item => item[0]),
            datasets: [{
                label: 'Número de Clientes',
                data: topCidades.map(item => item[1]),
                backgroundColor: '#8b5cf6',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

// ================== FUNÇÕES AUXILIARES ==================

function atualizarContadores(res) {
    const totalEl = document.getElementById('total-clientes');
    if (totalEl) totalEl.textContent = res.length;
}

function inicializarEventListeners() {
    // Filtro de Busca por Texto
    document.getElementById('search-input')?.addEventListener('input', e => {
        searchTerm = e.target.value.toLowerCase();
        aplicarFiltros();
    });

    // Filtro de Consultor (Dropdown)
    document.getElementById('consultor-filter')?.addEventListener('change', e => {
        selectedConsultor = e.target.value; // Aqui ele pega o nome do consultor selecionado
        aplicarFiltros(); // E já manda filtrar a tela
    });
}
function renderizarFiltros() {
    const container = document.getElementById('filters-container');
    if (!container) return;
    container.innerHTML = '';
    filtros.forEach(f => {
        const btn = document.createElement('div');
        btn.className = `filter-btn ${currentFilter === f.id ? 'active' : ''}`;
        btn.textContent = f.nome;
        btn.onclick = () => {
            currentFilter = f.id;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            aplicarFiltros();
        };
        container.appendChild(btn);
    });
}

function formatarCNPJ(cnpj) {
    if (!cnpj || cnpj === '0') return '-';
    let s = cnpj.toString().replace(/\D/g, '').padStart(14, '0');
    return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function baixarDadosFiltrados() {
    if (typeof XLSX === 'undefined') {
        alert("Erro: Biblioteca de exportação não carregada.");
        return;
    }

    if (!filteredData || filteredData.length === 0) {
        alert("Não há dados na tela para exportar.");
        return;
    }

const exportData = filteredData.map(c => ({
        "CNPJ": c.cnpj,
        "Cliente": c.nome,
        "Cidade": c.cidade,
        "Consultor": c.consultor,
        "Móvel": c.m_movel,
        "Fixa": c.m_fixa,
        "Situação": c.situacao,
        "Visto": c.checked ? "SIM" : "NÃO",
        "STATUS NEGÓCIO": (c.status_funil || "EM ABERTO").toUpperCase(),
        "OBSERVAÇÃO": c.observacao || "",
        "DATA DA NOTA": c.data_obs || "" 
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Filtro iHelp");

    // Gera o download do arquivo .xlsx real
    XLSX.writeFile(workbook, `Relatorio_Telebrasil_${currentFilter}.xlsx`);
}

// Salva a observação e gera a data automática
// --- FUNÇÃO PARA SALVAR NOTAS E DATA ---
async function salvarNotaCompleta(cnpj, texto) {
    const dataAtual = new Date().toLocaleString('pt-BR');
    try {
        const response = await fetch('/api/salvar_detalhes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                cnpj: cnpj, 
                observacao: texto, 
                data_obs: dataAtual 
            })
        });
        
        if (response.ok) {
            const cliente = clientesData.find(c => String(c.cnpj) === String(cnpj));
            if (cliente) {
                cliente.observacao = texto;
                cliente.data_obs = dataAtual;
                // Atualiza apenas a lista filtrada e renderiza para mostrar a nova data na tela
                renderizarClientes();
            }
        }
    } catch (error) { 
        console.error("Erro ao salvar nota:", error); 
    }
}

// --- FUNÇÃO PARA SALVAR STATUS (GANHO/PERDIDO) ---
async function atualizarFunil(cnpj, status) {
    try {
        const response = await fetch('/api/salvar_detalhes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cnpj: cnpj, status_funil: status })
        });
        
        if (response.ok) {
            const cliente = clientesData.find(c => String(c.cnpj) === String(cnpj));
            if (cliente) {
                cliente.status_funil = status;
                // Re-aplica os filtros para atualizar as cores dos botões (verde/vermelho)
                aplicarFiltros(); 
            }
        }
    } catch (error) { 
        console.error("Erro ao atualizar funil:", error); 
    }
}