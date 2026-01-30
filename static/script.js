let clientesData = [];
let filteredData = [];
let currentFilter = 'todos';
let searchTerm = '';
let selectedConsultor = null;
let currentUser = sessionStorage.getItem('usuario');

// --- CONTROLE DOS GRÁFICOS ---
let instanciaGraficos = { movel: null, fixa: null };

const ADMIN_USERS = ['renata', 'franciele', 'admin', 'davi'];

function hasFullAccess(username) {
    return ADMIN_USERS.includes(username?.toLowerCase());
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
        const response = await fetch('/dados/clientes.json');
        if (!response.ok) throw new Error("Erro ao carregar arquivo");
        const dadosBrutos = await response.json();

        clientesData = dadosBrutos.map(c => {
            const idPessoa = c.cd_pessoa || c.CD_PESSOA || "";
            return {
                ...c,
                nome: String(c.nome || '').trim(),
                situacao: String(c.situacao || '').toUpperCase(),
                data_fim_vtech: String(c.data_fim_vtech || '').trim(),
                vivo_tech: String(c.vivo_tech || '').trim(),
                term_metalico: parseInt(c.term_metalico) || 0,
                disponibilidade: String(c.disponibilidade || '').trim(),
                ddr: String(c.ddr || '').toUpperCase().trim(),
                vox_digital: String(c.vox_digital || '').toUpperCase().trim(),
                zero800: String(c.zero800 || '').toUpperCase().trim(),
                sip_voz: String(c.sip_voz || '').toUpperCase().trim(),
                cd_pessoa: String(idPessoa).trim(),
                recomendacao: String(c.recomendacao || '').trim(),
                m_movel: parseInt(c.m_movel) || 0,
                m_fixa: parseInt(c.m_fixa) || 0
            };
        });

        popularFiltroConsultores();
        aplicarFiltros();
    } catch (error) {
        console.error("Erro ao processar JSON:", error);
    }
}

function aplicarFiltros() {
    let res = clientesData;
    if (currentFilter !== 'todos') {
        const f = filtros.find(x => x.id === currentFilter);
        if (f) res = res.filter(f.filtro);
    }
    if (selectedConsultor) {
        res = res.filter(c => c.consultor?.toLowerCase() === selectedConsultor.toLowerCase());
    }
    if (searchTerm) {
        res = res.filter(c => c.nome?.toLowerCase().includes(searchTerm) || c.cnpj?.toString().includes(searchTerm));
    }
    filteredData = res;
    renderizarClientes();
    atualizarContadores(res);
    atualizarGraficos(res); // Ativa os gráficos a cada filtro aplicado
}

function renderizarClientes() {
    const container = document.getElementById('clients-container');
    if (!container) return;
    container.innerHTML = '';

    filteredData.forEach(cliente => {
        const card = document.createElement('div');
        card.className = 'client-card';
        const temAcesso = hasFullAccess(currentUser) || cliente.consultor?.toLowerCase() === currentUser?.toLowerCase();

        const corMovel = cliente.m_movel >= 17 ? '#10b981' : '#64748b';
        const corFixa = cliente.m_fixa >= 7 ? '#10b981' : '#64748b';

        let htmlCodigoExtra = '';
        const nomeUpper = cliente.nome.toUpperCase();
        
        if (nomeUpper.includes('EXTRA')) {
            const valorFinal = (cliente.cd_pessoa && cliente.cd_pessoa !== "0" && cliente.cd_pessoa !== "") 
                               ? cliente.cd_pessoa 
                               : "NÃO LOCALIZADO NO JSON";
            
            htmlCodigoExtra = `
                <div style="background: #fff1f2; border: 2px solid #e11d48; border-radius: 8px; padding: 10px; margin-bottom: 15px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 0.75rem; color: #9f1239; font-weight: 900; letter-spacing: 0.5px;">⚠️ IDENTIFICADO COMO EXTRA</span>
                        <span style="font-size: 0.6rem; background: #e11d48; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;">SISTEMA VIVO</span>
                    </div>
                    <div style="font-family: 'Courier New', monospace; font-size: 1.2rem; color: #be123c; font-weight: 800; text-align: center; background: white; padding: 8px; border-radius: 6px; border: 1px solid #fda4af;">
                        ID: ${valorFinal}
                    </div>
                </div>`;
        }

        let htmlServicos = '<div style="display:flex; gap:5px; margin-bottom:10px; flex-wrap:wrap;">';
        if (cliente.ddr === 'SIM' || cliente.vox_digital === 'SIM') {
            const label = cliente.vox_digital === 'SIM' ? 'VOX DIGITAL' : 'DDR';
            htmlServicos += `<span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:10px; font-size:0.65rem; font-weight:800;">📞 ${label}</span>`;
        }
        if (cliente.zero800 === 'SIM') htmlServicos += '<span style="background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:10px; font-size:0.65rem; font-weight:800;">☎️ 0800</span>';
        if (cliente.sip_voz === 'SIM') htmlServicos += '<span style="background:#ede9fe; color:#6d28d9; padding:2px 6px; border-radius:10px; font-size:0.65rem; font-weight:800;">🌐 SIP</span>';
        htmlServicos += '</div>';

        card.innerHTML = `
            <div class="client-header" style="border-bottom: 2px solid #660099; padding-bottom: 8px; margin-bottom: 10px;">
                <div style="font-weight: 800; color: #1e293b;">${cliente.nome}</div>
                <div style="font-size: 0.8rem; color: #64748b;">📍 ${cliente.cidade} | CNPJ: ${formatarCNPJ(cliente.cnpj)}</div>
            </div>
            ${htmlCodigoExtra} 
            ${htmlServicos}
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                <div style="background:#f8fafc; padding:5px; border-radius:5px; text-align:center;">
                    <small>MÓVEL</small><br><b style="color:${corMovel}">M ${cliente.m_movel}</b>
                </div>
                <div style="background:#f8fafc; padding:5px; border-radius:5px; text-align:center;">
                    <small>FIXA</small><br><b style="color:${corFixa}">M ${cliente.m_fixa}</b>
                </div>
            </div>
            ${temAcesso ? `
                <div style="background:#fffbeb; padding:8px; border-radius:4px; font-size:0.8rem; margin-bottom:10px; border: 1px solid #fde68a;">${cliente.recomendacao}</div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <b style="color:#25d366;">${cliente.telefone}</b>
                    <a href="https://wa.me/55${cliente.telefone.replace(/\D/g, '')}" target="_blank" style="background:#25d366; color:white; padding:4px 8px; border-radius:4px; text-decoration:none; font-size:0.7rem; font-weight:bold;">WhatsApp</a>
                </div>
            ` : `<div style="text-align:center; color:#94a3b8; font-size:0.8rem; padding:10px;">🔒 Consultor: ${cliente.consultor}</div>`}
        `;
        container.appendChild(card);
    });
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

function popularFiltroConsultores() {
    const select = document.getElementById('consultor-filter');
    if (!select) return;
    const lista = [...new Set(clientesData.map(c => c.consultor))].sort();
    select.innerHTML = '<option value="">Todos os Consultores</option>';
    lista.forEach(con => {
        const opt = document.createElement('option');
        opt.value = con;
        opt.textContent = con;
        select.appendChild(opt);
    });
}

function inicializarEventListeners() {
    document.getElementById('search-input')?.addEventListener('input', e => {
        searchTerm = e.target.value.toLowerCase();
        aplicarFiltros();
    });
    document.getElementById('consultor-filter')?.addEventListener('change', e => {
        selectedConsultor = e.target.value;
        aplicarFiltros();
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