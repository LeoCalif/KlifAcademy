// =====================================================
// SELEÇÃO DE ELEMENTOS
// =====================================================

const overlay          = document.getElementById('modal-overlay')
const btnFechar        = document.getElementById('btn-fechar')
const btnEditar        = document.getElementById('btn-editar')
const btnSalvar        = document.getElementById('btn-salvar')
const btnCancelar      = document.getElementById('btn-cancelar')

const modalAvatar      = document.getElementById('modal-avatar')
const modalNome        = document.getElementById('modal-nome')
const modalPlano       = document.getElementById('modal-plano')
const modalVencimento  = document.getElementById('modal-vencimento')
const modalStatusBadge = document.getElementById('modal-status-badge')

const metricaDias      = document.getElementById('metrica-dias')
const metricaTotal     = document.getElementById('metrica-total')
const metricaMembro    = document.getElementById('metrica-membro')

const linhas           = document.querySelectorAll('#tabela-alunos tr')
const filterBtns       = document.querySelectorAll('.filter-btn')
const inputBusca       = document.getElementById('input-busca')
const tableCount       = document.getElementById('table-count')
const emptyState       = document.getElementById('empty-state')

const botoesVisualizar = document.querySelectorAll('.action-btn[title="Visualizar"]')
const btnNovoAluno     = document.getElementById('btn-novo-aluno')


// =====================================================
// DADOS DOS ALUNOS (integrado via API)
// =====================================================

let alunos = [];


// =====================================================
// FUNCOES AUXILIARES
// =====================================================

function calcularDias(dataISO) {
  if (!dataISO) return null
  const vencimento = new Date(dataISO + 'T12:00:00')
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((vencimento - hoje) / (1000 * 60 * 60 * 24))
}

function formatarData(dataISO) {
  if (!dataISO) return '—'
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}/${ano}`
}

function getInicial(nome) {
  return nome.charAt(0).toUpperCase()
}

function getStatusInfo(status) {
  const map = {
    ativo:      { texto: 'Ativo',      classe: 'status-ativo'      },
    aguardando: { texto: 'Aguardando', classe: 'status-aguardando' },
    ausente:    { texto: 'Ausente',    classe: 'status-ausente'    },
    pausa:      { texto: 'Em pausa',   classe: 'status-pausa'      },
    inativo:    { texto: 'Inativo',    classe: 'status-inativo'    },
  }
  return map[status] || { texto: status, classe: '' }
}

function getDiasInfo(dias) {
  if (dias === null) return { texto: '—',                                 classe: 'dias-neutro'  }
  if (dias > 5)      return { texto: `${dias} dias`,                      classe: 'dias-ok'      }
  if (dias >= 0)     return { texto: `${dias} dias`,                      classe: 'dias-aviso'   }
  return                    { texto: `${Math.abs(dias)} dias (Vencido)`,  classe: 'dias-vencido' }
}


// =====================================================
// ATUALIZAR CARDS DE RESUMO
// =====================================================

function atualizarCards() {
  let ativos = 0, aguardando = 0, ausentes = 0

  alunos.forEach(aluno => {
    if (aluno.status === 'ativo')      ativos++
    if (aluno.status === 'aguardando') aguardando++
    if (aluno.status === 'ausente')    ausentes++
  })

  document.getElementById('count-ativos').textContent     = ativos
  document.getElementById('count-aguardando').textContent = aguardando
  document.getElementById('count-ausentes').textContent   = ausentes
}


// =====================================================
// ATUALIZAR LINHA DA TABELA
// =====================================================

function atualizarLinhaTabela(index, aluno) {
  aplicarFiltros()
}


// =====================================================
// ADICIONAR LINHA NA TABELA DINAMICAMENTE
// =====================================================

function adicionarLinhaTabela(aluno, index) {
  const tbody      = document.getElementById('tabela-alunos')
  const dias       = calcularDias(aluno.vencimento)
  const diasInfo   = getDiasInfo(dias)
  const statusInfo = getStatusInfo(aluno.status)

  const tr = document.createElement('tr')
  tr.dataset.status = aluno.status

  tr.innerHTML = `
    <td><div class="aluno-nome">${aluno.nome}</div></td>
    <td>${aluno.plano || '—'}</td>
    <td>
      <span class="status-badge ${statusInfo.classe}">
        <span class="status-dot"></span> ${statusInfo.texto}
      </span>
    </td>
    <td>${formatarData(aluno.vencimento)}</td>
    <td><span class="${diasInfo.classe}">${diasInfo.texto}</span></td>
    <td>${aluno.telefone || '—'}</td>
    <td class="action-icons">
      <button class="action-btn" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
      <button class="action-btn btn-pagar" title="Registrar Pagamento"><i class="fa-solid fa-dollar-sign"></i></button>
      <button class="action-btn btn-pausar" title="Pausar Matricula"><i class="fa-solid fa-pause"></i></button>
      <button class="action-btn btn-inativar" title="Inativar Aluno"><i class="fa-solid fa-user-xmark"></i></button>
    </td>
  `

  tbody.appendChild(tr)

  // Conecta os botoes da nova linha
  tr.querySelector('[title="Visualizar"]').addEventListener('click',  () => abrirModal(index))
  tr.querySelector('.btn-pagar').addEventListener('click',            () => abrirModalPagamento(index))
  tr.querySelector('.btn-pausar').addEventListener('click',           () => abrirConfirmacao(index, 'pausar'))
  tr.querySelector('.btn-inativar').addEventListener('click',         () => abrirConfirmacao(index, 'inativar'))

  // Atualiza o contador da tabela
  const total = document.querySelectorAll('#tabela-alunos tr').length
  tableCount.textContent = `${total} alunos`
}


// =====================================================
// FECHAR TODOS OS MODAIS
// =====================================================

function fecharTodosModais() {
  overlay.classList.remove('aberto')
  modalPagamentoOverlay.classList.remove('aberto')
  modalComprovanteOverlay.classList.remove('aberto')
  modalConfirmacaoOverlay.classList.remove('aberto')
  document.body.style.overflow = ''
}


// =====================================================
// MODAL PRINCIPAL — ABRIR (visualizar)
// =====================================================

let alunoAtualIndex = null

function abrirModal(indexAluno) {
  alunoAtualIndex = indexAluno
  const aluno = alunos[indexAluno]

  // Cabeçalho
  modalAvatar.textContent    = getInicial(aluno.nome)
  modalAvatar.style.fontSize = ''
  modalNome.textContent      = aluno.nome

  const statusInfo = getStatusInfo(aluno.status)
  modalStatusBadge.className = `status-badge ${statusInfo.classe}`
  modalStatusBadge.innerHTML = `<span class="status-dot"></span><span>${statusInfo.texto}</span>`

  modalPlano.textContent      = `Plano ${aluno.plano}`
  modalVencimento.textContent = aluno.vencimento
    ? `Vence ${formatarData(aluno.vencimento)}`
    : 'Sem vencimento'

  // Metricas
  const dias     = calcularDias(aluno.vencimento)
  const diasInfo = getDiasInfo(dias)
  metricaDias.textContent = diasInfo.texto
  metricaDias.className   = `metrica-valor ${diasInfo.classe}`
  metricaTotal.textContent = `R$ ${aluno.total_pago.toFixed(2).replace('.', ',')}`
  const diasMembro = calcularDias(aluno.data_matricula)
  metricaMembro.textContent = `${Math.abs(diasMembro)} dias`

  // Preenche os campos
  document.getElementById('input-aluno-nome').value = aluno.nome || ''
  document.getElementById('input-aluno-cpf').value = aluno.cpf || ''
  document.getElementById('input-aluno-data-nasc').value = aluno.data_nasc || ''
  document.getElementById('input-aluno-sexo').value = aluno.sexo || ''
  document.getElementById('input-aluno-telefone').value = aluno.telefone || ''
  document.getElementById('input-aluno-email').value = aluno.email || ''
  document.getElementById('input-aluno-plano').value = aluno.plano || ''
  document.getElementById('input-aluno-cep').value = aluno.cep || ''
  document.getElementById('input-aluno-cidade').value = aluno.cidade || ''
  document.getElementById('input-aluno-estado').value = aluno.estado || ''
  document.getElementById('input-aluno-bairro').value = aluno.bairro || ''
  document.getElementById('input-aluno-rua').value = aluno.rua || ''
  document.getElementById('input-aluno-data-matricula').value = aluno.data_matricula || ''

  document.querySelectorAll('#aba-dados input, #aba-dados select').forEach(input => {
    input.disabled = true
  })

  const textarea    = document.querySelector('#aba-observacoes textarea')
  textarea.value    = aluno.observacoes || ''
  textarea.disabled = true

  // Volta para aba de dados
  document.querySelectorAll('.aba-btn').forEach(b => b.classList.remove('active'))
  document.querySelectorAll('.aba-conteudo').forEach(c => c.classList.remove('active'))
  document.querySelector('.aba-btn[data-aba="dados"]').classList.add('active')
  document.getElementById('aba-dados').classList.add('active')

  // Modo visualizacao
  btnEditar.style.display   = ''
  btnSalvar.style.display   = 'none'
  btnCancelar.style.display = 'none'
  btnSalvar.innerHTML       = '<i class="fa-solid fa-check"></i> Salvar'

  // Restaura acoes rapidas
  document.querySelector('.modal-acoes-rapidas').style.display = ''

  // Atualiza botoes de acao rapida conforme status
  const btnPausarModal   = document.querySelector('.btn-acao-rapida.btn-pausar')
  const btnInativarModal = document.querySelector('.btn-acao-rapida.btn-inativar')

  btnPausarModal.innerHTML   = aluno.status === 'pausa'
    ? '<i class="fa-solid fa-play"></i> Retomar Matricula'
    : '<i class="fa-solid fa-pause"></i> Pausar Matricula'

  btnInativarModal.innerHTML = aluno.status === 'inativo'
    ? '<i class="fa-solid fa-user-check"></i> Ativar Aluno'
    : '<i class="fa-solid fa-user-xmark"></i> Inativar Aluno'

  overlay.classList.add('aberto')
  document.body.style.overflow = 'hidden'
}


// =====================================================
// MODAL PRINCIPAL — ABRIR (novo aluno)
// =====================================================

btnNovoAluno.addEventListener('click', function() {
  alunoAtualIndex = null

  const aba    = document.getElementById('aba-dados')
  const inputs = aba.querySelectorAll('input, select')
  inputs.forEach(input => {
    input.value    = ''
    input.disabled = false
  })

  // Data de matrícula padrão como data atual
  const hojeISO = new Date().toISOString().split('T')[0]
  document.getElementById('input-aluno-data-matricula').value = hojeISO

  const textarea    = document.querySelector('#aba-observacoes textarea')
  textarea.value    = ''
  textarea.disabled = false

  // Esconde o campo de plano — sera definido no pagamento
  const planoInput = document.getElementById('input-aluno-plano')
  if (planoInput) {
    const campoGrupoPlano = planoInput.closest('.campo-grupo')
    if (campoGrupoPlano) campoGrupoPlano.style.display = 'none'
  }

  // Garante que a máscara de telefone esteja ativa
  ativarMascaraTelefone()

  modalAvatar.textContent    = '+'
  modalAvatar.style.fontSize = '22px'
  modalNome.textContent      = 'Novo Aluno'
  modalStatusBadge.className = 'status-badge status-ativo'
  modalStatusBadge.innerHTML = '<span class="status-dot"></span><span>Cadastro</span>'
  modalPlano.textContent      = 'Selecione um plano'
  modalVencimento.textContent = 'Preencha os dados abaixo'

  metricaDias.textContent   = '—'
  metricaDias.className     = 'metrica-valor dias-neutro'
  metricaTotal.textContent  = 'R$ 0,00'
  metricaMembro.textContent = '0 dias'

  document.querySelector('.modal-acoes-rapidas').style.display = 'none'
  document.querySelector('.aba-btn[data-aba="pagamentos"]').style.display = 'none'
  document.querySelector('.aba-btn[data-aba="historico"]').style.display  = 'none'

  document.querySelectorAll('.aba-btn').forEach(b => b.classList.remove('active'))
  document.querySelectorAll('.aba-conteudo').forEach(c => c.classList.remove('active'))
  document.querySelector('.aba-btn[data-aba="dados"]').classList.add('active')
  document.getElementById('aba-dados').classList.add('active')

  btnEditar.style.display   = 'none'
  btnSalvar.style.display   = ''
  btnCancelar.style.display = ''
  btnSalvar.innerHTML       = '<i class="fa-solid fa-user-plus"></i> Cadastrar'

  overlay.classList.add('aberto')
  document.body.style.overflow = 'hidden'
})


// =====================================================
// MODAL PRINCIPAL — FECHAR
// =====================================================

function fecharModal() {
  overlay.classList.remove('aberto')
  document.body.style.overflow = ''
  sairModoEdicao()
  btnSalvar.innerHTML = '<i class="fa-solid fa-check"></i> Salvar'
  document.querySelector('.modal-acoes-rapidas').style.display = ''
  document.querySelector('.aba-btn[data-aba="pagamentos"]').style.display = ''
  document.querySelector('.aba-btn[data-aba="historico"]').style.display  = ''
  modalAvatar.style.fontSize = ''

  // Restaura o campo de plano que foi escondido no cadastro
  const planoInput = document.getElementById('input-aluno-plano')
  if (planoInput) {
    const campoGrupoPlano = planoInput.closest('.campo-grupo')
    if (campoGrupoPlano) campoGrupoPlano.style.display = ''
  }
}

btnFechar.addEventListener('click', fecharModal)

overlay.addEventListener('click', function(e) {
  // Se estiver no modo cadastro, nao fecha ao clicar fora
  if (e.target === overlay && alunoAtualIndex !== null) fecharModal()
})

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') fecharTodosModais()
})


// =====================================================
// MODO EDICAO INLINE
// =====================================================

let valoresOriginais = {}

function entrarModoEdicao() {
  const inputs = document.querySelectorAll('#aba-dados input, #aba-dados select')
  valoresOriginais = {}
  inputs.forEach((input, i) => {
    valoresOriginais[i] = input.value
    input.disabled = false
  })
  const textarea = document.querySelector('#aba-observacoes textarea')
  valoresOriginais['obs'] = textarea.value
  textarea.disabled = false

  btnEditar.style.display   = 'none'
  btnSalvar.style.display   = ''
  btnCancelar.style.display = ''
}

function sairModoEdicao() {
  const inputs = document.querySelectorAll('#aba-dados input, #aba-dados select')
  inputs.forEach(input => input.disabled = true)
  const textarea = document.querySelector('#aba-observacoes textarea')
  textarea.disabled = true

  btnEditar.style.display   = ''
  btnSalvar.style.display   = 'none'
  btnCancelar.style.display = 'none'
}

function cancelarEdicao() {
  const inputs = document.querySelectorAll('#aba-dados input, #aba-dados select')
  inputs.forEach((input, i) => { input.value = valoresOriginais[i] || '' })
  const textarea = document.querySelector('#aba-observacoes textarea')
  textarea.value = valoresOriginais['obs'] || ''
  sairModoEdicao()
}

btnEditar.addEventListener('click', entrarModoEdicao)

btnCancelar.addEventListener('click', function() {
  if (alunoAtualIndex === null) {
    // Cancelou o cadastro — só fecha
    fecharModal()
  } else {
    // Cancelou a edicao — restaura os valores
    cancelarEdicao()
  }
})

btnSalvar.addEventListener('click', async function() {
  const nomeInput = document.getElementById('input-aluno-nome')
  const matriculaInput = document.getElementById('input-aluno-data-matricula')
  const cpfInput = document.getElementById('input-aluno-cpf')
  const cpfVal = cpfInput.value.trim()

  if (alunoAtualIndex === null) {
    // ---- MODO CADASTRO ----
    // Validacao minima
    if (!nomeInput.value.trim()) {
      mostrarToast('Preencha o nome do aluno.')
      nomeInput.focus()
      return
    }
    if (!matriculaInput.value) {
      mostrarToast('Preencha a data de matricula.')
      matriculaInput.focus()
      return
    }

    // Regra RN-08: Unicidade do CPF
    if (cpfVal && alunos.some(a => a.cpf && a.cpf.trim() === cpfVal)) {
      mostrarToast('Erro: Já existe um aluno cadastrado com este CPF.')
      cpfInput.focus()
      return
    }

    // Monta o objeto do novo aluno
    const novoAluno = {
      nome: nomeInput.value.trim(),
      cpf: cpfVal || null,
      data_nasc: document.getElementById('input-aluno-data-nasc').value || null,
      sexo: document.getElementById('input-aluno-sexo').value || null,
      telefone: document.getElementById('input-aluno-telefone').value || null,
      email: document.getElementById('input-aluno-email').value || null,
      plano: document.getElementById('input-aluno-plano').value || '',
      cep: document.getElementById('input-aluno-cep').value || null,
      cidade: document.getElementById('input-aluno-cidade').value || null,
      estado: document.getElementById('input-aluno-estado').value || null,
      bairro: document.getElementById('input-aluno-bairro').value || null,
      rua: document.getElementById('input-aluno-rua').value || null,
      data_matricula: matriculaInput.value,
      vencimento: null,
      status: 'ativo',
      observacoes: document.querySelector('#aba-observacoes textarea').value || ''
    }

    try {
      // Envia o novo aluno ao back-end
      const createdAluno = await db.createAluno(novoAluno);
      alunos = await db.getAlunos();

      aplicarFiltros()
      atualizarCards()
      fecharModal()

      // Pergunta se quer registrar pagamento
      const indexNovo = alunos.findIndex(a => a.id === createdAluno.id);
      if (indexNovo !== -1) {
        setTimeout(() => {
          abrirConfirmacaoPagamento(indexNovo, novoAluno.nome)
        }, 300)
      }
    } catch (err) {
      console.error(err);
      mostrarToast('Erro ao cadastrar aluno: ' + err.message);
    }

  } else {
    // ---- MODO EDICAO ----
    // Validacao minima
    if (!nomeInput.value.trim()) {
      mostrarToast('Preencha o nome do aluno.')
      nomeInput.focus()
      return
    }

    // Regra RN-08: Unicidade do CPF (Edição)
    if (cpfVal && alunos.some((a, idx) => idx !== alunoAtualIndex && a.cpf && a.cpf.trim() === cpfVal)) {
      mostrarToast('Erro: Já existe outro aluno cadastrado com este CPF.')
      cpfInput.focus()
      return
    }

    // Atualiza o aluno existente
    const aluno = alunos[alunoAtualIndex]
    const alunoDadosAtualizados = {
      nome: nomeInput.value.trim(),
      cpf: cpfVal || null,
      data_nasc: document.getElementById('input-aluno-data-nasc').value || null,
      sexo: document.getElementById('input-aluno-sexo').value || null,
      telefone: document.getElementById('input-aluno-telefone').value || null,
      email: document.getElementById('input-aluno-email').value || null,
      plano: document.getElementById('input-aluno-plano').value || '',
      cep: document.getElementById('input-aluno-cep').value || null,
      cidade: document.getElementById('input-aluno-cidade').value || null,
      estado: document.getElementById('input-aluno-estado').value || null,
      bairro: document.getElementById('input-aluno-bairro').value || null,
      rua: document.getElementById('input-aluno-rua').value || null,
      data_matricula: matriculaInput.value,
      observacoes: document.querySelector('#aba-observacoes textarea').value || ''
    }

    try {
      await db.updateAluno(aluno.id, alunoDadosAtualizados);
      alunos = await db.getAlunos();
      abrirModal(alunoAtualIndex);
      aplicarFiltros();
      mostrarToast('Dados salvos com sucesso!');
    } catch (err) {
      console.error(err);
      mostrarToast('Erro ao atualizar aluno: ' + err.message);
    }
  }
})


// =====================================================
// ABAS DO MODAL
// =====================================================

document.querySelectorAll('.aba-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.aba-btn').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.aba-conteudo').forEach(c => c.classList.remove('active'))
    this.classList.add('active')
    document.getElementById(`aba-${this.dataset.aba}`).classList.add('active')
  })
})


// Os botões da tabela são conectados dinamicamente na renderização (aplicarFiltros)


// =====================================================
// MODAL DE PAGAMENTO
// =====================================================

const modalPagamentoOverlay = document.getElementById('modal-pagamento-overlay')
const btnFecharPagamento    = document.getElementById('btn-fechar-pagamento')
const btnCancelarPagamento  = document.getElementById('btn-cancelar-pagamento')
const btnConfirmarPagamento = document.getElementById('btn-confirmar-pagamento')

const pagNomeAluno       = document.getElementById('pag-nome-aluno')
const pagStatusBadge     = document.getElementById('pag-status-badge')
const pagVencimentoAtual = document.getElementById('pag-vencimento-atual')
const pagPlano           = document.getElementById('pag-plano')
const pagValor           = document.getElementById('pag-valor')
const pagForma           = document.getElementById('pag-forma')
const pagData            = document.getElementById('pag-data')
const pagObs             = document.getElementById('pag-obs')
const pagNovoVencimento  = document.getElementById('pag-novo-vencimento')


function recalcularVencimento() {
  const dataVal = pagData.value
  const option  = pagPlano.options[pagPlano.selectedIndex]
  const dias    = parseInt(option.dataset.dias)
  if (!dataVal || !dias) { pagNovoVencimento.textContent = '—'; return }
  const dataBase = new Date(dataVal + 'T12:00:00')
  dataBase.setDate(dataBase.getDate() + dias)
  pagNovoVencimento.textContent = formatarData(dataBase.toISOString().split('T')[0])
}

pagPlano.addEventListener('change', function() {
  pagValor.value = this.options[this.selectedIndex].dataset.valor
  recalcularVencimento()
})
pagData.addEventListener('change', recalcularVencimento)


function abrirModalPagamento(indexAluno) {
  alunoAtualIndex = indexAluno
  const aluno     = alunos[indexAluno]

  pagNomeAluno.textContent = aluno.nome

  const statusInfo = getStatusInfo(aluno.status)
  pagStatusBadge.className = `status-badge ${statusInfo.classe}`
  pagStatusBadge.innerHTML = `<span class="status-dot"></span><span>${statusInfo.texto}</span>`

  pagVencimentoAtual.textContent = aluno.vencimento
    ? `Vencimento atual: ${formatarData(aluno.vencimento)}`
    : 'Sem vencimento cadastrado'

  pagData.value          = new Date().toISOString().split('T')[0]
  pagPlano.selectedIndex = 0
  pagValor.value         = pagPlano.options[0].dataset.valor
  pagObs.value           = ''

  recalcularVencimento()

  modalPagamentoOverlay.classList.add('aberto')
  document.body.style.overflow = 'hidden'
}

function fecharModalPagamento() {
  modalPagamentoOverlay.classList.remove('aberto')
  if (!overlay.classList.contains('aberto')) {
    document.body.style.overflow = ''
  }
}

btnFecharPagamento.addEventListener('click',   fecharModalPagamento)
btnCancelarPagamento.addEventListener('click', fecharModalPagamento)
modalPagamentoOverlay.addEventListener('click', function(e) {
  if (e.target === modalPagamentoOverlay) fecharModalPagamento()
})


// =====================================================
// CONFIRMAR PAGAMENTO
// =====================================================

btnConfirmarPagamento.addEventListener('click', async function() {
  const aluno  = alunos[alunoAtualIndex]
  const option = pagPlano.options[pagPlano.selectedIndex]
  const dias   = parseInt(option.dataset.dias)

  const dataBase = new Date(pagData.value + 'T12:00:00')
  dataBase.setDate(dataBase.getDate() + dias)
  const novoVencISO = dataBase.toISOString().split('T')[0]

  const pagamentoReal = {
    aluno_id: aluno.id,
    plano: pagPlano.value,
    valor: parseFloat(pagValor.value),
    forma_pagamento: pagForma.value,
    data_pagamento: pagData.value,
    novo_vencimento: novoVencISO,
    observacoes: pagObs.value
  }

  try {
    await db.createPagamento(pagamentoReal)
    alunos = await db.getAlunos()

    atualizarLinhaTabela(alunoAtualIndex, alunos[alunoAtualIndex])
    atualizarCards()
    fecharTodosModais()
    mostrarToast('Pagamento registrado com sucesso!')
    setTimeout(() => abrirComprovante({
      aluno_nome: aluno.nome,
      plano: pagPlano.value,
      valor: parseFloat(pagValor.value),
      forma_pagamento: pagForma.value,
      data_pagamento: pagData.value,
      novo_vencimento: novoVencISO
    }), 400)
  } catch (err) {
    console.error(err);
    mostrarToast('Erro ao registrar pagamento: ' + err.message);
  }
})


// =====================================================
// TOAST
// =====================================================

function mostrarToast(mensagem) {
  const toast = document.getElementById('toast')
  document.getElementById('toast-mensagem').textContent = mensagem
  toast.classList.add('visivel')
  setTimeout(() => toast.classList.remove('visivel'), 3500)
}


// =====================================================
// COMPROVANTE
// =====================================================

const modalComprovanteOverlay = document.getElementById('modal-comprovante-overlay')
const btnFecharComprovante    = document.getElementById('btn-fechar-comprovante')
const btnCopiarWhatsapp       = document.getElementById('btn-copiar-whatsapp')
const btnImprimir             = document.getElementById('btn-imprimir')

let dadosComprovante = {}

async function abrirComprovante(pagamento) {
  dadosComprovante = pagamento
  const formaMap = {
    pix: 'Pix', dinheiro: 'Dinheiro',
    debito: 'Cartao de Debito', credito: 'Cartao de Credito'
  }

  // Carrega configurações dinâmicas da academia
  let config = null;
  try {
    config = await db.getConfiguracoes();
  } catch (e) {
    console.error(e);
  }
  let logoPath = '../Assets/logoAcademia.png'
  let gymName = 'Bem-Estar Fitness'
  if (config) {
    gymName = config.nomeAcademia || gymName
    if (config.logo) {
      logoPath = config.logo
      if (!logoPath.startsWith('../') && !logoPath.startsWith('http') && !logoPath.startsWith('data:')) {
        logoPath = '../' + logoPath
      }
    }
  }

  const compLogoImg = document.getElementById('comp-logo-img')
  if (compLogoImg) {
    compLogoImg.src = logoPath
  }
  const compAcademiaNome = document.getElementById('comp-academia-nome')
  if (compAcademiaNome) {
    compAcademiaNome.textContent = gymName
  }

  document.getElementById('comp-nome').textContent       = pagamento.aluno_nome
  document.getElementById('comp-plano').textContent      = pagamento.plano
  document.getElementById('comp-valor').textContent      = `R$ ${pagamento.valor.toFixed(2).replace('.', ',')}`
  document.getElementById('comp-forma').textContent      = formaMap[pagamento.forma_pagamento] || pagamento.forma_pagamento
  document.getElementById('comp-data').textContent       = formatarData(pagamento.data_pagamento)
  document.getElementById('comp-vencimento').textContent = formatarData(pagamento.novo_vencimento)
  modalComprovanteOverlay.classList.add('aberto')
  document.body.style.overflow = 'hidden'
}

function fecharComprovante() {
  modalComprovanteOverlay.classList.remove('aberto')
  document.body.style.overflow = ''
}

btnFecharComprovante.addEventListener('click', fecharComprovante)
modalComprovanteOverlay.addEventListener('click', function(e) {
  if (e.target === modalComprovanteOverlay) fecharComprovante()
})

btnCopiarWhatsapp.addEventListener('click', async function() {
  const formaMap = {
    pix: 'Pix', dinheiro: 'Dinheiro',
    debito: 'Cartao de Debito', credito: 'Cartao de Credito'
  }
  
  let config = null;
  try {
    config = await db.getConfiguracoes();
  } catch (e) {
    console.error(e);
  }
  const gymName = (config && config.nomeAcademia) ? config.nomeAcademia : 'Bem-Estar Fitness'

  const texto =
`*Comprovante de Pagamento*
${gymName}

*Aluno:* ${dadosComprovante.aluno_nome}
*Plano:* ${dadosComprovante.plano}
*Valor:* R$ ${dadosComprovante.valor.toFixed(2).replace('.', ',')}
*Forma:* ${formaMap[dadosComprovante.forma_pagamento]}
*Data:* ${formatarData(dadosComprovante.data_pagamento)}
*Proximo vencimento:* ${formatarData(dadosComprovante.novo_vencimento)}

_${gymName} agradece!_`

  navigator.clipboard.writeText(texto).then(() => {
    mostrarToast('Texto copiado! Cole no WhatsApp.')
  })
})

btnImprimir.addEventListener('click', () => window.print())


// =====================================================
// MODAL DE CONFIRMACAO (pausar / retomar / inativar / ativar)
// =====================================================

const modalConfirmacaoOverlay = document.getElementById('modal-confirmacao-overlay')
const btnCancelarConfirmacao  = document.getElementById('btn-cancelar-confirmacao')
const btnConfirmarAcao        = document.getElementById('btn-confirmar-acao')

let acaoPendente = null

function abrirConfirmacao(indexAluno, acao) {
  alunoAtualIndex = indexAluno
  const aluno     = alunos[indexAluno]

  if      (acao === 'pausar'   && aluno.status === 'pausa')   acaoPendente = 'retomar'
  else if (acao === 'inativar' && aluno.status === 'inativo') acaoPendente = 'ativar'
  else                                                         acaoPendente = acao

  const config = {
    pausar: {
      titulo: 'Pausar matricula', desc: 'Tem certeza que deseja pausar a matricula de',
      icone: 'fa-pause', iconeBg: 'rgba(37,99,235,.12)', iconeColor: 'var(--pausado)',
      btnBg: 'var(--pausado)', btnIcone: 'fa-pause', btnTexto: 'Pausar'
    },
    retomar: {
      titulo: 'Retomar matricula', desc: 'Tem certeza que deseja retomar a matricula de',
      icone: 'fa-play', iconeBg: 'rgba(5,150,105,.12)', iconeColor: 'var(--ativo)',
      btnBg: 'var(--ativo)', btnIcone: 'fa-play', btnTexto: 'Retomar'
    },
    inativar: {
      titulo: 'Inativar aluno', desc: 'Tem certeza que deseja inativar',
      icone: 'fa-user-xmark', iconeBg: 'rgba(220,38,38,.12)', iconeColor: 'var(--ausente)',
      btnBg: 'var(--ausente)', btnIcone: 'fa-user-xmark', btnTexto: 'Inativar'
    },
    ativar: {
      titulo: 'Ativar aluno', desc: 'Tem certeza que deseja ativar o cadastro de',
      icone: 'fa-user-check', iconeBg: 'rgba(5,150,105,.12)', iconeColor: 'var(--ativo)',
      btnBg: 'var(--ativo)', btnIcone: 'fa-user-check', btnTexto: 'Ativar'
    }
  }

  const c = config[acaoPendente]
  document.getElementById('conf-titulo').textContent = c.titulo
  document.getElementById('conf-desc').innerHTML     = `${c.desc} <strong>${aluno.nome}</strong>?`

  const iconeBox         = document.getElementById('conf-icone')
  iconeBox.style.background = c.iconeBg
  const iconeI           = document.getElementById('conf-icone-i')
  iconeI.className       = `fa-solid ${c.icone}`
  iconeI.style.color     = c.iconeColor

  btnConfirmarAcao.style.background = c.btnBg
  document.getElementById('conf-btn-icone').className      = `fa-solid ${c.btnIcone}`
  document.getElementById('conf-btn-texto').textContent    = c.btnTexto

  modalConfirmacaoOverlay.classList.add('aberto')
  document.body.style.overflow = 'hidden'
}

function fecharConfirmacao() {
  modalConfirmacaoOverlay.classList.remove('aberto')
  if (!overlay.classList.contains('aberto') &&
      !modalPagamentoOverlay.classList.contains('aberto')) {
    document.body.style.overflow = ''
  }
  acaoPendente = null
}

btnCancelarConfirmacao.addEventListener('click', fecharConfirmacao)
modalConfirmacaoOverlay.addEventListener('click', function(e) {
  if (e.target === modalConfirmacaoOverlay) fecharConfirmacao()
})


// =====================================================
// EXECUTAR ACAO CONFIRMADA
// =====================================================

btnConfirmarAcao.addEventListener('click', async function() {
  const aluno = alunos[alunoAtualIndex]

  try {
    if (acaoPendente === 'pausar') {
      const updated = await db.alterarStatusAluno(aluno.id, 'pausar')
      alunos = await db.getAlunos()
      atualizarLinhaTabela(alunoAtualIndex, alunos[alunoAtualIndex])
      atualizarCards()
      fecharTodosModais()
      mostrarToast(`Matrícula pausada. ${updated.dias_pausados || 0} dias preservados.`)
    }

    if (acaoPendente === 'retomar') {
      const updated = await db.alterarStatusAluno(aluno.id, 'retomar')
      alunos = await db.getAlunos()
      atualizarLinhaTabela(alunoAtualIndex, alunos[alunoAtualIndex])
      atualizarCards()
      fecharTodosModais()
      mostrarToast(`Matrícula retomada! Novo vencimento: ${formatarData(updated.vencimento)}.`)
    }

    if (acaoPendente === 'inativar') {
      await db.alterarStatusAluno(aluno.id, 'inativar')
      alunos = await db.getAlunos()
      atualizarLinhaTabela(alunoAtualIndex, alunos[alunoAtualIndex])
      atualizarCards()
      fecharTodosModais()
      mostrarToast('Aluno inativado com sucesso.')
    }

    if (acaoPendente === 'ativar') {
      fecharConfirmacao()
      abrirModalPagamento(alunoAtualIndex)
    }
  } catch (err) {
    console.error(err);
    mostrarToast('Erro ao alterar status: ' + err.message);
  }
})


// Os botões da tabela são conectados dinamicamente na renderização (aplicarFiltros)


// =====================================================
// CONECTAR BOTOES — MODAL PRINCIPAL (acoes rapidas)
// =====================================================

document.querySelector('.btn-acao-rapida.btn-pagar').addEventListener('click', function() {
  if (alunoAtualIndex !== null) abrirModalPagamento(alunoAtualIndex)
})

document.querySelector('.btn-acao-rapida.btn-pausar').addEventListener('click', function() {
  if (alunoAtualIndex !== null) abrirConfirmacao(alunoAtualIndex, 'pausar')
})

document.querySelector('.btn-acao-rapida.btn-inativar').addEventListener('click', function() {
  if (alunoAtualIndex !== null) abrirConfirmacao(alunoAtualIndex, 'inativar')
})

document.querySelector('.btn-registrar-pag').addEventListener('click', function() {
  if (alunoAtualIndex !== null) abrirModalPagamento(alunoAtualIndex)
})


// =====================================================
// FILTROS E BUSCA DA TABELA
// =====================================================

function ordenarDados(dados) {
  return dados.sort((a, b) => {
    let valA, valB;
    const alunoA = a.aluno;
    const alunoB = b.aluno;

    if (sortColuna === 'nome') {
      valA = (alunoA.nome || '').toLowerCase();
      valB = (alunoB.nome || '').toLowerCase();
    } else if (sortColuna === 'plano') {
      valA = (alunoA.plano || '').toLowerCase();
      valB = (alunoB.plano || '').toLowerCase();
    } else if (sortColuna === 'status') {
      valA = (alunoA.status || '').toLowerCase();
      valB = (alunoB.status || '').toLowerCase();
    } else if (sortColuna === 'vencimento') {
      valA = alunoA.vencimento ? new Date(alunoA.vencimento).getTime() : 0;
      valB = alunoB.vencimento ? new Date(alunoB.vencimento).getTime() : 0;
    } else if (sortColuna === 'dias') {
      const diasA = calcularDias(alunoA.vencimento);
      const diasB = calcularDias(alunoB.vencimento);
      valA = diasA !== null ? diasA : 999999;
      valB = diasB !== null ? diasB : 999999;
    } else {
      valA = (alunoA.nome || '').toLowerCase();
      valB = (alunoB.nome || '').toLowerCase();
    }

    if (valA < valB) return sortOrdem === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrdem === 'asc' ? 1 : -1;
    return 0;
  });
}

let filtroAtivo = 'todos';

function aplicarFiltros() {
  const tbody = document.getElementById('tabela-alunos');
  if (!tbody) return;
  tbody.innerHTML = '';

  const busca = inputBusca.value.toLowerCase().trim();
  const hojeStrISO = '2026-05-29';
  const urlParams = new URLSearchParams(window.location.search);
  const planoParam = urlParams.get('planoNome');

  // Mapeia os alunos para manter o índice original
  const dadosMapeados = alunos.map((aluno, index) => ({ aluno, index }));

  // Filtra os alunos
  const dadosFiltrados = dadosMapeados.filter(item => {
    const aluno = item.aluno;
    
    let passaStatus = false;
    if (filtroAtivo === 'todos') {
      passaStatus = true;
    } else if (filtroAtivo === 'vencimento-hoje') {
      passaStatus = (aluno.vencimento === hojeStrISO);
    } else if (filtroAtivo === 'plano' && planoParam) {
      passaStatus = (aluno.plano && aluno.plano.trim().toLowerCase() === planoParam.trim().toLowerCase());
    } else {
      passaStatus = (aluno.status === filtroAtivo);
    }

    const nome = (aluno.nome || '').toLowerCase();
    const cpf = (aluno.cpf || '').toLowerCase();
    const tel = (aluno.telefone || '').toLowerCase();
    const passaBusca = busca === '' || nome.includes(busca) || cpf.includes(busca) || tel.includes(busca);

    return passaStatus && passaBusca;
  });

  // Ordena os alunos filtrados
  const dadosOrdenados = ordenarDados(dadosFiltrados);

  // Renderiza as linhas
  dadosOrdenados.forEach(item => {
    const aluno = item.aluno;
    const index = item.index;

    const dias       = calcularDias(aluno.vencimento);
    const diasInfo   = getDiasInfo(dias);
    const statusInfo = getStatusInfo(aluno.status);

    const tr = document.createElement('tr');
    tr.dataset.status = aluno.status;
    tr.dataset.index = index;

    const btnPausarTitle = aluno.status === 'pausa' ? 'Retomar Matricula' : 'Pausar Matricula';
    const btnPausarIcon = aluno.status === 'pausa' ? 'fa-solid fa-play' : 'fa-solid fa-pause';

    const btnInativarTitle = aluno.status === 'inativo' ? 'Ativar Aluno' : 'Inativar Aluno';
    const btnInativarIcon = aluno.status === 'inativo' ? 'fa-solid fa-user-check' : 'fa-solid fa-user-xmark';

    tr.innerHTML = `
      <td><div class="aluno-nome">${aluno.nome}</div></td>
      <td>${aluno.plano || '—'}</td>
      <td>
        <span class="status-badge ${statusInfo.classe}">
          <span class="status-dot"></span> ${statusInfo.texto}
        </span>
      </td>
      <td>${formatarData(aluno.vencimento)}</td>
      <td><span class="${diasInfo.classe}">${diasInfo.texto}</span></td>
      <td>${aluno.telefone || '—'}</td>
      <td class="action-icons">
        <button class="action-btn btn-visualizar" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
        <button class="action-btn btn-pagar" title="Registrar Pagamento"><i class="fa-solid fa-dollar-sign"></i></button>
        <button class="action-btn btn-pausar" title="${btnPausarTitle}"><i class="${btnPausarIcon}"></i></button>
        <button class="action-btn btn-inativar" title="${btnInativarTitle}"><i class="${btnInativarIcon}"></i></button>
      </td>
    `;

    tbody.appendChild(tr);

    // Conecta os botões da nova linha usando o index original do aluno
    tr.querySelector('.btn-visualizar').addEventListener('click', () => abrirModal(index));
    tr.querySelector('.btn-pagar').addEventListener('click', () => abrirModalPagamento(index));
    tr.querySelector('.btn-pausar').addEventListener('click', () => abrirConfirmacao(index, 'pausar'));
    tr.querySelector('.btn-inativar').addEventListener('click', () => abrirConfirmacao(index, 'inativar'));
  });

  tableCount.textContent = dadosFiltrados.length === 1 ? '1 aluno' : `${dadosFiltrados.length} alunos`;
  emptyState.classList.toggle('visible', dadosFiltrados.length === 0);
}

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    filtroAtivo = btn.dataset.filter
    aplicarFiltros()
  })
})

inputBusca.addEventListener('input', aplicarFiltros)


// =====================================================
// INICIALIZACAO — roda ao carregar a pagina
// =====================================================

// =====================================================
// MODAL POS-CADASTRO (pergunta sobre pagamento)
// =====================================================

const modalPosCadastroOverlay = document.getElementById('modal-pos-cadastro-overlay')
const btnPosCadastroSim       = document.getElementById('btn-pos-cadastro-sim')
const btnPosCadastroNao       = document.getElementById('btn-pos-cadastro-nao')

let indexPosCadastro = null

function abrirConfirmacaoPagamento(index, nome) {
  indexPosCadastro = index
  document.getElementById('pos-cadastro-nome').textContent = nome
  modalPosCadastroOverlay.classList.add('aberto')
  document.body.style.overflow = 'hidden'
}

function fecharPosCadastro() {
  modalPosCadastroOverlay.classList.remove('aberto')
  document.body.style.overflow = ''
  mostrarToast('Aluno cadastrado com sucesso!')
  indexPosCadastro = null
}

btnPosCadastroNao.addEventListener('click', fecharPosCadastro)

btnPosCadastroSim.addEventListener('click', function() {
  modalPosCadastroOverlay.classList.remove('aberto')
  if (indexPosCadastro !== null) {
    alunoAtualIndex = indexPosCadastro
    abrirModalPagamento(indexPosCadastro)
  }
  indexPosCadastro = null
})

modalPosCadastroOverlay.addEventListener('click', function(e) {
  if (e.target === modalPosCadastroOverlay) fecharPosCadastro()
})


// =====================================================
// MASCARA E VALIDACAO DO TELEFONE
// =====================================================

function ativarMascaraTelefone() {
  const campoTel = document.getElementById('input-aluno-telefone')
  if (!campoTel) return

  campoTel.addEventListener('input', function() {
    let val = this.value.replace(/\D/g, '') // remove non-digits

    if (val.length === 0) {
      this.value = ''
      return
    }

    // Se o primeiro dígito for 9 e o comprimento for até 9 (só o número), assume DDD 11
    if (val.charAt(0) === '9' && val.length <= 9) {
      val = '11' + val
    }

    // Formata: (DD) XXXXX-XXXX ou (DD) XXXX-XXXX
    let formatado = ''
    if (val.length <= 2) {
      formatado = `(${val}`
    } else if (val.length <= 6) {
      formatado = `(${val.slice(0, 2)}) ${val.slice(2)}`
    } else if (val.length <= 10) {
      formatado = `(${val.slice(0, 2)}) ${val.slice(2, 6)}-${val.slice(6)}`
    } else {
      formatado = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7, 11)}`
    }

    this.value = formatado
  })

  // Validacao ao sair do campo
  campoTel.addEventListener('blur', function() {
    const nums = this.value.replace(/\D/g, '')
    // Brasil: DDD (2) + numero (8 ou 9) = 10 ou 11 digitos
    if (this.value && (nums.length < 10 || nums.length > 11)) {
      this.style.borderColor = 'var(--ausente)'
      this.title = 'Número inválido. Use o formato (11) 99999-9999'
    } else {
      this.style.borderColor = ''
      this.title = ''
    }
  })
}

// Inicializa a máscara de telefone ao carregar a página
ativarMascaraTelefone()

async function popularPlanosSelects() {
  const plansSelect1 = document.getElementById('input-aluno-plano');
  const plansSelect2 = document.getElementById('pag-plano');
  if (plansSelect1 && plansSelect2) {
    try {
      const planos = await db.getPlanos();
      const activePlans = planos.filter(p => p.status === 'ativo');
      
      // Para input-aluno-plano
      plansSelect1.innerHTML = '<option value="">Selecione</option>' + 
        activePlans.map(p => `<option value="${p.nome}">${p.nome}</option>`).join('');
        
      // Para pag-plano
      plansSelect2.innerHTML = activePlans.map((p, idx) => {
        const valorNum = parseFloat(p.valor || 0);
        return `<option value="${p.nome}" data-valor="${valorNum.toFixed(2)}" data-dias="${p.duracao_dias}">${p.nome} — R$ ${valorNum.toFixed(2).replace('.', ',')}</option>`;
      }).join('');
    } catch (e) {
      console.error(e);
    }
  }
}

// Filtro automático via parâmetro de URL (ex: ?filter=aguardando ou ?filter=plano&planoNome=Mensal)
const urlParams = new URLSearchParams(window.location.search);
const filterParam = urlParams.get('filter');
const planoParam = urlParams.get('planoNome');
if (filterParam) {
  const btn = Array.from(filterBtns).find(b => b.dataset.filter === filterParam);
  if (btn) {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  } else {
    filterBtns.forEach(b => b.classList.remove('active'));
  }
  filtroAtivo = filterParam;
  
  if (filtroAtivo === 'plano' && planoParam) {
    const headerP = document.querySelector('.page-header p');
    if (headerP) {
      headerP.innerHTML = `Gerencie todos os alunos cadastrados na academia · <strong>Plano: ${planoParam}</strong> <a href="Alunos.html" style="color: var(--primary); margin-left: 10px; text-decoration: none; font-weight: 600;"><i class="fa-solid fa-circle-xmark"></i> Limpar filtro</a>`;
    }
  }
}

// Configuração e inicialização de Ordenação dos alunos
let sortColuna = 'nome';
let sortOrdem = 'asc';

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
        sortOrdem = coluna === 'nome' ? 'asc' : 'asc';
      }

      atualizarVisualHeaders();
      aplicarFiltros();
    });
  });

  atualizarVisualHeaders();
}

async function init() {
  try {
    alunos = await db.getAlunos();
    await popularPlanosSelects();
    atualizarCards();
    inicializarOrdenacao();
    aplicarFiltros();
  } catch (err) {
    console.error("Erro na inicialização:", err);
  }
}

init();
