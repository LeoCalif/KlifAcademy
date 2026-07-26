// =====================================================
// DADOS DE PAGAMENTOS INTEGRADOS (FastAPI)
// =====================================================

let pagamentos = [];

// =====================================================
// SELEÇÃO DE ELEMENTOS DO DOM
// =====================================================

const tabelaCorpo = document.getElementById('tabela-pagamentos');
const selectStatus = document.getElementById('select-status');
const selectForma = document.getElementById('select-forma');
const filtroDataInicio = document.getElementById('filtro-data-inicio');
const filtroDataFim = document.getElementById('filtro-data-fim');
const tableCount = document.getElementById('table-count');
const emptyState = document.getElementById('empty-state');

// Cards
const cardRecebidoHoje = document.getElementById('card-recebido-hoje');
const cardRecebidoMes = document.getElementById('card-recebido-mes');

// Modal Comprovante
const modalComprovanteOverlay = document.getElementById('modal-comprovante-overlay');
const btnFecharComprovante = document.getElementById('btn-fechar-comprovante');
const btnCopiarWhatsapp = document.getElementById('btn-copiar-whatsapp');
const btnImprimir = document.getElementById('btn-imprimir');

// Toast
const toast = document.getElementById('toast');
const toastMensagem = document.getElementById('toast-mensagem');

// Controle de Ordenação
let sortColuna = 'data';
let sortOrdem = 'desc';

let dadosComprovanteAtivo = null;

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function formatarDataHora(dataISO) {
  if (!dataISO) return '—';
  const date = new Date(dataISO);
  if (isNaN(date.getTime())) return '—';
  
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const ano = date.getFullYear();
  
  const horas = String(date.getHours()).padStart(2, '0');
  const minutos = String(date.getMinutes()).padStart(2, '0');
  
  return `${dia}/${mes}/${ano} às ${horas}:${minutos}`;
}

function formatarData(dataStr) {
  if (!dataStr) return '—';
  const [ano, mes, dia] = dataStr.split('T')[0].split('-');
  return `${dia}/${mes}/${ano}`;
}

function getIconeForma(forma) {
  const icones = {
    pix: 'fa-brands fa-pix',
    dinheiro: 'fa-solid fa-money-bill-wave',
    debito: 'fa-solid fa-credit-card',
    credito: 'fa-solid fa-credit-card'
  };
  return icones[forma] || 'fa-solid fa-dollar-sign';
}

function getFormaTexto(forma) {
  const textos = {
    pix: 'Pix',
    dinheiro: 'Dinheiro',
    debito: 'Cartão de Débito',
    credito: 'Cartão de Crédito'
  };
  return textos[forma] || forma;
}

function getStatusBadge(status) {
  const classes = {
    confirmado: 'status-ativo',
    pendente: 'status-aguardando',
    estornado: 'status-ausente'
  };
  const textos = {
    confirmado: 'Confirmado',
    pendente: 'Pendente',
    estornado: 'Estornado'
  };
  return `
    <span class="status-badge ${classes[status] || ''}">
      <span class="status-dot"></span> ${textos[status] || status}
    </span>
  `;
}

// =====================================================
// ATUALIZAÇÃO DOS CARDS
// =====================================================

function atualizarCardsFinanceiros() {
  const hojeStr = new Date().toISOString().split('T')[0];
  const anoMesStr = hojeStr.slice(0, 7);

  let totalHoje = 0;
  let totalMes = 0;

  pagamentos.forEach(pag => {
    if (pag.status === 'confirmado') {
      const dataPagStr = pag.data.split('T')[0];
      const valorNum = parseFloat(pag.valor || 0);
      
      // Recebido Hoje
      if (dataPagStr === hojeStr) {
        totalHoje += valorNum;
      }

      // Recebido no Mês
      if (dataPagStr.startsWith(anoMesStr)) {
        totalMes += valorNum;
      }
    }
  });

  cardRecebidoHoje.textContent = `R$ ${totalHoje.toFixed(2).replace('.', ',')}`;
  cardRecebidoMes.textContent = `R$ ${totalMes.toFixed(2).replace('.', ',')}`;
}

// =====================================================
// RENDERIZAÇÃO DA TABELA
// =====================================================

function renderizarTabela(dadosFiltrados) {
  tabelaCorpo.innerHTML = '';

  if (dadosFiltrados.length === 0) {
    emptyState.classList.add('visible');
    tableCount.textContent = '0 lançamentos';
    return;
  }

  emptyState.classList.remove('visible');
  tableCount.textContent = `${dadosFiltrados.length} lançamentos`;

  dadosFiltrados.forEach((pag, index) => {
    const tr = document.createElement('tr');
    const valorNum = parseFloat(pag.valor || 0);
    tr.innerHTML = `
      <td><div class="aluno-nome">${pag.aluno}</div></td>
      <td>${pag.plano}</td>
      <td style="font-weight: 600">R$ ${valorNum.toFixed(2).replace('.', ',')}</td>
      <td>
        <div class="forma-badge forma-${pag.forma}">
          <i class="${getIconeForma(pag.forma)}"></i> ${getFormaTexto(pag.forma)}
        </div>
      </td>
      <td>${formatarDataHora(pag.data)}</td>
      <td style="font-size: 13px; color: var(--text-2)">${pag.operador}</td>
      <td class="action-icons">
        <button class="action-btn btn-visualizar" title="Imprimir Comprovante"><i class="fa-solid fa-receipt"></i></button>
        <button class="action-btn btn-whatsapp" title="Copiar para WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>
      </td>
    `;

    // Conecta ações dos botões
    tr.querySelector('.btn-visualizar').addEventListener('click', () => abrirComprovante(pag));
    tr.querySelector('.btn-whatsapp').addEventListener('click', () => copiarMensagemWhatsApp(pag));

    tabelaCorpo.appendChild(tr);
  });
}

// =====================================================
// FILTROS AVANÇADOS & ORDENAÇÃO
// =====================================================

function ordenarDados(dados) {
  return dados.sort((a, b) => {
    let valA, valB;
    if (sortColuna === 'aluno') {
      valA = (a.aluno || '').toLowerCase();
      valB = (b.aluno || '').toLowerCase();
    } else if (sortColuna === 'valor') {
      valA = parseFloat(a.valor || 0);
      valB = parseFloat(b.valor || 0);
    } else { // default: 'data'
      valA = new Date(a.data);
      valB = new Date(b.data);
    }

    if (valA < valB) return sortOrdem === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrdem === 'asc' ? 1 : -1;
    return 0;
  });
}

function aplicarFiltros() {
  const statusFiltro = selectStatus.value;
  const formaFiltro = selectForma.value;
  const dataInicioVal = filtroDataInicio.value; // YYYY-MM-DD
  const dataFimVal = filtroDataFim.value;     // YYYY-MM-DD

  // Limite de 3 meses para delimitar a lista
  const dataLimite = new Date();
  dataLimite.setMonth(dataLimite.getMonth() - 3);
  const ano = dataLimite.getFullYear();
  const mes = String(dataLimite.getMonth() + 1).padStart(2, '0');
  const dia = String(dataLimite.getDate()).padStart(2, '0');
  const limiteStr = `${ano}-${mes}-${dia}`;

  const dadosFiltrados = pagamentos.filter(pag => {
    const dataPag = pag.data ? pag.data.split('T')[0] : '';
    
    // Filtro de 3 meses
    if (dataPag < limiteStr) return false;

    const passaStatus = statusFiltro === 'todos' || pag.status === statusFiltro;
    const passaForma = formaFiltro === 'todas' || pag.forma === formaFiltro;

    const passaDataInicio = !dataInicioVal || dataPag >= dataInicioVal;
    const passaDataFim = !dataFimVal || dataPag <= dataFimVal;

    return passaStatus && passaForma && passaDataInicio && passaDataFim;
  });

  const dadosOrdenados = ordenarDados(dadosFiltrados);
  renderizarTabela(dadosOrdenados);
}

// Inicializa Ouvintes de Evento dos Cliques nas Colunas
function inicializarOrdenacao() {
  const headers = document.querySelectorAll('th.sortable');
  
  function atualizarVisualHeaders() {
    headers.forEach(h => {
      const icon = h.querySelector('i');
      const col = h.getAttribute('data-sort');
      if (col === sortColuna) {
        icon.className = sortOrdem === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
        icon.style.opacity = '1';
        h.classList.add('sorted');
      } else {
        icon.className = 'fa-solid fa-sort';
        icon.style.opacity = '0.6';
        h.classList.remove('sorted');
      }
    });
  }

  headers.forEach(header => {
    header.addEventListener('click', () => {
      const coluna = header.getAttribute('data-sort');
      if (sortColuna === coluna) {
        sortOrdem = sortOrdem === 'asc' ? 'desc' : 'asc';
      } else {
        sortColuna = coluna;
        sortOrdem = coluna === 'data' ? 'desc' : 'asc';
      }

      atualizarVisualHeaders();
      aplicarFiltros();
    });
  });

  atualizarVisualHeaders();
}

// Event Listeners para Filtros
selectStatus.addEventListener('change', aplicarFiltros);
selectForma.addEventListener('change', aplicarFiltros);
filtroDataInicio.addEventListener('change', aplicarFiltros);
filtroDataFim.addEventListener('change', aplicarFiltros);

// =====================================================
// MODAL DE COMPROVANTE & AÇÕES
// =====================================================

async function abrirComprovante(pagamento) {
  dadosComprovanteAtivo = pagamento;

  // Carrega configurações dinâmicas da academia
  let config = null;
  try {
    config = await db.getConfiguracoes();
  } catch (e) {
    console.error(e);
  }
  let logoPath = '../Assets/logoAcademia.png';
  let gymName = 'Bem-Estar Fitness';
  if (config) {
    gymName = config.nomeAcademia || gymName;
    if (config.logo) {
      logoPath = config.logo;
      if (!logoPath.startsWith('../') && !logoPath.startsWith('http') && !logoPath.startsWith('data:')) {
        logoPath = '../' + logoPath;
      }
    }
  }

  const compLogoImg = document.getElementById('comp-logo-img');
  if (compLogoImg) {
    compLogoImg.src = logoPath;
  }
  const compAcademiaNome = document.getElementById('comp-academia-nome');
  if (compAcademiaNome) {
    compAcademiaNome.textContent = gymName;
  }

  const valorNum = parseFloat(pagamento.valor || 0);

  document.getElementById('comp-nome').textContent = pagamento.aluno;
  document.getElementById('comp-plano').textContent = pagamento.plano;
  document.getElementById('comp-valor').textContent = `R$ ${valorNum.toFixed(2).replace('.', ',')}`;
  document.getElementById('comp-forma').textContent = getFormaTexto(pagamento.forma);
  document.getElementById('comp-data').textContent = formatarDataHora(pagamento.data);
  document.getElementById('comp-vencimento').textContent = formatarData(pagamento.novo_vencimento);
  document.getElementById('comp-operador').textContent = pagamento.operador;
  document.getElementById('comp-status').innerHTML = getStatusBadge(pagamento.status);

  modalComprovanteOverlay.classList.add('aberto');
  document.body.style.overflow = 'hidden';
}

function fecharComprovante() {
  modalComprovanteOverlay.classList.remove('aberto');
  document.body.style.overflow = '';
  dadosComprovanteAtivo = null;
}

btnFecharComprovante.addEventListener('click', fecharComprovante);
modalComprovanteOverlay.addEventListener('click', function(e) {
  if (e.target === modalComprovanteOverlay) fecharComprovante();
});

// Copiar texto para o WhatsApp
async function copiarMensagemWhatsApp(pagamento) {
  const statusTexto = pagamento.status.toUpperCase();
  let config = null;
  try {
    config = await db.getConfiguracoes();
  } catch (e) {
    console.error(e);
  }
  const gymName = (config && config.nomeAcademia) ? config.nomeAcademia : 'Bem-Estar Fitness';
  const valorNum = parseFloat(pagamento.valor || 0);

  const texto = 
`*Comprovante de Lançamento*
${gymName}

*Aluno:* ${pagamento.aluno}
*Plano:* ${pagamento.plano}
*Valor:* R$ ${valorNum.toFixed(2).replace('.', ',')}
*Forma:* ${getFormaTexto(pagamento.forma)}
*Data/Hora:* ${formatarDataHora(pagamento.data)}
*Vencimento:* ${formatarData(pagamento.novo_vencimento)}
*Operador:* ${pagamento.operador}
*Status:* ${statusTexto}

_Obrigado, Bons Treinos!_`;

  navigator.clipboard.writeText(texto).then(() => {
    const whatsapp = pagamento.aluno_whatsapp || (pagamento.alunos && (pagamento.alunos.whatsapp || pagamento.alunos.telefone)) || null;
    if (whatsapp) {
      let numeroLimpo = whatsapp.replace(/\D/g, '');
      if (numeroLimpo.length >= 10 && numeroLimpo.length <= 11) {
        numeroLimpo = '55' + numeroLimpo;
      }
      window.open(`https://api.whatsapp.com/send?phone=${numeroLimpo}&text=${encodeURIComponent(texto)}`, '_blank');
      mostrarToast('Comprovante copiado e WhatsApp aberto!');
    } else {
      mostrarToast('Comprovante copiado! Aluno não possui WhatsApp cadastrado.');
    }
  });
}

btnCopiarWhatsapp.addEventListener('click', async function() {
  if (dadosComprovanteAtivo) {
    await copiarMensagemWhatsApp(dadosComprovanteAtivo);
  }
});

btnImprimir.addEventListener('click', function() {
  window.print();
});

// Toast
function mostrarToast(mensagem) {
  toastMensagem.textContent = mensagem;
  toast.classList.add('visivel');
  setTimeout(() => toast.classList.remove('visivel'), 3500);
}

// =====================================================
// INTEGRACAO DO GRAFICO FINANCEIRO (Chart.js)
// =====================================================

// Dados fictícios dos últimos 12 meses
const dadosFaturamento = [
  { label: 'Jun', valor: 1520.00 },
  { label: 'Jul', valor: 1680.00 },
  { label: 'Ago', valor: 1600.00 },
  { label: 'Set', valor: 1750.00 },
  { label: 'Out', valor: 1820.00 },
  { label: 'Nov', valor: 1790.00 },
  { label: 'Dez', valor: 1890.00 },
  { label: 'Jan', valor: 2100.00 },
  { label: 'Fev', valor: 1950.00 },
  { label: 'Mar', valor: 2450.00 },
  { label: 'Abr', valor: 2700.00 },
  { label: 'Mai', valor: 2890.00 }
];

let chartFinanceiro = null;

function inicializarGrafico() {
  const selectPeriodo = document.getElementById('select-periodo-grafico');
  
  function desenharGrafico(mesesLimit) {
    const chartEl = document.getElementById('chart-financeiro');
    if (!chartEl) return;
    const ctx = chartEl.getContext('2d');
    
    // Filtra os dados com base nos meses selecionados (3, 6 ou 12)
    const dadosExibidos = dadosFaturamento.slice(-mesesLimit);
    const labels = dadosExibidos.map(d => d.label);
    const valores = dadosExibidos.map(d => d.valor);

    if (chartFinanceiro) {
      chartFinanceiro.destroy();
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(232, 84, 94, 0.3)');
    gradient.addColorStop(1, 'rgba(232, 84, 94, 0.0)');

    chartFinanceiro = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Faturamento Mensal (R$)',
          data: valores,
          borderColor: '#E8545E',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#972B32',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `Faturamento: R$ ${context.parsed.y.toFixed(2).replace('.', ',')}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                family: 'Plus Jakarta Sans',
                size: 11
              },
              color: '#5B6169'
            }
          },
          y: {
            grid: {
              color: 'rgba(229, 231, 235, 0.5)'
            },
            ticks: {
              font: {
                family: 'Plus Jakarta Sans',
                size: 11
              },
              color: '#5B6169',
              callback: function(value) {
                return 'R$ ' + value;
              }
            }
          }
        }
      }
    });
  }

  // Escuta alteração do período
  selectPeriodo.addEventListener('change', (e) => {
    desenharGrafico(parseInt(e.target.value));
  });

  // Inicializa o gráfico com o período padrão (6 meses)
  desenharGrafico(parseInt(selectPeriodo.value));
}

// =====================================================
// INICIALIZAÇÃO DA PÁGINA
// =====================================================

async function init() {
  try {
    pagamentos = await db.getPagamentos();
    atualizarCardsFinanceiros();
    inicializarOrdenacao();
    aplicarFiltros(); 
    inicializarGrafico();
    
    // Atualiza contagem de alunos no badge da sidebar
    const sidebarBadge = document.querySelector('.sidebar-nav a[href*="Alunos.html"] .nav-badge');
    if (sidebarBadge) {
      const listAlunos = await db.getAlunos();
      sidebarBadge.textContent = listAlunos.length;
    }
  } catch (e) {
    console.error("Erro na inicialização da tela de pagamentos:", e);
  }
}

init();
