let clientesData = [];
let filteredData = [];
let currentFilter = 'todos';
let searchTerm = '';
let selectedConsultor = null;
let currentUser = sessionStorage.getItem('usuario');

// --- CONTROLE DOS GRÁFICOS ---
let instanciaGraficos = { movel: null, fixa: null };

// Adicionada Franciele explicitamente e garantia de nomes minúsculos para comparação
const ADMIN_USERS = ['renata', 'franciele', 'admin', 'davi', 'pedro', 'danila', 'alvaro', 'gabriela', 'ricardo'];

function hasFullAccess(username) {
    if (!username) return false;
    const user = username.toLowerCase().trim();
    
    // Verifica se está na lista manual OU se a variável do servidor (se existir) é true
    const ehAdminLista = ADMIN_USERS.includes(user);
    const ehAdminSessao = (typeof IS_ADMIN_SESSION !== 'undefined' && IS_ADMIN_SESSION === true);
    
    return ehAdminLista || ehAdminSessao;
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
                observacao: c.observacao || '',
                data_obs: c.data_obs || '',
                status_funil: c.status_funil || 'aberto',
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
    const consultoresUnicos = [...new Set(clientesData
        .map(c => c.consultor)
        .filter(nome => nome && !["", "0", "-", "undefined"].includes(nome.toLowerCase().trim()))
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
    if (currentFilter !== 'todos') {
        const f = filtros.find(x => x.id === currentFilter);
        if (f) res = res.filter(f.filtro);
    }
    if (selectedConsultor) {
        res = res.filter(c => c.consultor === selectedConsultor);
    }
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
        const ehDonoDoCliente = (consultorLimpo === usuarioLogado);
        const semConsultor = ["", "0", "-", "undefined", "não informado"].includes(consultorLimpo);

        // REGRA DE PERMISSÃO: Franciele e Admins entram aqui via isAdmin
        const podeEditar = isAdmin || ehDonoDoCliente || semConsultor;

        const isChecked = cliente.checked ? 'checked' : '';
        const corMovel = cliente.m_movel >= 17 ? '#10b981' : '#64748b';
        const corFixa = cliente.m_fixa >= 7 ? '#10b981' : '#64748b';
        const statusFunil = cliente.status_funil || 'aberto';

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

async function toggleCheck(cnpj, isChecked) {
    try {
        const response = await fetch('/api/check_cliente', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cnpj: cnpj, checked: isChecked })
        });
        if (response.ok) {
            const cliente = clientesData.find(c => String(c.cnpj) === String(cnpj));
            if (cliente) {
                cliente.checked = isChecked;
                aplicarFiltros();
            }
        }
    } catch (error) { console.error("Erro no fetch do check:", error); }
}

async function salvarNotaCompleta(cnpj, texto) {
    const dataAtual = new Date().toLocaleString('pt-BR');
    try {
        const response = await fetch('/api/salvar_detalhes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cnpj, observacao: texto, data_obs: dataAtual })
        });
        if (response.ok) {
            const cliente = clientesData.find(c => String(c.cnpj) === String(cnpj));
            if (cliente) {
                cliente.observacao = texto;
                cliente.data_obs = dataAtual;
                renderizarClientes();
            }
        }
    } catch (error) { console.error("Erro ao salvar nota:", error); }
}

async function atualizarFunil(cnpj, status) {
    try {
        const response = await fetch('/api/salvar_detalhes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cnpj, status_funil: status })
        });
        if (response.ok) {
            const cliente = clientesData.find(c => String(c.cnpj) === String(cnpj));
            if (cliente) {
                cliente.status_funil = status;
                aplicarFiltros(); 
            }
        }
    } catch (error) { console.error("Erro ao atualizar funil:", error); }
}

// ... (Mantenha as funções auxiliares atualizarGraficos, formatarCNPJ, etc, que você já tem)