document.addEventListener('DOMContentLoaded', async () => {
  // Carrega os dados do usuário na inicialização
  carregarDadosPerfil();

  // Ouvinte do formulário de dados
  document.getElementById('form-perfil-dados').addEventListener('submit', async function (e) {
    e.preventDefault();
    await salvarDadosPerfil();
  });

  // Ouvinte do formulário de senha
  document.getElementById('form-perfil-senha').addEventListener('submit', async function (e) {
    e.preventDefault();
    await alterarSenhaPerfil();
  });

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
// TOAST NOTIFICATION
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
// CARREGAR DADOS DO PERFIL
// =====================================================

function carregarDadosPerfil() {
  let user = null;
  try {
    const u = localStorage.getItem('wpa_usuario_logado');
    if (u) user = JSON.parse(u);
  } catch (e) {}
  if (!user) {
    // Redireciona para o login caso não tenha sessão ativa
    window.location.href = '../index.html';
    return;
  }

  // Popula os campos do formulário
  document.getElementById('perf-nome').value = user.nome || '';
  document.getElementById('perf-email').value = user.email || '';
  document.getElementById('perf-nivel').value = user.nivel || 'Secretaria';

  // Popula o cartão de informações de perfil
  document.getElementById('perf-nome-cabecalho').textContent = user.nome || '';
  document.getElementById('perf-email-cabecalho').textContent = user.email || '';
  
  const avatarLetra = user.avatar || (user.nome ? user.nome.charAt(0).toUpperCase() : 'C');
  document.getElementById('perf-avatar-largo').textContent = avatarLetra;

  // Renderiza a badge do nível de acesso correspondente
  const badgeCargo = document.getElementById('perf-badge-cargo');
  if (badgeCargo) {
    const userRoleStr = user.nivel || user.perfil || 'Administrador';
    const roleLower = userRoleStr.toLowerCase();
    badgeCargo.textContent = roleLower.includes('admin') ? 'Administrador' : userRoleStr;
    badgeCargo.className = 'user-level-badge'; // Reseta classes antigas
    
    if (roleLower.includes('admin')) {
      badgeCargo.classList.add('badge-administrador');
    } else if (roleLower.includes('gerente')) {
      badgeCargo.classList.add('badge-gerente');
    } else {
      badgeCargo.classList.add('badge-secretaria');
    }
  }
}

// =====================================================
// SALVAR DADOS DO PERFIL
// =====================================================

async function salvarDadosPerfil() {
  let user = null;
  try {
    const u = localStorage.getItem('wpa_usuario_logado');
    if (u) user = JSON.parse(u);
  } catch (e) {}
  if (!user) return;

  const novoNome = document.getElementById('perf-nome').value.trim();
  const novoEmail = document.getElementById('perf-email').value.trim();

  if (!novoNome || !novoEmail) {
    mostrarToast('Por favor, preencha todos os campos.', 'error');
    return;
  }

  try {
    const userUpdated = await window.api.request("/auth/perfil", "PUT", {
      nome: novoNome,
      email: novoEmail
    });

    // Salva de volta no localStorage
    localStorage.setItem('wpa_usuario_logado', JSON.stringify(userUpdated));
    
    // Recarrega os dados do perfil local
    carregarDadosPerfil();

    // Atualiza o widget de avatar do topo direito da tela na mesma página
    const avatarPlaceholder = document.querySelector('.user-profile-menu .user-avatar-placeholder');
    if (avatarPlaceholder) {
      avatarPlaceholder.textContent = userUpdated.avatar;
    }

    mostrarToast('Dados de acesso salvos com sucesso!');
  } catch (err) {
    console.error(err);
    mostrarToast('Erro ao atualizar perfil: ' + err.message, 'error');
  }
}

// =====================================================
// ALTERAÇÃO DE SENHA (INTEGRAÇÃO REAL)
// =====================================================

async function alterarSenhaPerfil() {
  const senhaAtual = document.getElementById('perf-senha-atual').value;
  const senhaNova = document.getElementById('perf-senha-nova').value;
  const senhaConfirmar = document.getElementById('perf-senha-confirmar').value;

  if (!senhaAtual || !senhaNova || !senhaConfirmar) {
    mostrarToast('Por favor, preencha todos os campos de senha.', 'error');
    return;
  }

  // Validação simples de tamanho
  if (senhaNova.length < 4) {
    mostrarToast('A nova senha deve ter no mínimo 4 caracteres.', 'error');
    return;
  }

  // Confirmação de senha
  if (senhaNova !== senhaConfirmar) {
    mostrarToast('As senhas digitadas não coincidem.', 'error');
    return;
  }

  try {
    await window.api.request("/auth/senha", "PUT", {
      senha_atual: senhaAtual,
      senha_nova: senhaNova
    });
    
    // Limpa os campos de formulário de senha
    document.getElementById('form-perfil-senha').reset();

    mostrarToast('Senha atualizada com sucesso!');
  } catch (err) {
    console.error(err);
    mostrarToast('Erro ao atualizar senha: ' + err.message, 'error');
  }
}
