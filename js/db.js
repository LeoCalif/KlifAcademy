// =====================================================
// GERENCIADOR DE BANCO DE DADOS INTEGRADO (FastAPI)
// =====================================================

(function () {
  // Verifica se o usuário está autenticado nas páginas restritas (subpastas contendo /Tela)
  const token = localStorage.getItem('wpa_token');
  const user = localStorage.getItem('wpa_usuario_logado');
  const isLoginPage = !['/alunos/', '/painel/', '/planos/', '/pagamentos/', '/config/', '/perfil/'].some(folder => window.location.pathname.includes(folder));
  
  console.log("Checagem de Autenticação (db.js):", {
    token: token ? "Presente" : "Ausente",
    user: user ? "Presente" : "Ausente",
    pathname: window.location.pathname,
    isLoginPage: isLoginPage
  });

  if ((!token || !user) && !isLoginPage) {
    console.warn("Usuário não autenticado e tentando acessar página restrita. Redirecionando para login...");
    // Limpa qualquer dado residual
    localStorage.removeItem('wpa_token');
    localStorage.removeItem('wpa_usuario_logado');
    
    // Redireciona para o Index.html no diretório pai usando caminho relativo
    window.location.replace("../Index.html");
    return;
  }

  // Objeto global de Acesso
  window.db = {
    // Planos
    getPlanos: async function () {
      const data = await window.api.request("/planos", "GET");
      return data.map(p => ({
        ...p,
        duracao_dias: p.quantidade_dias
      }));
    },
    
    createPlano: async function (plano) {
      const body = {
        nome: plano.nome,
        valor: plano.valor,
        quantidade_dias: plano.duracao_dias,
        status: plano.status || "ativo",
        descricao: plano.descricao || null
      };
      const data = await window.api.request("/planos", "POST", body);
      return {
        ...data,
        duracao_dias: data.quantidade_dias
      };
    },

    updatePlano: async function (id, plano) {
      const body = {
        nome: plano.nome,
        valor: plano.valor,
        quantidade_dias: plano.duracao_dias,
        status: plano.status,
        descricao: plano.descricao || null
      };
      const data = await window.api.request(`/planos/${id}`, "PUT", body);
      return {
        ...data,
        duracao_dias: data.quantidade_dias
      };
    },

    // Alunos
    getAlunos: async function (status = null) {
      let endpoint = "/alunos";
      if (status) {
        endpoint += `?status=${status}`;
      }
      const data = await window.api.request(endpoint, "GET");
      return data.map(aluno => ({
        ...aluno,
        plano: aluno.plano_nome // Mapeia plano_nome -> plano
      }));
    },

    createAluno: async function (aluno) {
      let plano_id = null;
      if (aluno.plano) {
        const planos = await this.getPlanos();
        const p = planos.find(pl => pl.nome.toLowerCase() === aluno.plano.toLowerCase());
        if (p) plano_id = p.id;
      }
      const body = {
        nome: aluno.nome,
        cpf: aluno.cpf || null,
        data_nasc: aluno.data_nasc || null,
        sexo: aluno.sexo || null,
        telefone: aluno.telefone || null,
        whatsapp: aluno.whatsapp || aluno.telefone || null,
        email: aluno.email || null,
        cep: aluno.cep || null,
        rua: aluno.rua || null,
        numero: aluno.numero || null,
        bairro: aluno.bairro || null,
        cidade: aluno.cidade || null,
        estado: aluno.estado || null,
        status: aluno.status || "ativo",
        plano_id: plano_id,
        data_matricula: aluno.data_matricula,
        vencimento: aluno.vencimento || null,
        observacoes: aluno.observacoes || null
      };
      const data = await window.api.request("/alunos", "POST", body);
      return {
        ...data,
        plano: data.plano_nome
      };
    },

    updateAluno: async function (id, aluno) {
      let plano_id = null;
      if (aluno.plano) {
        const planos = await this.getPlanos();
        const p = planos.find(pl => pl.nome.toLowerCase() === aluno.plano.toLowerCase());
        if (p) plano_id = p.id;
      }
      const body = {
        nome: aluno.nome,
        cpf: aluno.cpf || null,
        data_nasc: aluno.data_nasc || null,
        sexo: aluno.sexo || null,
        telefone: aluno.telefone || null,
        whatsapp: aluno.whatsapp || aluno.telefone || null,
        email: aluno.email || null,
        cep: aluno.cep || null,
        rua: aluno.rua || null,
        numero: aluno.numero || null,
        bairro: aluno.bairro || null,
        cidade: aluno.cidade || null,
        estado: aluno.estado || null,
        plano_id: plano_id,
        observacoes: aluno.observacoes || null
      };
      const data = await window.api.request(`/alunos/${id}`, "PUT", body);
      return {
        ...data,
        plano: data.plano_nome
      };
    },

    alterarStatusAluno: async function (id, acao) {
      // acao: 'pausar', 'retomar', 'inativar'
      const data = await window.api.request(`/alunos/${id}/status?action=${acao}`, "PATCH");
      return {
        ...data,
        plano: data.plano_nome
      };
    },

    // Pagamentos
    getPagamentos: async function () {
      const data = await window.api.request("/pagamentos", "GET");
      return data.map(p => ({
        ...p,
        aluno: p.aluno_nome,
        aluno_whatsapp: p.alunos?.whatsapp || p.alunos?.telefone || null,
        plano: p.plano_nome,
        forma: p.forma_pagamento,
        data: p.criado_em, // Mapeia criado_em -> data
        operador: p.operador_nome
      }));
    },

    createPagamento: async function (pagamento) {
      let plano_id = pagamento.plano_id;
      if (!plano_id && pagamento.plano) {
        const planos = await this.getPlanos();
        const p = planos.find(pl => pl.nome.toLowerCase() === pagamento.plano.toLowerCase());
        if (p) plano_id = p.id;
      }
      
      const body = {
        aluno_id: pagamento.aluno_id,
        plano_id: plano_id,
        valor: pagamento.valor,
        forma_pagamento: pagamento.forma_pagamento,
        data_pagamento: pagamento.data_pagamento,
        novo_vencimento: pagamento.novo_vencimento,
        observacoes: pagamento.observacoes || null
      };
      
      const data = await window.api.request("/pagamentos", "POST", body);
      return {
        ...data,
        aluno: data.aluno_nome,
        plano: data.plano_nome,
        forma: data.forma_pagamento,
        data: data.criado_em,
        operador: data.operador_nome
      };
    },

    // Configurações
    getConfiguracoes: async function () {
      return await window.api.request("/configuracoes", "GET");
    },

    saveConfiguracoes: async function (config) {
      return await window.api.request("/configuracoes", "POST", config);
    },

    // Logs
    getLogs: async function (usuarioId = null) {
      let endpoint = "/logs";
      if (usuarioId) {
        endpoint += `?usuario_id=${usuarioId}`;
      }
      const data = await window.api.request(endpoint, "GET");
      return data.map(l => ({
        ...l,
        data: l.criado_em,
        usuario: l.usuario_nome,
        acao: l.acao,
        detalhe: l.descricao
      }));
    },

    getUsuarios: async function (incluirInativos = false) {
      let endpoint = "/usuarios";
      if (incluirInativos) {
        endpoint += "?incluir_inativos=true";
      }
      return await window.api.request(endpoint, "GET");
    },

    aprovarUsuario: async function (id, perfil) {
      return await window.api.request("/usuarios/aprovar", "POST", { id, perfil });
    },

    rejeitarUsuario: async function (id) {
      return await window.api.request("/usuarios/rejeitar", "POST", { id });
    },

    getAcademias: async function () {
      return await window.api.request("/academias", "GET");
    },

    atualizarUsuario: async function (id, perfil, academiaId) {
      return await window.api.request("/usuarios/atualizar", "POST", { id, perfil, academia_id: academiaId });
    },

    alterarSenhaUsuario: async function (uuid, senha) {
      return await window.api.request("/usuarios/alterar-senha", "POST", { uuid, senha });
    },

    excluirUsuario: async function (id) {
      return await window.api.request("/usuarios/excluir", "POST", { id });
    },

    addLog: async function (acao, detalhe) {
      // O back-end já registra logs de auditoria de forma automática nos endpoints
      console.log(`Log automático no back-end: ${acao} - ${detalhe}`);
    }
  };

  // Atualização automática da sidebar, relógio e perfil nas telas do sistema
  document.addEventListener('DOMContentLoaded', async () => {
    let config = null;
    try {
      config = await window.db.getConfiguracoes();
    } catch (e) {
      console.error("Erro ao carregar configurações na sidebar:", e);
    }

    if (config) {
      // 1. Atualizar logo da academia na sidebar
      const logoImg = document.querySelector('.sidebar-logo-icon img');
      if (logoImg && config.logo) {
        let logoPath = config.logo;
        const isRoot = !['/alunos/', '/painel/', '/planos/', '/pagamentos/', '/config/', '/perfil/'].some(folder => window.location.pathname.includes(folder));
        if (isRoot && logoPath.startsWith('../')) {
          logoPath = logoPath.substring(3);
        } else if (!isRoot && !logoPath.startsWith('../') && !logoPath.startsWith('http') && !logoPath.startsWith('data:')) {
          logoPath = '../' + logoPath;
        }
        logoImg.src = logoPath;
      }

      // 2. Atualizar nome da academia na sidebar
      const logoText = document.querySelector('.sidebar-logo-text');
      if (logoText && config.nomeAcademia) {
        const partes = config.nomeAcademia.split(' ');
        const first = partes[0] || '';
        const rest = partes.slice(1).join(' ') || '';
        logoText.innerHTML = `<strong>${first}</strong><span>${rest}</span>`;
      }

      // 3. Atualizar badge de total de alunos no menu
      const links = document.querySelectorAll('.sidebar-nav a');
      for (const link of links) {
        if (link.textContent.includes('Alunos')) {
          let badge = link.querySelector('.nav-badge');
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'nav-badge';
            link.appendChild(badge);
          }
          try {
            const alunos = await window.db.getAlunos();
            badge.textContent = alunos.length;
          } catch (e) {
            console.error("Erro ao atualizar contador de alunos na sidebar:", e);
          }
        }
      }
    }

    // 4. Relógio e Data (se os elementos existirem)
    const clockTime = document.getElementById('clock-time');
    const clockDate = document.getElementById('clock-date');
    const greetingText = document.getElementById('greeting-text');

    if (clockTime || clockDate || greetingText) {
      const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
      const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      
      function atualizarTempo() {
        const agora = new Date();
        const horas = String(agora.getHours()).padStart(2, '0');
        const minutos = String(agora.getMinutes()).padStart(2, '0');
        const segundos = String(agora.getSeconds()).padStart(2, '0');
        
        if (clockTime) clockTime.textContent = `${horas}:${minutos}:${segundos}`;
        
        if (clockDate) {
          const diaSemanaStr = diasSemana[agora.getDay()];
          const diaNum = agora.getDate();
          const mesStr = meses[agora.getMonth()];
          const ano = agora.getFullYear();
          clockDate.textContent = `${diaSemanaStr}, ${diaNum} de ${mesStr} de ${ano}`;
        }
        
        if (greetingText) {
          const horaNum = agora.getHours();
          let saudacao = 'Bom dia';
          if (horaNum >= 12 && horaNum < 18) {
            saudacao = 'Boa tarde';
          } else if (horaNum >= 18 || horaNum < 5) {
            saudacao = 'Boa noite';
          }
          const userObj = JSON.parse(localStorage.getItem('wpa_usuario_logado'));
          const nomeExibicao = userObj ? userObj.nome.split(' ')[0] : 'Calif';
          greetingText.innerHTML = `${saudacao}, <strong>${nomeExibicao}</strong>!`;
        }
      }
      
      atualizarTempo();
      setInterval(atualizarTempo, 1000);
    }

    // 5. Menu do perfil com Dropdown
    const profileMenu = document.querySelector('.user-profile-menu');
    if (profileMenu) {
      const dropdown = profileMenu.querySelector('.profile-dropdown');
      
      // Carrega informações da sessão ativa
      const userObj = JSON.parse(localStorage.getItem('wpa_usuario_logado'));
      if (userObj) {
        const avatarPlaceholder = profileMenu.querySelector('.user-avatar-placeholder');
        if (avatarPlaceholder) {
          avatarPlaceholder.textContent = userObj.avatar || userObj.nome.charAt(0).toUpperCase();
        }
      }
      
      profileMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';
      });

      document.addEventListener('click', () => {
        if (dropdown) dropdown.style.display = 'none';
      });
      
      const btnLogout = dropdown.querySelector('.btn-logout');
      if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
          e.preventDefault();
          localStorage.removeItem('wpa_token');
          localStorage.removeItem('wpa_usuario_logado');
          const isRoot = !['/alunos/', '/painel/', '/planos/', '/pagamentos/', '/config/', '/perfil/'].some(folder => window.location.pathname.includes(folder));
          window.location.href = isRoot ? 'Index.html' : '../Index.html';
        });
      }
    }
  });
})();
