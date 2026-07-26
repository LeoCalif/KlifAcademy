// =====================================================
// INTEGRAÇÃO DE DADOS DO PAINEL (FastAPI)
// =====================================================

let alunos = [];
let catracaLog = [];
let atividades = [];

const HOJE_REF = new Date();

// =====================================================
// CÁLCULO E RENDERIZAÇÃO DOS CARDS PRINCIPAIS
// =====================================================

const modalLotacaoOverlay = document.getElementById('modal-lotacao-overlay');
const btnFecharLotacao = document.getElementById('btn-fechar-lotacao');

function inicializarCards() {
  const hojeStr = HOJE_REF.toISOString().split('T')[0]; // "yyyy-mm-dd"

  let presentesHoje = catracaLog.filter(log => log.status === 'treinando').length;
  let aguardandoPgto = alunos.filter(a => a.status === 'aguardando').length;
  let vencimentosHoje = alunos.filter(a => a.vencimento === hojeStr).length;

  document.getElementById('count-presentes').textContent = presentesHoje;
  document.getElementById('count-aguardando').textContent = aguardandoPgto;
  document.getElementById('count-vencimentos').textContent = vencimentosHoje;

  // Link do card de Aguardando
  document.getElementById('card-link-aguardando').addEventListener('click', () => {
    window.location.href = '../alunos/Alunos.html?filter=aguardando';
  });

  // Link do card de Vencimentos Hoje
  document.getElementById('card-link-vencimentos').addEventListener('click', () => {
    window.location.href = '../alunos/Alunos.html?filter=vencimento-hoje';
  });

  // Link do card de Presentes (abre o modal de Lotação)
  document.getElementById('card-link-presentes').addEventListener('click', () => {
    modalLotacaoOverlay.classList.add('aberto');
    document.body.style.overflow = 'hidden';
  });

  // Listener para fechar o modal de lotação
  btnFecharLotacao.addEventListener('click', () => {
    modalLotacaoOverlay.classList.remove('aberto');
    document.body.style.overflow = '';
  });

  modalLotacaoOverlay.addEventListener('click', (e) => {
    if (e.target === modalLotacaoOverlay) {
      modalLotacaoOverlay.classList.remove('aberto');
      document.body.style.overflow = '';
    }
  });
}

// =====================================================
// SIMULAÇÃO DA CATRACA & LOTAÇÃO
// =====================================================

function inicializarCatracaELotacao() {
  const logList = document.getElementById('catraca-log-list');
  const countTreinando = document.getElementById('count-status-treinando');
  const occupancyNum = document.getElementById('current-occupancy-num');
  const progressCircle = document.getElementById('occupancy-progress');

  logList.innerHTML = '';

  let treinandoCount = 0;

  catracaLog.forEach(log => {
    const isTreinando = log.status === 'treinando';
    if (isTreinando) treinandoCount++;

    const avatarChar = (log.nome || 'Aluno').charAt(0).toUpperCase();
    const badgeClass = isTreinando ? 'status-ativo' : 'status-inativo';
    const badgeText = isTreinando ? 'Treinando' : 'Saiu';
    const horaTexto = isTreinando ? `Entrou às ${log.horaEntrada}` : `Entrou às ${log.horaEntrada} · Saiu às ${log.horaSaida}`;

    const logItem = document.createElement('div');
    logItem.className = 'catraca-log-item';
    logItem.innerHTML = `
      <div class="catraca-log-aluno">
        <div class="catraca-avatar">${avatarChar}</div>
        <div>
          <div class="catraca-info-nome">${log.nome || 'Aluno'}</div>
          <div class="catraca-info-hora">${horaTexto}</div>
        </div>
      </div>
      <div class="catraca-status">
        <span class="status-badge ${badgeClass}" style="font-size: 11px; padding: 2px 8px;">
          <span class="status-dot"></span> ${badgeText}
        </span>
      </div>
    `;
    logList.appendChild(logItem);
  });

  // Atualiza contadores
  countTreinando.textContent = `${treinandoCount} treinando`;

  // Simulamos uma ocupação um pouco maior para fins estéticos de dashboard
  const ocupacaoSimulada = treinandoCount + 5; 
  const capacidadeMaxima = 80;

  occupancyNum.textContent = ocupacaoSimulada;

  // Atualiza o círculo de progresso
  const maxOffset = 326.72;
  const porcentagem = (ocupacaoSimulada / capacidadeMaxima) * 100;
  const offset = maxOffset - (porcentagem * maxOffset) / 100;
  if (progressCircle) {
    progressCircle.style.strokeDashoffset = offset;
  }
}

function calcularDiasDiferenca(dataISO) {
  const venc = new Date(dataISO + 'T23:59:59');
  const diffTime = HOJE_REF - venc;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// =====================================================
// TIMELINE DE ATIVIDADES
// =====================================================

function inicializarAtividades() {
  const container = document.getElementById('timeline-atividades');
  container.innerHTML = '';

  atividades.forEach(ativ => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    const operadorTexto = ativ.usuario ? ` · Por <strong>${ativ.usuario}</strong>` : ' · Recepção';
    item.innerHTML = `
      <div class="timeline-dot ${ativ.dot}"></div>
      <div class="timeline-content">
        <div class="timeline-titulo">${ativ.titulo}</div>
        <div class="timeline-desc">${ativ.desc}</div>
        <div class="timeline-data">${ativ.tempo}${operadorTexto}</div>
      </div>
    `;
    container.appendChild(item);
  });
}

// =====================================================
// LISTAS RÁPIDAS (Próximos Vencimentos e Aniversários)
// =====================================================

function formatarDataBR(dataISO) {
  if (!dataISO) return '—';
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Função para obter a diferença de dias até o vencimento
function inicializarListasRapidas() {
  const listVenc = document.getElementById('lista-proximos-vencimentos');
  const listAniv = document.getElementById('lista-aniversariantes');

  listVenc.innerHTML = '';
  listAniv.innerHTML = '';

  const hoje = new Date(HOJE_REF);
  hoje.setHours(0, 0, 0, 0);
  const diaSemana = hoje.getDay();
  
  // Começo da semana vigente (Domingo)
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - diaSemana);
  inicioSemana.setHours(0, 0, 0, 0);
  
  // Fim da semana vigente (Sábado)
  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(inicioSemana.getDate() + 6);
  fimSemana.setHours(23, 59, 59, 999);

  // 1. Próximos Vencimentos da Semana Vigente (ordena vencimento ativo de forma ascendente)
  const ativosComVenc = alunos
    .filter(a => {
      if (a.vencimento === null || a.status !== 'ativo') return false;
      const vencDate = new Date(a.vencimento + 'T12:00:00');
      return vencDate >= inicioSemana && vencDate <= fimSemana;
    })
    .sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento));

  ativosComVenc.forEach(aluno => {
    const tr = document.createElement('tr');
    const hojeStr = HOJE_REF.toISOString().split('T')[0];
    const dataTexto = aluno.vencimento === hojeStr ? '<strong>Hoje</strong>' : formatarDataBR(aluno.vencimento);

    tr.innerHTML = `
      <td style="font-weight: 600;">${aluno.nome}</td>
      <td>${dataTexto}</td>
      <td>
        <a href="../alunos/Alunos.html" class="action-btn" title="Ver Aluno" style="display: inline-flex; text-decoration: none;"><i class="fa-solid fa-eye" style="margin-top: 8px;"></i></a>
      </td>
    `;
    listVenc.appendChild(tr);
  });

  // 2. Aniversariantes do Mês
  const mesAtualStr = String(HOJE_REF.getMonth() + 1).padStart(2, '0'); // Mês atual
  const aniversariantesMes = alunos
    .filter(a => {
      if (!a.data_nasc) return false;
      const mesNasc = a.data_nasc.split('-')[1];
      return mesNasc === mesAtualStr;
    })
    .sort((a, b) => {
      const diaA = parseInt(a.data_nasc.split('-')[2]);
      const diaB = parseInt(b.data_nasc.split('-')[2]);
      return diaA - diaB;
    });

  aniversariantesMes.forEach(aluno => {
    const diaAniv = aluno.data_nasc.split('-')[2];
    const mesAniv = aluno.data_nasc.split('-')[1];

    const tr = document.createElement('tr');
    const hojeDia = HOJE_REF.getDate();
    const diaTexto = (parseInt(diaAniv) === hojeDia) 
      ? '<span class="status-badge status-ativo" style="font-size:11px; padding: 2px 6px;">Hoje! 🎂</span>' 
      : `${diaAniv}/${mesAniv}`;

    tr.innerHTML = `
      <td style="font-weight: 600;">${aluno.nome}</td>
      <td>Aniversário</td>
      <td style="vertical-align: middle;">${diaTexto}</td>
    `;
    listAniv.appendChild(tr);
  });

  if (aniversariantesMes.length === 0) {
    listAniv.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-3);">Nenhum aniversariante este mês.</td></tr>';
  }
}

// =====================================================
// GERENCIAMENTO DE MODAIS OVERLAYS
// =====================================================

function inicializarModais() {
  const modaisConfig = [
    { trigger: '#btn-open-catraca', overlay: '#modal-catraca-overlay', closeBtn: '#btn-fechar-catraca' },
    { trigger: '#btn-open-atividades', overlay: '#modal-atividades-overlay', closeBtn: '#btn-fechar-atividades' },
    { trigger: '#btn-open-vencimentos', overlay: '#modal-vencimentos-overlay', closeBtn: '#btn-fechar-vencimentos' },
    { trigger: '#btn-open-aniversariantes', overlay: '#modal-aniversariantes-overlay', closeBtn: '#btn-fechar-aniversariantes' }
  ];

  modaisConfig.forEach(config => {
    const triggerEl = document.querySelector(config.trigger);
    const overlayEl = document.querySelector(config.overlay);
    const closeEl = document.querySelector(config.closeBtn);

    if (triggerEl && overlayEl && closeEl) {
      // Abre o modal
      triggerEl.addEventListener('click', () => {
        overlayEl.classList.add('aberto');
        document.body.style.overflow = 'hidden';
      });

      // Fecha com o botão X
      closeEl.addEventListener('click', () => {
        overlayEl.classList.remove('aberto');
        document.body.style.overflow = '';
      });

      // Fecha clicando fora
      overlayEl.addEventListener('click', (e) => {
        if (e.target === overlayEl) {
          overlayEl.classList.remove('aberto');
          document.body.style.overflow = '';
        }
      });
    }
  });
}

// =====================================================
// FORMATAR TEMPO DECORRIDO
// =====================================================

function formatarTempoDecorrido(dataISO) {
  if (!dataISO) return "";
  const data = new Date(dataISO);
  const agora = new Date();
  const diffMs = agora - data;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `há ${diffHoras} ${diffHoras === 1 ? 'hora' : 'horas'}`;
  const diffDias = Math.floor(diffHoras / 24);
  return `há ${diffDias} ${diffDias === 1 ? 'dia' : 'dias'}`;
}

// =====================================================
// ATUALIZAR LOGS DE AUDITORIA & FILTRO DE OPERADORES
// =====================================================

async function atualizarLogsAuditoria(usuarioId = null) {
  try {
    const logs = await db.getLogs(usuarioId);
    atividades = logs.slice(0, 6).map(log => {
      let tipo = 'outro';
      let dot = 'dot-neutro';
      const acaoLower = (log.acao || '').toLowerCase();
      if (acaoLower.includes('pagamento')) {
        tipo = 'pagamento';
        dot = 'dot-sucesso';
      } else if (acaoLower.includes('cadastro') || acaoLower.includes('cadastrar')) {
        tipo = 'cadastro';
        dot = 'dot-sucesso';
      } else if (acaoLower.includes('pausa') || acaoLower.includes('pausar')) {
        tipo = 'pausa';
        dot = 'dot-pausado';
      } else if (acaoLower.includes('retomar')) {
        tipo = 'reativacao';
        dot = 'dot-sucesso';
      } else if (acaoLower.includes('inativar')) {
        tipo = 'inativar';
        dot = 'dot-atencao';
      }

      return {
        tipo: tipo,
        titulo: log.acao || 'Ação',
        desc: log.detalhe || 'Sem detalhes',
        tempo: formatarTempoDecorrido(log.data),
        dot: dot,
        usuario: log.usuario || 'Sistema'
      };
    });
  } catch (e) {
    console.error("Erro ao obter logs de auditoria:", e);
    atividades = [];
  }

  if (atividades.length === 0) {
    atividades = [
      { tipo: 'outro', titulo: 'Sem Atividades', desc: 'Nenhuma operação encontrada para este operador.', tempo: 'agora', dot: 'dot-neutro' }
    ];
  }

  inicializarAtividades();
}

async function inicializarFiltroOperadores() {
  let user = null;
  try {
    const u = localStorage.getItem('wpa_usuario_logado');
    if (u) user = JSON.parse(u);
  } catch (e) {}
  if (!user) return;

  const containerFiltro = document.getElementById('filtro-usuarios-container');
  const selectOperador = document.getElementById('filtro-operador');

  if (!containerFiltro || !selectOperador) return;

  const role = ((user.nivel || user.perfil) || '').toLowerCase();
  if (role === 'administrador' || role === 'admin' || role.includes('gerente')) {
    containerFiltro.style.display = 'flex';

    try {
      const usuarios = await db.getUsuarios();
      
      // Limpa opções antigas, mantendo apenas a opção "Todos os Operadores"
      selectOperador.innerHTML = '<option value="">Todos os Operadores</option>';

      usuarios.forEach(u => {
        const option = document.createElement('option');
        option.value = u.id;
        option.textContent = `${u.nome} (${u.perfil})`;
        selectOperador.appendChild(option);
      });

      // Remove listener antigo recriando o elemento para evitar múltiplos listeners
      const newSelect = selectOperador.cloneNode(true);
      selectOperador.parentNode.replaceChild(newSelect, selectOperador);

      newSelect.addEventListener('change', async (e) => {
        const usuarioId = e.target.value;
        await atualizarLogsAuditoria(usuarioId);
      });

    } catch (e) {
      console.error("Erro ao carregar usuários para filtro:", e);
    }
  } else {
    containerFiltro.style.display = 'none';
  }
}

// =====================================================
// INICIALIZAÇÃO GERAL (Assíncrona)
// =====================================================

async function init() {
  try {
    // Carrega os alunos reais
    alunos = await db.getAlunos();

    // Carrega os pagamentos reais para simular a catraca
    try {
      const pagamentos = await db.getPagamentos();
      catracaLog = pagamentos.slice(0, 5).map(p => {
        let hora = '00:00';
        if (p.data) {
          hora = new Date(p.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
        return {
          nome: p.aluno || p.aluno_nome || "Aluno",
          horaEntrada: hora,
          horaSaida: null,
          status: p.status === 'confirmado' ? 'treinando' : 'saiu'
        };
      });
    } catch (e) {
      console.error("Erro ao obter pagamentos para a catraca:", e);
    }

    if (catracaLog.length === 0) {
      catracaLog = [
        { nome: 'Ana Beatriz Souza', horaEntrada: '08:00', horaSaida: null, status: 'treinando' }
      ];
    }

    // Carrega e atualiza os logs de auditoria iniciais
    await atualizarLogsAuditoria();

    // Inicializa o seletor de filtros para Gerente e Administrador
    await inicializarFiltroOperadores();

    inicializarCards();
    inicializarCatracaELotacao();
    inicializarListasRapidas();
    inicializarModais();

    // Atualiza contagem de alunos no badge da sidebar
    const sidebarBadge = document.querySelector('.sidebar-nav a[href*="Alunos.html"] .nav-badge');
    if (sidebarBadge) {
      sidebarBadge.textContent = alunos.length;
    }
  } catch (err) {
    console.error("Erro na inicialização do painel:", err);
  }
}

init();


