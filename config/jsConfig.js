// =====================================================
// INICIALIZAÇÃO E CONTROLE DE ABAS (FastAPI)
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
  let loggedUser = null;
  try {
    const u = localStorage.getItem('wpa_usuario_logado');
    if (u) loggedUser = JSON.parse(u);
  } catch (e) {}

  const userRole = ((loggedUser && (loggedUser.nivel || loggedUser.perfil)) || '').toLowerCase();
  const isAdmin = userRole === 'administrador' || userRole === 'admin';

  // Ocultar e remover a aba de Segurança e Auditoria caso o usuário não seja Administrador
  if (loggedUser && !isAdmin) {
    const btnSeguranca = document.querySelector('.tab-nav-btn[data-target="tab-seguranca"]');
    if (btnSeguranca) {
      btnSeguranca.style.display = 'none';
    }
    const paneSeguranca = document.getElementById('tab-seguranca');
    if (paneSeguranca) {
      paneSeguranca.remove();
    }
  }

  const tabButtons = document.querySelectorAll('.tab-nav-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Navegação entre abas
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const target = btn.dataset.target;
      document.getElementById(target).classList.add('active');
    });
  });

  // Carrega as configurações nos formulários
  await carregarConfiguracoes();
  // Carrega as sessões e logs de auditoria
  await carregarLogs();
  carregarSessoes();

  // Se for administrador, carrega as solicitações de acesso pendentes e gerenciamento de operadores
  if (loggedUser && isAdmin) {
    const sectionSolicitacoes = document.getElementById('section-solicitacoes');
    if (sectionSolicitacoes) {
      sectionSolicitacoes.style.display = 'block';
    }
    await carregarSolicitacoes();

    const sectionOperadores = document.getElementById('section-operadores');
    if (sectionOperadores) {
      sectionOperadores.style.display = 'block';
    }
    await carregarOperadores();

    // Inicializa listeners do modal de alterar senha do operador
    inicializarModalSenhaOperador();
  }

  // Atualiza contagem de alunos no badge da sidebar
  try {
    const listAlunos = await db.getAlunos();
    const sidebarBadge = document.querySelector('.sidebar-nav a[href*="Alunos.html"] .nav-badge');
    if (sidebarBadge) {
      sidebarBadge.textContent = listAlunos.length;
    }
  } catch (e) {
    console.error(e);
  }
});

// =====================================================
// TOAST NOTIFICATIONS
// =====================================================

function mostrarToast(mensagem, tipo = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-mensagem');
  const toastIcon = document.getElementById('toast-icone');

  toastMsg.textContent = mensagem;

  if (tipo === 'error') {
    toast.style.background = 'var(--ausente)';
    toastIcon.className = 'fa-solid fa-circle-exclamation';
  } else {
    toast.style.background = 'var(--ativo)';
    toastIcon.className = 'fa-solid fa-circle-check';
  }

  toast.classList.add('visivel');
  setTimeout(() => {
    toast.classList.remove('visivel');
  }, 3500);
}

// =====================================================
// CARREGAR E SALVAR CONFIGURAÇÕES
// =====================================================

async function carregarConfiguracoes() {
  try {
    const config = await db.getConfiguracoes();
    if (!config) return;

    // Aba Geral
    document.getElementById('cfg-nome').value = config.nomeAcademia || '';
    document.getElementById('cfg-whatsapp').value = config.whatsapp || '';
    document.getElementById('cfg-logo').value = config.logo || '';
    document.getElementById('cfg-endereco').value = config.endereco || '';

    // Aba Notificações
    document.getElementById('cfg-dias-aviso').value = config.diasNotificacaoVencimento || 3;
    document.getElementById('cfg-msg-template').value = config.templateMensagem || '';
    
    // Atualiza a pré-visualização da mensagem
    atualizarPreviewMensagem();

    // Aba Pagamento (Pix)
    document.getElementById('cfg-pix-tipo').value = config.tipoChavePix || 'cnpj';
    document.getElementById('cfg-pix-chave').value = config.chavePix || '';
    document.getElementById('cfg-pix-beneficiario').value = config.beneficiarioPix || '';
    document.getElementById('cfg-pix-cidade').value = config.cidadePix || '';

    // Atualiza o Pix QR Code
    atualizarPixQRCode();
  } catch (e) {
    console.error("Erro ao carregar configurações:", e);
  }
}

// Ouvintes de envio de formulários
document.getElementById('form-config-geral').addEventListener('submit', async function (e) {
  e.preventDefault();
  try {
    const config = await db.getConfiguracoes();
    
    config.nomeAcademia = document.getElementById('cfg-nome').value.trim();
    config.whatsapp = document.getElementById('cfg-whatsapp').value.trim();
    config.logo = document.getElementById('cfg-logo').value.trim();
    config.endereco = document.getElementById('cfg-endereco').value.trim();

    await db.saveConfiguracoes(config);
    mostrarToast('Configurações gerais salvas com sucesso!');

    // Atualiza os elementos locais da sidebar dinamicamente
    const logoImg = document.querySelector('.sidebar-logo-icon img');
    if (logoImg && config.logo) {
      let logoPath = config.logo;
      const isRoot = !['alunos', 'painel', 'planos', 'pagamentos', 'config', 'perfil'].some(folder => window.location.pathname.toLowerCase().includes(folder));
      if (isRoot && logoPath.startsWith('../')) {
        logoPath = logoPath.substring(3);
      } else if (!isRoot && !logoPath.startsWith('../') && !logoPath.startsWith('http') && !logoPath.startsWith('data:')) {
        logoPath = '../' + logoPath;
      }
      logoImg.src = logoPath;
    }
    const logoText = document.querySelector('.sidebar-logo-text');
    if (logoText && config.nomeAcademia) {
      const partes = config.nomeAcademia.split(' ');
      const first = partes[0] || '';
      const rest = partes.slice(1).join(' ') || '';
      logoText.innerHTML = `<strong>${first}</strong><span>${rest}</span>`;
    }
  } catch (err) {
    console.error(err);
    mostrarToast('Erro ao salvar configurações gerais.', 'error');
  }
});

document.getElementById('form-config-notif').addEventListener('submit', async function (e) {
  e.preventDefault();
  try {
    const config = await db.getConfiguracoes();
    
    config.diasNotificacaoVencimento = parseInt(document.getElementById('cfg-dias-aviso').value);
    config.templateMensagem = document.getElementById('cfg-msg-template').value;

    await db.saveConfiguracoes(config);
    mostrarToast('Preferências de notificação salvas!');
  } catch (err) {
    console.error(err);
    mostrarToast('Erro ao salvar preferências de notificação.', 'error');
  }
});

document.getElementById('form-config-pix').addEventListener('submit', async function (e) {
  e.preventDefault();
  try {
    const config = await db.getConfiguracoes();
    
    config.tipoChavePix = document.getElementById('cfg-pix-tipo').value;
    config.chavePix = document.getElementById('cfg-pix-chave').value.trim();
    config.beneficiarioPix = document.getElementById('cfg-pix-beneficiario').value.trim();
    config.cidadePix = document.getElementById('cfg-pix-cidade').value.trim();

    await db.saveConfiguracoes(config);
    atualizarPixQRCode();
    mostrarToast('Configurações do Pix salvas e QR Code atualizado!');
  } catch (err) {
    console.error(err);
    mostrarToast('Erro ao salvar configurações do Pix.', 'error');
  }
});

// =====================================================
// PRÉ-VISUALIZAÇÃO DE MENSAGEM DO WHATSAPP
// =====================================================

const textareaTemplate = document.getElementById('cfg-msg-template');
const inputDiasAviso = document.getElementById('cfg-dias-aviso');

function atualizarPreviewMensagem() {
  const template = textareaTemplate.value;
  const dias = inputDiasAviso.value || '3';
  
  let msg = template
    .replace(/{nome}/g, '*Ana Beatriz*')
    .replace(/{plano}/g, '*Mensal*')
    .replace(/{dias}/g, dias)
    .replace(/{vencimento}/g, '*28/05/2026*');

  // Formata negrito do whatsapp para HTML
  msg = msg.replace(/\*(.*?)\*/g, '<strong>$1</strong>');

  document.getElementById('preview-mensagem-corpo').innerHTML = msg;
}

textareaTemplate.addEventListener('input', atualizarPreviewMensagem);
inputDiasAviso.addEventListener('input', atualizarPreviewMensagem);

// =====================================================
// SIMULADOR DE PAYLOAD E QR CODE PIX (EMV BR CODE)
// =====================================================

const inputValorTeste = document.getElementById('cfg-pix-teste-valor');
inputValorTeste.addEventListener('input', atualizarPixQRCode);

function generatePixPayload(key, tipo, beneficiario, cidade, valor) {
  function formatField(id, val) {
    const len = String(val.length).padStart(2, '0');
    return `${id}${len}${val}`;
  }

  let chaveLimpa = key;
  if (tipo === 'celular') {
    chaveLimpa = '+55' + key.replace(/\D/g, ''); 
  } else if (tipo === 'cpf' || tipo === 'cnpj') {
    chaveLimpa = key.replace(/\D/g, ''); 
  }

  let payload = '';
  payload += formatField('00', '01');
  payload += formatField('01', '11');

  const gui = formatField('00', 'br.gov.bcb.pix');
  const keyField = formatField('01', chaveLimpa);
  const merchantAccountInfo = formatField('26', gui + keyField);
  payload += merchantAccountInfo;

  payload += formatField('52', '0000');
  payload += formatField('53', '986');

  if (valor > 0) {
    payload += formatField('54', valor.toFixed(2));
  }

  payload += formatField('58', 'BR');
  
  const removeAcentos = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const nomeBenef = removeAcentos(beneficiario).substring(0, 25);
  const cidadeBenef = removeAcentos(cidade).substring(0, 15);

  payload += formatField('59', nomeBenef);
  payload += formatField('60', cidadeBenef);
  
  const txidField = formatField('05', '***');
  payload += formatField('62', txidField);

  payload += '6304';

  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    let x = ((crc >> 8) ^ payload.charCodeAt(i)) & 0xFF;
    x ^= x >> 4;
    crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xFFFF;
  }
  const crcHex = crc.toString(16).toUpperCase().padStart(4, '0');

  return payload + crcHex;
}

function atualizarPixQRCode() {
  const chave = document.getElementById('cfg-pix-chave').value.trim();
  const tipo = document.getElementById('cfg-pix-tipo').value;
  const benef = document.getElementById('cfg-pix-beneficiario').value.trim();
  const cidade = document.getElementById('cfg-pix-cidade').value.trim();
  const valor = parseFloat(inputValorTeste.value) || 0;

  const qrImg = document.getElementById('pix-qr-img');
  const qrPlaceholder = document.getElementById('pix-qr-placeholder');
  const payloadInput = document.getElementById('pix-emv-payload');

  if (!chave || !benef || !cidade) {
    if (qrImg) qrImg.style.display = 'none';
    if (qrPlaceholder) qrPlaceholder.style.display = 'flex';
    if (payloadInput) payloadInput.value = '';
    return;
  }

  const payload = generatePixPayload(chave, tipo, benef, cidade, valor);
  if (payloadInput) payloadInput.value = payload;

  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payload)}`;
    qrImg.style.display = 'block';
  }
  if (qrPlaceholder) qrPlaceholder.style.display = 'none';
}

document.getElementById('btn-copy-pix').addEventListener('click', function () {
  const payloadVal = document.getElementById('pix-emv-payload').value;
  if (!payloadVal) return;

  navigator.clipboard.writeText(payloadVal).then(() => {
    mostrarToast('Código Pix Copia e Cola copiado!');
  }).catch(() => {
    mostrarToast('Erro ao copiar código.', 'error');
  });
});

// =====================================================
// EXPORTAR E IMPORTAR BACKUP
// =====================================================

document.getElementById('btn-export-db').addEventListener('click', async () => {
  try {
    const backupData = {
      planos: await db.getPlanos(),
      alunos: await db.getAlunos(),
      pagamentos: await db.getPagamentos(),
      configuracoes: await db.getConfiguracoes(),
      logs: await db.getLogs()
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    const dataFormatada = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `wpa_backup_academia_${dataFormatada}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    mostrarToast('Backup do banco exportado com sucesso!');
  } catch (err) {
    console.error(err);
    mostrarToast('Erro ao exportar backup.', 'error');
  }
});

const fileInput = document.getElementById('cfg-backup-file');
const filenameDisplay = document.getElementById('cfg-backup-filename');
const btnImport = document.getElementById('btn-import-db');

if (fileInput) {
  fileInput.addEventListener('change', function () {
    if (this.files.length > 0) {
      filenameDisplay.textContent = this.files[0].name;
      btnImport.disabled = false;
    } else {
      filenameDisplay.textContent = 'Nenhum arquivo selecionado';
      btnImport.disabled = true;
    }
  });
}

if (btnImport) {
  btnImport.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const backupData = JSON.parse(e.target.result);
        btnImport.disabled = true;
        btnImport.textContent = 'Importando...';

        await window.api.request("/configuracoes/importar", "POST", backupData);
        
        mostrarToast('Backup importado com sucesso! Recarregando dados...', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err) {
        console.error(err);
        mostrarToast('Erro ao importar backup: ' + (err.message || err), 'error');
        btnImport.disabled = false;
        btnImport.textContent = 'Restaurar Backup';
      }
    };
    reader.readAsText(file);
  });
}

// =====================================================
// SEGURANÇA E AUDITORIA (LOGS REAIS & MOCK DE SESSÕES)
// =====================================================

async function carregarLogs() {
  try {
    const logs = await db.getLogs();
    const tbody = document.getElementById('tabela-logs');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-3); padding: var(--sp-4);">Nenhum log de auditoria registrado.</td></tr>`;
      return;
    }

    function formatarDataHoraLog(dataISO) {
      const data = new Date(dataISO);
      if (isNaN(data)) return '—';
      const dia = String(data.getDate()).padStart(2, '0');
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const ano = data.getFullYear();
      const hora = String(data.getHours()).padStart(2, '0');
      const min = String(data.getMinutes()).padStart(2, '0');
      return `${dia}/${mes}/${ano} ${hora}:${min}`;
    }

    logs.forEach(log => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="white-space: nowrap; padding: 10px 12px; font-weight: 500;">${formatarDataHoraLog(log.data)}</td>
        <td style="white-space: nowrap; padding: 10px 12px; color: var(--text-2); font-weight: 600;">${log.usuario}</td>
        <td style="white-space: nowrap; padding: 10px 12px;"><span class="status-badge status-pausa" style="font-size: 10px; padding: 2px 6px; font-weight: 600; text-transform: uppercase;">${log.acao}</span></td>
        <td style="padding: 10px 12px; color: var(--text-2); max-width: 300px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${log.detalhe}">${log.detalhe}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Erro ao carregar logs:", err);
  }
}

document.getElementById('btn-clear-logs').addEventListener('click', () => {
  mostrarToast('Os logs de auditoria são imutáveis e não podem ser apagados pelo operador.', 'error');
});

// Mock de Sessões Ativas (para fins estéticos de auditoria local)
let sessoesAtivas = [
  {
    id: 1,
    atual: true,
    browser: 'Chrome 125 · Windows 11',
    ip: '189.121.22.45',
    login: 'Conectado agora',
    deviceIcon: 'fa-solid fa-desktop'
  },
  {
    id: 2,
    atual: false,
    browser: 'Safari Mobile · iPhone 15 Pro',
    ip: '177.89.231.102',
    login: 'Conectado em 28/05/2026 às 14:32',
    deviceIcon: 'fa-solid fa-mobile-screen-button'
  }
];

function carregarSessoes() {
  const container = document.getElementById('sessions-container');
  if (!container) return;
  container.innerHTML = '';

  sessoesAtivas.forEach(s => {
    const item = document.createElement('div');
    item.className = 'session-item';
    
    const badgeHtml = s.atual ? `<span class="session-status-badge">Sessão Atual</span>` : '';
    const btnHtml = s.atual ? '' : `<button type="button" class="btn-terminate-session" onclick="revogarSessao(${s.id})">Terminar Sessão</button>`;

    item.innerHTML = `
      <div class="session-info-box">
        <i class="${s.deviceIcon} session-device-icon"></i>
        <div class="session-details">
          <h4>${s.browser} ${badgeHtml}</h4>
          <p>IP: ${s.ip} · ${s.login}</p>
        </div>
      </div>
      ${btnHtml}
    `;

    container.appendChild(item);
  });
}

window.revogarSessao = function(id) {
  const sessao = sessoesAtivas.find(s => s.id === id);
  if (!sessao) return;

  if (confirm(`Tem certeza que deseja desconectar o dispositivo "${sessao.browser}" do sistema?`)) {
    sessoesAtivas = sessoesAtivas.filter(s => s.id !== id);
    carregarSessoes();
    mostrarToast('Sessão encerrada com sucesso!');
  }
};

// Carregar solicitações de operadores pendentes de aprovação
async function carregarSolicitacoes() {
  try {
    const users = await db.getUsuarios(true); // Busca incluindo os inativos
    const pendingUsers = users.filter(u => u.ativo === false || !u.ativo);
    const tbody = document.getElementById('tabela-solicitacoes');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (pendingUsers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-3); padding: var(--sp-4); font-weight: 500;">Nenhuma solicitação de acesso pendente.</td></tr>`;
      return;
    }

    pendingUsers.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding: 12px; color: var(--text-1); font-weight: 600;">${u.nome}</td>
        <td style="padding: 12px; color: var(--text-2); font-weight: 500;">${u.login}</td>
        <td style="padding: 12px; color: var(--text-2);">${u.email || '—'}</td>
        <td style="padding: 12px;">
          <select class="select-field" id="select-role-${u.id}" style="width: 140px; padding: 4px var(--sp-3); font-size: 12px; height: auto; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface); color: var(--text-1);">
            <option value="Secretaria" selected>Secretaria</option>
            <option value="Gerente Geral">Gerente Geral</option>
            <option value="Administrador">Administrador</option>
          </select>
        </td>
        <td style="padding: 12px; text-align: center; display: flex; gap: 8px; justify-content: center; align-items: center;">
          <button type="button" class="btn-novo-aluno" onclick="confirmarAprovacao(${u.id}, '${u.nome}')" style="background: var(--ativo); padding: var(--sp-2) var(--sp-3); font-size: 11px; height: auto; margin-top: 0; box-shadow: var(--shadow-sm);">
            <i class="fa-solid fa-check"></i> Aprovar
          </button>
          <button type="button" class="btn-novo-aluno" onclick="confirmarRejeicao(${u.id}, '${u.nome}')" style="background: var(--ausente); padding: var(--sp-2) var(--sp-3); font-size: 11px; height: auto; margin-top: 0; box-shadow: var(--shadow-sm);">
            <i class="fa-solid fa-xmark"></i> Rejeitar
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Erro ao carregar solicitações de operadores:", err);
  }
}

window.confirmarAprovacao = async function(id, nome) {
  const selectRole = document.getElementById(`select-role-${id}`);
  const perfil = selectRole ? selectRole.value : "Secretaria";
  
  if (confirm(`Tem certeza que deseja aprovar o acesso do operador "${nome}" com o nível "${perfil}"?`)) {
    try {
      await db.aprovarUsuario(id, perfil);
      mostrarToast(`Acesso de ${nome} aprovado com sucesso!`);
      // Recarrega as tabelas na tela
      await carregarSolicitacoes();
      await carregarLogs();
    } catch (err) {
      console.error(err);
      mostrarToast("Erro ao aprovar operador: " + err.message, "error");
    }
  }
};

window.confirmarRejeicao = async function(id, nome) {
  if (confirm(`Tem certeza que deseja rejeitar e excluir a solicitação de acesso de "${nome}"?`)) {
    try {
      await db.rejeitarUsuario(id);
      mostrarToast(`Solicitação de ${nome} rejeitada e excluída.`);
      // Recarrega as tabelas na tela
      await carregarSolicitacoes();
      await carregarLogs();
    } catch (err) {
      console.error(err);
      mostrarToast("Erro ao rejeitar operador: " + err.message, "error");
    }
  }
};

// =====================================================
// GERENCIAMENTO AVANÇADO DE OPERADORES (SUPER ADMIN)
// =====================================================

let listaAcademias = [];

async function carregarOperadores() {
  try {
    const users = await db.getUsuarios(true); // Busca incluindo os inativos
    const activeUsers = users.filter(u => u.ativo === true || u.ativo);
    const tbody = document.getElementById('tabela-operadores');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (activeUsers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-3); padding: var(--sp-4); font-weight: 500;">Nenhum operador cadastrado.</td></tr>`;
      return;
    }

    // Carrega as academias se ainda não carregou
    if (listaAcademias.length === 0) {
      try {
        listaAcademias = await db.getAcademias();
      } catch (e) {
        console.error("Erro ao obter lista de academias:", e);
      }
    }

    activeUsers.forEach(u => {
      // Perfil Select Dropdown
      const selectPerfilHtml = `
        <select class="select-field" id="op-perfil-${u.id}" style="width: 130px; padding: 4px var(--sp-3); font-size: 12px; height: auto; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface); color: var(--text-1);">
          <option value="Secretaria" ${u.perfil === 'Secretaria' ? 'selected' : ''}>Secretaria</option>
          <option value="Gerente Geral" ${u.perfil === 'Gerente Geral' ? 'selected' : ''}>Gerente Geral</option>
          <option value="Administrador" ${u.perfil === 'Administrador' ? 'selected' : ''}>Administrador</option>
        </select>
      `;

      // Academia Select Dropdown
      let optionsAcad = '';
      listaAcademias.forEach(ac => {
        optionsAcad += `<option value="${ac.id}" ${u.academia_id === ac.id ? 'selected' : ''}>${ac.nome}</option>`;
      });
      const selectAcadHtml = `
        <select class="select-field" id="op-academia-${u.id}" style="width: 160px; padding: 4px var(--sp-3); font-size: 12px; height: auto; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface); color: var(--text-1);">
          ${optionsAcad}
        </select>
      `;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding: 12px; color: var(--text-1); font-weight: 600;">${u.nome}</td>
        <td style="padding: 12px; color: var(--text-2); font-weight: 500;">${u.login}</td>
        <td style="padding: 12px; color: var(--text-2);">${u.email || '—'}</td>
        <td style="padding: 12px;">${selectPerfilHtml}</td>
        <td style="padding: 12px;">${selectAcadHtml}</td>
        <td style="padding: 12px; text-align: center; display: flex; gap: 8px; justify-content: center; align-items: center;">
          <button type="button" class="btn-novo-aluno" onclick="salvarAlteracoesOperador(${u.id}, '${u.nome}')" style="background: var(--ativo); padding: var(--sp-2) var(--sp-3); font-size: 11px; height: auto; margin-top: 0; box-shadow: var(--shadow-sm);" title="Salvar Alterações">
            <i class="fa-solid fa-floppy-disk"></i> Salvar
          </button>
          <button type="button" class="btn-novo-aluno" onclick="abrirModalSenhaOperador('${u.uuid}', '${u.nome}')" style="background: var(--aguardando); padding: var(--sp-2) var(--sp-3); font-size: 11px; height: auto; margin-top: 0; box-shadow: var(--shadow-sm);" title="Definir Senha">
            <i class="fa-solid fa-key"></i> Senha
          </button>
          <button type="button" class="btn-novo-aluno" onclick="confirmarExclusaoOperador(${u.id}, '${u.nome}')" style="background: var(--ausente); padding: var(--sp-2) var(--sp-3); font-size: 11px; height: auto; margin-top: 0; box-shadow: var(--shadow-sm);" title="Excluir Operador">
            <i class="fa-solid fa-trash-can"></i> Excluir
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Erro ao carregar operadores:", err);
  }
}

window.salvarAlteracoesOperador = async function(id, nome) {
  const selectPerfil = document.getElementById(`op-perfil-${id}`);
  const selectAcademia = document.getElementById(`op-academia-${id}`);
  
  const perfil = selectPerfil ? selectPerfil.value : "Secretaria";
  const academiaId = selectAcademia ? parseInt(selectAcademia.value) : null;

  if (confirm(`Deseja salvar as alterações do operador "${nome}"?\nO novo perfil e academia serão sincronizados para o próximo login.`)) {
    try {
      await db.atualizarUsuario(id, perfil, academiaId);
      mostrarToast(`Operador ${nome} atualizado com sucesso!`);
      await carregarOperadores();
      await carregarLogs();
    } catch (err) {
      console.error(err);
      mostrarToast("Erro ao atualizar operador: " + err.message, "error");
    }
  }
};

window.confirmarExclusaoOperador = async function(id, nome) {
  if (confirm(`Tem certeza que deseja excluir permanentemente o operador "${nome}"?\nEsta ação desvinculará sua conta e removerá suas credenciais de login.`)) {
    try {
      await db.excluirUsuario(id);
      mostrarToast(`Operador ${nome} excluído com sucesso.`);
      await carregarOperadores();
      await carregarLogs();
    } catch (err) {
      console.error(err);
      mostrarToast("Erro ao excluir operador: " + err.message, "error");
    }
  }
};

window.abrirModalSenhaOperador = function(uuid, nome) {
  const modal = document.getElementById('modal-senha-operador-overlay');
  const nomeEl = document.getElementById('modal-senha-nome-operador');
  const uuidEl = document.getElementById('modal-senha-uuid-operador');
  
  if (modal && nomeEl && uuidEl) {
    nomeEl.textContent = nome;
    uuidEl.value = uuid;
    modal.classList.add('aberto');
    modal.style.display = 'flex';
    document.getElementById('modal-senha-nova').value = '';
    document.getElementById('modal-senha-confirmar').value = '';
    document.body.style.overflow = 'hidden';
  }
};

window.fecharModalSenhaOperador = function() {
  const modal = document.getElementById('modal-senha-operador-overlay');
  if (modal) {
    modal.classList.remove('aberto');
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
};

function inicializarModalSenhaOperador() {
  const btnCancelSenha = document.getElementById('btn-cancelar-senha-operador');
  if (btnCancelSenha) {
    btnCancelSenha.addEventListener('click', fecharModalSenhaOperador);
  }

  const formSenha = document.getElementById('form-alterar-senha-operador');
  if (formSenha) {
    // Evita múltiplos registros de submit clonando e substituindo o form
    const newForm = formSenha.cloneNode(true);
    formSenha.parentNode.replaceChild(newForm, formSenha);
    
    newForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const uuid = document.getElementById('modal-senha-uuid-operador').value;
      const senha = document.getElementById('modal-senha-nova').value;
      const confirmar = document.getElementById('modal-senha-confirmar').value;

      if (!uuid || uuid === "null" || uuid === "undefined" || uuid === "") {
        mostrarToast("Erro: Este operador não possui uma conta vinculada ao Supabase Auth (ex: foi criado antes da integração). Não é possível alterar a senha.", "error");
        return;
      }

      if (senha.length < 6) {
        mostrarToast("A senha deve conter no mínimo 6 caracteres.", "error");
        return;
      }

      if (senha !== confirmar) {
        mostrarToast("As senhas não coincidem. Tente novamente.", "error");
        return;
      }

      try {
        await db.alterarSenhaUsuario(uuid, senha);
        mostrarToast("Senha alterada com sucesso!");
        fecharModalSenhaOperador();
        await carregarLogs();
      } catch (err) {
        console.error(err);
        mostrarToast("Erro ao alterar senha: " + err.message, "error");
      }
    });

    // Ligar olho para mostrar/ocultar senha no modal
    const modalTogglePasswordBtns = newForm.querySelectorAll('.btn-toggle-password');
    modalTogglePasswordBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = btn.parentElement.querySelector("input");
        const icon = btn.querySelector("i");

        if (input.type === "password") {
          input.type = "text";
          icon.classList.remove("fa-eye");
          icon.classList.add("fa-eye-slash");
        } else {
          input.type = "password";
          icon.classList.remove("fa-eye-slash");
          icon.classList.add("fa-eye");
        }
      });
    });
  }
}
