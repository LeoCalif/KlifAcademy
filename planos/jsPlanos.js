document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const tabelaPlanos = document.getElementById("tabela-planos");
  const filterBtns = document.querySelectorAll(".filter-btn");
  const inputBusca = document.getElementById("input-busca-plano");
  const tableCount = document.getElementById("table-count");
  const emptyState = document.getElementById("empty-state");

  const countTotalPlanos = document.getElementById("count-total-planos");
  const countPlanosAtivos = document.getElementById("count-planos-ativos");
  const labelPlanoPopular = document.getElementById("label-plano-popular");
  const countAlunosVinculados = document.getElementById("count-alunos-vinculados");

  const modalOverlay = document.getElementById("modal-plano-overlay");
  const btnFecharPlano = document.getElementById("btn-fechar-plano");
  const btnCancelarPlano = document.getElementById("btn-cancelar-plano");
  const formPlano = document.getElementById("form-plano");
  const btnNovoPlano = document.getElementById("btn-novo-plano");
  const modalTitulo = document.getElementById("modal-plano-titulo");

  const inputNome = document.getElementById("plano-nome");
  const inputValor = document.getElementById("plano-valor");
  const inputDuracao = document.getElementById("plano-duracao");
  const selectStatus = document.getElementById("plano-status");
  const inputDescricao = document.getElementById("plano-descricao");
  const textareaObservacoes = document.getElementById("plano-observacoes");

  // State
  let planos = [];
  let alunos = [];
  let currentEditId = null; // null = novo, number = editando/duplicando
  let currentFilter = "todos";
  let sortColuna = "alteracao";
  let sortOrdem = "desc";

  // --- FUNÇÕES DE CÁLCULO EM MEMÓRIA ---
  function getAlunosVinculadosCount(planoNome) {
    return alunos.filter(a => a.plano === planoNome && a.status !== 'inativo').length;
  }

  function getPlanoMaisUtilizado() {
    const contagem = {};
    let maisFrequente = 'Mensal';
    let maxCount = 0;

    alunos.forEach(a => {
      if (a.plano && a.status !== 'inativo') {
        contagem[a.plano] = (contagem[a.plano] || 0) + 1;
        if (contagem[a.plano] > maxCount) {
          maxCount = contagem[a.plano];
          maisFrequente = a.plano;
        }
      }
    });
    return maisFrequente;
  }

  // Inicializar dados
  async function carregarDados() {
    try {
      planos = await db.getPlanos() || [];
      alunos = await db.getAlunos() || [];
      atualizarCardsResumo();
      renderizarTabela();
      atualizarAlunosBadgeSidebar();
    } catch (err) {
      console.error(err);
      mostrarToast("Erro ao carregar dados do servidor.", "error");
    }
  }

  // Contagem de Alunos na Sidebar
  function atualizarAlunosBadgeSidebar() {
    const badge = document.getElementById("sidebar-alunos-count");
    if (badge) {
      badge.textContent = alunos.length;
    }
    const navBadge = document.querySelector('.sidebar-nav a[href*="Alunos.html"] .nav-badge');
    if (navBadge) {
      navBadge.textContent = alunos.length;
    }
  }

  // Cards de Resumo
  function atualizarCardsResumo() {
    const total = planos.length;
    const ativos = planos.filter(p => p.status === "ativo").length;
    const popular = getPlanoMaisUtilizado();
    
    // Contagem total de alunos vinculados a planos ativos (status !== inativo)
    const vinculados = alunos.filter(a => a.status !== "inativo" && a.plano).length;

    countTotalPlanos.textContent = total;
    countPlanosAtivos.textContent = ativos;
    labelPlanoPopular.textContent = popular || "Nenhum";
    countAlunosVinculados.textContent = vinculados;
  }

  // Formatar Data
  function formatarDataBR(dataISO) {
    if (!dataISO) return "—";
    const data = new Date(dataISO);
    if (isNaN(data)) return "—";
    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  // Renderizar Tabela
  function renderizarTabela() {
    tabelaPlanos.innerHTML = "";
    const termo = inputBusca.value.trim().toLowerCase();

    // Filtra dados
    const dadosFiltrados = planos.filter(p => {
      // Filtro de status
      const passaStatus = currentFilter === "todos" || p.status === currentFilter;
      
      // Filtro de busca (nome ou descrição)
      const nome = (p.nome || "").toLowerCase();
      const desc = (p.descricao || "").toLowerCase();
      const passaBusca = !termo || nome.includes(termo) || desc.includes(termo);

      return passaStatus && passaBusca;
    });

    if (dadosFiltrados.length === 0) {
      emptyState.classList.add("visible");
      tableCount.textContent = "0 planos";
      return;
    }

    emptyState.classList.remove("visible");
    tableCount.textContent = `${dadosFiltrados.length} planos`;

    // Ordena os dados filtrados
    const dadosOrdenados = ordenarDados(dadosFiltrados);

    dadosOrdenados.forEach(plano => {
      const tr = document.createElement("tr");

      // Contagem de alunos vinculados a este plano
      const vinculadosCount = getAlunosVinculadosCount(plano.nome);

      // Status badge
      let statusClasse = "status-ativo";
      let statusTexto = "Ativo";
      if (plano.status === "inativo") {
        statusClasse = "status-inativo";
        statusTexto = "Inativo";
      } else if (plano.status === "arquivado") {
        statusClasse = "status-arquivado";
        statusTexto = "Arquivado";
      }

      const statusBadge = `
        <span class="status-badge ${statusClasse}">
          <span class="status-dot"></span> ${statusTexto}
        </span>
      `;

      // Ações botões
      const btnToggleStatusHtml = plano.status === "ativo" 
        ? `<button class="action-btn btn-desativar" title="Desativar Plano" onclick="togglePlanoStatus(${plano.id})"><i class="fa-solid fa-eye-slash"></i></button>`
        : `<button class="action-btn btn-ativar" title="Ativar Plano" onclick="togglePlanoStatus(${plano.id})"><i class="fa-solid fa-eye"></i></button>`;

      const btnArquivarHtml = plano.status !== "arquivado"
        ? `<button class="action-btn" title="Arquivar Plano" onclick="arquivarPlano(${plano.id})"><i class="fa-solid fa-box-archive"></i></button>`
        : "";

      // Configura redirecionamento se houver alunos vinculados
      const clickRedirectAttr = vinculadosCount > 0 
        ? `style="cursor: pointer; text-decoration: underline;" onclick="window.location.href='../alunos/Alunos.html?filter=plano&planoNome=${encodeURIComponent(plano.nome)}'"`
        : '';

      const valorNum = parseFloat(plano.valor || 0);

      tr.innerHTML = `
        <td>
          <div class="aluno-nome">${plano.nome}</div>
          <div class="aluno-plano">${plano.descricao || "Sem descrição"}</div>
        </td>
        <td>${plano.duracao_dias} dias</td>
        <td style="font-weight: 600;">R$ ${valorNum.toFixed(2).replace(".", ",")}</td>
        <td>${statusBadge}</td>
        <td style="font-weight: 500;">
          <span class="table-count ${vinculadosCount > 0 ? "dias-ok" : "dias-neutro"}" ${clickRedirectAttr}>${vinculadosCount} alunos</span>
        </td>
        <td style="font-size: 12px; color: var(--text-2);">${formatarDataBR(plano.criado_em)}</td>
        <td class="action-icons">
          <button class="action-btn" title="Editar Plano" onclick="abrirEditarModal(${plano.id})"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="action-btn btn-duplicar" title="Duplicar Plano" onclick="duplicarPlano(${plano.id})"><i class="fa-solid fa-copy"></i></button>
          ${btnToggleStatusHtml}
          ${btnArquivarHtml}
        </td>
      `;

      tabelaPlanos.appendChild(tr);
    });
  }

  // --- FILTROS DE STATUS ---
  filterBtns.forEach(btn => {
    btn.addEventListener("click", function () {
      filterBtns.forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      currentFilter = this.dataset.filter;
      renderizarTabela();
    });
  });

  // Busca tempo real
  inputBusca.addEventListener("input", renderizarTabela);

  // --- MODAL CONTROLS ---
  function abrirModal(titulo) {
    modalTitulo.textContent = titulo;
    modalOverlay.classList.add("aberto");
    document.body.style.overflow = "hidden";
  }

  function fecharModal() {
    modalOverlay.classList.remove("aberto");
    document.body.style.overflow = "";
    formPlano.reset();
    currentEditId = null;
  }

  btnNovoPlano.addEventListener("click", () => {
    currentEditId = null;
    abrirModal("Novo Plano");
    selectStatus.value = "ativo";
  });

  btnFecharPlano.addEventListener("click", fecharModal);
  btnCancelarPlanro = btnCancelarPlano.addEventListener("click", fecharModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) fecharModal();
  });

  // --- AÇÕES DO JS (Expostas globalmente para chamadas nos inline event handlers) ---

  // 1. Editar Plano
  window.abrirEditarModal = function (id) {
    const plano = planos.find(p => p.id === id);
    if (!plano) return;

    currentEditId = id;
    
    // Preenche formulário
    inputNome.value = plano.nome;
    inputValor.value = plano.valor;
    inputDuracao.value = plano.duracao_dias;
    selectStatus.value = plano.status;
    inputDescricao.value = plano.descricao || "";
    if (textareaObservacoes) {
      textareaObservacoes.value = plano.observacoes || "";
    }

    abrirModal("Editar Plano");
  };

  // 2. Duplicar Plano
  window.duplicarPlano = function (id) {
    const plano = planos.find(p => p.id === id);
    if (!plano) return;

    currentEditId = null; // Como salvará como novo

    // Preenche com sufixo "Cópia"
    inputNome.value = plano.nome + " Cópia";
    inputValor.value = plano.valor;
    inputDuracao.value = plano.duracao_dias;
    selectStatus.value = "ativo"; // Duplicados iniciam ativos por padrão
    inputDescricao.value = plano.descricao || "";
    if (textareaObservacoes) {
      textareaObservacoes.value = plano.observacoes || "";
    }

    abrirModal("Duplicar Plano");
  };

  // 3. Ativar/Desativar Plano
  window.togglePlanoStatus = async function (id) {
    const plano = planos.find(p => p.id === id);
    if (!plano) return;

    const vinculadosCount = getAlunosVinculadosCount(plano.nome);

    try {
      if (plano.status === "ativo") {
        // Tentativa de desativar
        if (vinculadosCount > 0) {
          mostrarToast("Erro: Não é possível desativar planos com alunos vinculados!", "error");
          return;
        }
        plano.status = "inativo";
        await db.updatePlano(id, plano);
        mostrarToast(`Plano "${plano.nome}" desativado com sucesso.`);
      } else {
        // Reativação
        plano.status = "ativo";
        await db.updatePlano(id, plano);
        mostrarToast(`Plano "${plano.nome}" ativado com sucesso.`);
      }
      await carregarDados();
    } catch (err) {
      console.error(err);
      mostrarToast("Erro ao alterar status do plano.", "error");
    }
  };

  // 4. Arquivar Plano
  window.arquivarPlano = async function (id) {
    const plano = planos.find(p => p.id === id);
    if (!plano) return;

    const vinculadosCount = getAlunosVinculadosCount(plano.nome);

    if (vinculadosCount > 0) {
      mostrarToast("Erro: Não é possível arquivar planos com alunos vinculados!", "error");
      return;
    }

    try {
      plano.status = "arquivado";
      await db.updatePlano(id, plano);
      mostrarToast(`Plano "${plano.nome}" arquivado com sucesso.`);
      await carregarDados();
    } catch (err) {
      console.error(err);
      mostrarToast("Erro ao arquivar plano.", "error");
    }
  };

  // --- SUBMIT DO FORMULÁRIO (SALVAR) ---
  formPlano.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nome = inputNome.value.trim();
    const valor = parseFloat(inputValor.value);
    const duracao = parseInt(inputDuracao.value);
    const status = selectStatus.value;
    const descricao = inputDescricao.value.trim();

    // Validações básicas
    if (!nome || isNaN(valor) || isNaN(duracao) || valor < 0 || duracao <= 0) {
      mostrarToast("Por favor, preencha todos os campos obrigatórios com valores válidos.", "error");
      return;
    }

    try {
      if (currentEditId === null) {
        // ---- CRIAR NOVO PLANO ----
        const existe = planos.some(p => p.nome.toLowerCase() === nome.toLowerCase() && p.status !== "arquivado");
        if (existe) {
          mostrarToast(`Erro: Já existe um plano com o nome "${nome}".`, "error");
          return;
        }

        const novoPlano = {
          nome: nome,
          valor: valor,
          duracao_dias: duracao,
          status: status,
          descricao: descricao
        };

        await db.createPlano(novoPlano);
        mostrarToast(`Plano "${nome}" criado com sucesso.`);
      } else {
        // ---- EDITAR PLANO ----
        const plano = planos.find(p => p.id === currentEditId);
        if (!plano) return;

        const vinculadosCount = getAlunosVinculadosCount(plano.nome);

        // Se tentar inativar/arquivar plano editando
        if (status !== "ativo" && vinculadosCount > 0) {
          mostrarToast("Erro: Não é possível inativar/arquivar planos com alunos vinculados!", "error");
          return;
        }

        const planoAtualizado = {
          nome: nome,
          valor: valor,
          duracao_dias: duracao,
          status: status,
          descricao: descricao
        };

        await db.updatePlano(currentEditId, planoAtualizado);
        mostrarToast(`Plano "${nome}" atualizado com sucesso.`);
      }

      fecharModal();
      await carregarDados();
    } catch (err) {
      console.error(err);
      mostrarToast(`Erro ao salvar o plano: ${err.message || err}`, "error");
    }
  });

  // --- TOAST NOTIFICATIONS ---
  function mostrarToast(mensagem, tipo = "success") {
    const toast = document.getElementById("toast");
    const toastMsg = document.getElementById("toast-mensagem");
    const toastIcon = document.getElementById("toast-icone");

    toastMsg.textContent = mensagem;

    if (tipo === "error") {
      toast.style.background = "var(--ausente)";
      toastIcon.className = "fa-solid fa-circle-exclamation";
    } else {
      toast.style.background = "var(--ativo)";
      toastIcon.className = "fa-solid fa-circle-check";
    }

    toast.classList.add("visivel");
    setTimeout(() => {
      toast.classList.remove("visivel");
    }, 3500);
  }

  // Ordenação dos planos (Crescente/Decrescente)
  function ordenarDados(dados) {
    return dados.sort((a, b) => {
      let valA, valB;
      if (sortColuna === 'nome') {
        valA = (a.nome || '').toLowerCase();
        valB = (b.nome || '').toLowerCase();
      } else if (sortColuna === 'duracao') {
        valA = a.duracao_dias || 0;
        valB = b.duracao_dias || 0;
      } else if (sortColuna === 'valor') {
        valA = parseFloat(a.valor || 0);
        valB = parseFloat(b.valor || 0);
      } else if (sortColuna === 'vinculados') {
        valA = getAlunosVinculadosCount(a.nome);
        valB = getAlunosVinculadosCount(b.nome);
      } else { // alteracao (data de modificação)
        valA = new Date(a.criado_em || 0);
        valB = new Date(b.criado_em || 0);
      }

      if (valA < valB) return sortOrdem === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrdem === 'asc' ? 1 : -1;
      return 0;
    });
  }

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
          sortOrdem = coluna === 'alteracao' ? 'desc' : 'asc';
        }

        atualizarVisualHeaders();
        renderizarTabela();
      });
    });

    atualizarVisualHeaders();
  }

  // Carregar dados na inicialização
  carregarDados();
  inicializarOrdenacao();
});
