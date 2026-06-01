// =====================================================
// SUPABASE CLIENT INTEGRATION AND ROUTER
// =====================================================

const SUPABASE_URL = "https://ftvqcvfjtwdggkmhyzee.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0dnFjdmZqdHdkZ2drbWh5emVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNzg2MjUsImV4cCI6MjA5NTc1NDYyNX0.5TDsP-WyV8Wyg0MQrtfl7Y7KAP_H7KRk44F768Lm5UQ";

// Inicializa a instância do cliente Supabase usando uma variável com nome exclusivo
// para evitar conflito com a global 'supabase' injetada pelo script do CDN
let supabaseClient = null;
if (window.supabase && SUPABASE_URL !== "SUA_SUPABASE_URL_AQUI" && SUPABASE_ANON_KEY !== "SUA_SUPABASE_ANON_KEY_AQUI") {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Alerta se as configurações do Supabase estiverem ausentes
if (SUPABASE_URL === "SUA_SUPABASE_URL_AQUI" || SUPABASE_ANON_KEY === "SUA_SUPABASE_ANON_KEY_AQUI") {
  console.warn("CONFIGURAÇÃO NECESSÁRIA: Insira a URL e Chave Anon do seu projeto Supabase no início do arquivo 'Criando telas originais/api.js' para que o sistema funcione.");
}

// Função para atualizar automaticamente os status dos alunos com base no vencimento ou data de matrícula
async function atualizarStatusAutomatico(alunos, activeAcademiaId, currentUserId) {
  if (!alunos || alunos.length === 0) return;

  const hojeStr = new Date().toLocaleDateString('en-CA'); // Formato YYYY-MM-DD local
  const hoje = new Date(hojeStr + "T12:00:00");

  const updates = [];

  for (const aluno of alunos) {
    // Alunos com status manual 'pausa' não devem ter o status alterado automaticamente
    if (aluno.status === 'pausa') {
      continue;
    }

    let statusCalculado = aluno.status;

    if (aluno.vencimento) {
      const vencDate = new Date(aluno.vencimento + "T12:00:00");
      const diffTime = hoje - vencDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Dias vencido (positivo se vencido)

      if (diffDays <= 0) {
        statusCalculado = 'ativo';
      } else if (diffDays <= 7) {
        statusCalculado = 'aguardando'; // Venceu e está há no máximo 7 dias sem pagar
      } else if (diffDays <= 60) {
        statusCalculado = 'ausente';    // Entre 8 e 60 dias sem pagar
      } else {
        statusCalculado = 'inativo';    // Mais de 60 dias sem pagar/plano ativo
      }
    } else {
      // Se não tem vencimento (cadastro novo sem plano ou resetado)
      if (aluno.data_matricula) {
        const matDate = new Date(aluno.data_matricula + "T12:00:00");
        const diffTime = hoje - matDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 60) {
          statusCalculado = 'inativo';
        } else if (diffDays > 7) {
          statusCalculado = 'ausente';
        } else {
          // Nos primeiros 7 dias de matrícula sem plano cadastrado, podemos mantê-lo ativo
          if (aluno.status !== 'ativo' && aluno.status !== 'aguardando') {
            statusCalculado = 'ativo';
          }
        }
      } else {
        // Sem vencimento e sem matrícula
        if (aluno.status !== 'ativo' && aluno.status !== 'aguardando' && aluno.status !== 'inativo' && aluno.status !== 'ausente') {
          statusCalculado = 'ativo';
        }
      }
    }

    // Se o status calculado mudou, atualiza
    if (aluno.status !== statusCalculado) {
      updates.push({
        aluno,
        statusAnterior: aluno.status,
        statusNovo: statusCalculado
      });
    }
  }

  if (updates.length > 0) {
    for (const item of updates) {
      const { aluno, statusAnterior, statusNovo } = item;

      // Atualiza o banco de dados
      const { error: updateError } = await supabaseClient
        .from("alunos")
        .update({ status: statusNovo })
        .eq("id", aluno.id)
        .eq("academia_id", activeAcademiaId);

      if (!updateError) {
        // Registra no histórico do aluno
        let desc = "";
        if (statusNovo === "inativo") {
          desc = "Matrícula inativada automaticamente por mais de 60 dias sem plano ativo.";
        } else if (statusNovo === "ausente") {
          desc = "Alterado automaticamente para Ausente por atraso superior a 7 dias.";
        } else if (statusNovo === "aguardando") {
          desc = "Alterado automaticamente para Aguardando Pagamento por vencimento do plano.";
        } else if (statusNovo === "ativo") {
          desc = "Alterado automaticamente para Ativo.";
        }

        await supabaseClient.from("historico_aluno").insert({
          aluno_id: aluno.id,
          usuario_id: currentUserId || null,
          academia_id: activeAcademiaId,
          tipo_evento: "sistema_status",
          status_anterior: statusAnterior,
          status_novo: statusNovo,
          descricao: desc
        });

        // Atualiza a referência em memória
        aluno.status = statusNovo;
      }
    }
  }
}


window.api = {
  getHeaders: function () {
    const token = localStorage.getItem("wpa_token");
    const headers = {
      "Content-Type": "application/json"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  },

  // Intercepta e simula as requisições AJAX do sistema direto no Supabase
  request: async function (endpoint, method = "GET", body = null) {
    if (!supabaseClient) {
      throw new Error("Supabase não configurado. Por favor, adicione a URL e Chave do Supabase no arquivo api.js.");
    }

    // Usamos o construtor URL para facilitar a extração de caminhos e parâmetros de query
    const url = new URL(endpoint, "http://localhost");
    const path = url.pathname;
    const methodUpper = method.toUpperCase();

    // Obtém o ID do usuário logado na sessão ativa
    const loggedInUserStr = localStorage.getItem("wpa_usuario_logado");
    const currentUser = loggedInUserStr ? JSON.parse(loggedInUserStr) : null;
    const currentUserId = currentUser ? currentUser.id : null;

    // Obtém a academia ativa selecionada no portal ou na sessão logada
    const activeTenantStr = localStorage.getItem("wpa_tenant_ativo");
    const activeTenant = activeTenantStr ? JSON.parse(activeTenantStr) : null;
    const activeAcademiaId = currentUser ? currentUser.academia_id : (activeTenant ? activeTenant.id : null);

    try {
      // 0. NOVO ENDPOINT DE VERIFICAÇÃO DE ACADEMIA (TENANT)
      if (path === "/academias/verificar" && methodUpper === "GET") {
        const slug = url.searchParams.get("slug");
        if (!slug) {
          throw new Error("Slug da academia é obrigatório.");
        }

        const { data: academia, error } = await supabaseClient
          .from("academias")
          .select("*")
          .eq("slug", slug.toLowerCase())
          .maybeSingle();

        if (error || !academia) {
          throw new Error("Academia não encontrada ou código inválido.");
        }

        return academia;
      }

      // 1. ROTAS DE AUTENTICAÇÃO
      else if (path === "/auth/login" && methodUpper === "POST") {
        const { username, password } = body;
        if (!username || !password) {
          throw new Error("Por favor, preencha todos os campos obrigatórios.");
        }

        let emailLogin = username;
        if (!username.includes("@")) {
          if (username.toLowerCase() === "calif") {
            emailLogin = "leo080396@gmail.com";
          } else {
            try {
              const { data: dbEmail, error: rpcError } = await supabaseClient.rpc("get_user_email_by_login", {
                p_login: username.toLowerCase().trim()
              });
              if (!rpcError && dbEmail) {
                emailLogin = dbEmail;
              } else {
                emailLogin = `${username.toLowerCase()}@${activeTenant ? activeTenant.slug.toLowerCase() : "klif"}.com`;
              }
            } catch (e) {
              emailLogin = `${username.toLowerCase()}@${activeTenant ? activeTenant.slug.toLowerCase() : "klif"}.com`;
            }
          }
        }

        console.log("Tentando login no Supabase Auth com:", emailLogin);

        // Realiza o login real via Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
          email: emailLogin,
          password: password
        });

        if (authError) {
          if (authError.message.includes("Invalid login credentials") || authError.message.includes("Email not confirmed")) {
            throw new Error("Usuário ou senha incorretos.");
          }
          throw new Error(authError.message);
        }

        const sessionUser = authData.user;
        const userMetadata = sessionUser.user_metadata || {};
        
        // Verifica se a academia correspondente do usuário bate com a selecionada (ignora se for Administrador ou se não houver metadados)
        const userAcademiaId = parseInt(userMetadata.academia_id);
        const isSuperAdmin = userMetadata.perfil === "Administrador";
        if (!isSuperAdmin && activeAcademiaId && !isNaN(userAcademiaId) && userAcademiaId !== activeAcademiaId) {
          await supabaseClient.auth.signOut();
          throw new Error("Este usuário não pertence à academia selecionada.");
        }

        // Busca o ID interno (integer) do usuário na tabela public.usuarios (usando o UUID)
        const { data: dbUser, error: dbError } = await supabaseClient
          .from("usuarios")
          .select("*")
          .eq("uuid", sessionUser.id)
          .maybeSingle();

        if (dbError) {
          await supabaseClient.auth.signOut();
          throw new Error("Erro ao carregar perfil do banco: " + dbError.message);
        }

        // Se o usuário não existe na tabela usuarios e não é o administrador master (leo080396@gmail.com)
        if (!dbUser && sessionUser.email !== "leo080396@gmail.com") {
          await supabaseClient.auth.signOut();
          throw new Error("Acesso não autorizado. Sua conta não está vinculada a esta academia.");
        }

        // Se o usuário está inativo (aguardando aprovação do administrador)
        if (dbUser && !dbUser.ativo) {
          await supabaseClient.auth.signOut();
          throw new Error("Sua conta está aguardando aprovação do administrador.");
        }

        const finalUserId = dbUser ? dbUser.id : 1;
        const finalNome = dbUser ? dbUser.nome : (userMetadata.name || userMetadata.nome || "Calif");
        const finalPerfil = dbUser ? dbUser.perfil : (userMetadata.perfil || "Administrador");

        // Registra o Log de Auditoria de Login
        await supabaseClient.from("logs").insert({
          usuario_id: finalUserId,
          academia_id: userAcademiaId || activeAcademiaId,
          modulo: "auth",
          acao: "login",
          descricao: "Efetuou login administrativo no sistema (Supabase Auth)",
          ip: "127.0.0.1"
        });

        // Retorna a estrutura esperada pelo frontend
        return {
          access_token: authData.session.access_token,
          token_type: "bearer",
          user: {
            id: finalUserId,
            nome: finalNome,
            login: username.split("@")[0],
            email: sessionUser.email,
            nivel: finalPerfil,
            academia_id: userAcademiaId || activeAcademiaId,
            avatar: finalNome[0].toUpperCase()
          }
        };
      }

      else if (path === "/auth/register" && methodUpper === "POST") {
        const { name, username, email, password } = body;
        if (!name || !username || !email || !password) {
          throw new Error("Por favor, preencha todos os campos obrigatórios.");
        }

        // O e-mail de login no Supabase
        const emailCadastro = email.includes("@") 
          ? email 
          : `${email.toLowerCase()}@${activeTenant ? activeTenant.slug.toLowerCase() : 'klif'}.com`;

        // Registra o novo usuário no Supabase Auth, passando os metadados para a Trigger registrar na tabela usuarios
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
          email: emailCadastro,
          password: password,
          options: {
            data: {
              name: name,
              nome: name,
              login: username.toLowerCase().trim(),
              perfil: "Secretaria",
              academia_id: activeAcademiaId,
              ativo: false // Começa inativo aguardando aprovação
            }
          }
        });

        if (authError) {
          if (authError.message.includes("usuarios_login_key") || authError.message.includes("duplicate key")) {
            throw new Error("Este nome de usuário já está em uso.");
          }
          if (authError.message.includes("already registered") || authError.message.includes("email already exists")) {
            throw new Error("Este e-mail já está em uso.");
          }
          throw new Error(authError.message);
        }

        return {
          status: "success",
          message: "Cadastro administrativo realizado com sucesso!",
          user: authData.user
        };
      }

      else if (path === "/auth/perfil" && methodUpper === "PUT") {
        if (!currentUserId) throw new Error("Sessão inválida.");
        const { nome, email } = body;

        const { data: userUpdated, error } = await supabaseClient
          .from("usuarios")
          .update({ nome })
          .eq("id", currentUserId)
          .select()
          .single();

        if (error) throw new Error("Erro ao atualizar os dados do perfil: " + error.message);

        // Registra log
        await supabaseClient.from("logs").insert({
          usuario_id: currentUserId,
          modulo: "auth",
          acao: "editar_perfil",
          descricao: `Alterou dados pessoais. Novo Nome: ${nome}`,
          ip: "127.0.0.1"
        });

        return {
          id: userUpdated.id,
          nome: userUpdated.nome,
          login: userUpdated.login,
          email: email || `${userUpdated.login}@bemestar.com`,
          nivel: userUpdated.perfil,
          avatar: userUpdated.nome[0].toUpperCase()
        };
      }

      else if (path === "/auth/senha" && methodUpper === "PUT") {
        if (!currentUserId) throw new Error("Sessão inválida.");
        const { senha_atual, senha_nova } = body;

        // 1. Obtém o usuário ativo do Supabase Auth para obter o e-mail
        const { data: { user: authUser }, error: getUserError } = await supabaseClient.auth.getUser();
        if (getUserError || !authUser) throw new Error("Usuário não autenticado no Supabase Auth.");

        // 2. Valida se a senha atual está correta tentando realizar sign-in
        const { error: signInError } = await supabaseClient.auth.signInWithPassword({
          email: authUser.email,
          password: senha_atual
        });
        if (signInError) {
          throw new Error("Senha atual incorreta.");
        }

        // 3. Atualiza a senha no Supabase Auth
        const { error: updateAuthError } = await supabaseClient.auth.updateUser({
          password: senha_nova
        });
        if (updateAuthError) {
          throw new Error("Erro ao atualizar senha no Supabase Auth: " + updateAuthError.message);
        }

        // 4. Registra log de auditoria
        await supabaseClient.from("logs").insert({
          usuario_id: currentUserId,
          academia_id: activeAcademiaId,
          modulo: "auth",
          acao: "alterar_senha",
          descricao: "Realizou alteração da senha de acesso administrativa",
          ip: "127.0.0.1"
        });

        return { status: "success", message: "Senha atualizada com sucesso." };
      }

      // 2. ROTAS DE PLANOS
      else if (path === "/planos") {
        if (methodUpper === "GET") {
          let query = supabaseClient.from("planos").select("*");
          if (activeAcademiaId) {
            query = query.eq("academia_id", activeAcademiaId);
          }
          const { data, error } = await query.order("id", { ascending: true });

          if (error) throw new Error("Erro ao buscar planos: " + error.message);
          return data;
        }

        else if (methodUpper === "POST") {
          const insertData = { ...body };
          if (activeAcademiaId) {
            insertData.academia_id = activeAcademiaId;
          }

          const { data: planoExiste } = await supabaseClient
            .from("planos")
            .select("id")
            .eq("nome", body.nome)
            .eq("academia_id", activeAcademiaId)
            .maybeSingle();

          if (planoExiste) {
            throw new Error("Já existe um plano cadastrado com este nome.");
          }

          const { data, error } = await supabaseClient
            .from("planos")
            .insert(insertData)
            .select()
            .single();

          if (error) throw new Error("Erro ao criar plano: " + error.message);

          // Log
          await supabaseClient.from("logs").insert({
            usuario_id: currentUserId,
            academia_id: activeAcademiaId,
            modulo: "planos",
            acao: "criar",
            descricao: `Criou o plano ${data.nome} com valor R$ ${data.valor}`,
            ip: "127.0.0.1"
          });

          return data;
        }
      }

      else if (path.startsWith("/planos/") && methodUpper === "PUT") {
        const id = parseInt(path.split("/")[2]);
        const { data: nomeExiste } = await supabaseClient
          .from("planos")
          .select("id")
          .eq("nome", body.nome)
          .eq("academia_id", activeAcademiaId)
          .neq("id", id)
          .maybeSingle();

        if (nomeExiste) {
          throw new Error("Já existe outro plano com este nome.");
        }

        const { data, error } = await supabaseClient
          .from("planos")
          .update(body)
          .eq("id", id)
          .eq("academia_id", activeAcademiaId)
          .select()
          .single();

        if (error) throw new Error("Erro ao atualizar plano: " + error.message);

        // Log
        await supabaseClient.from("logs").insert({
          usuario_id: currentUserId,
          academia_id: activeAcademiaId,
          modulo: "planos",
          acao: "editar",
          descricao: `Editou dados do plano ${data.nome}`,
          ip: "127.0.0.1"
        });

        return data;
      }

      // 3. ROTAS DE ALUNOS
      else if (path === "/alunos") {
        if (methodUpper === "GET") {
          const statusFilter = url.searchParams.get("status");
          const nomeFilter = url.searchParams.get("nome");
          const cpfFilter = url.searchParams.get("cpf");

          // Buscamos todos os alunos da academia para sincronizar os status de forma completa no banco
          let query = supabaseClient.from("alunos").select("*, planos(nome)");
          if (activeAcademiaId) {
            query = query.eq("academia_id", activeAcademiaId);
          }

          const { data: alunos, error } = await query;
          if (error) throw new Error("Erro ao buscar alunos: " + error.message);

          // Atualiza os status automaticamente com base nas regras (vencimento, dias de atraso)
          await atualizarStatusAutomatico(alunos, activeAcademiaId, currentUserId);

          // Busca todos os pagamentos confirmados para calcular total_pago localmente (evita N+1 queries no Postgres)
          let paymentQuery = supabaseClient.from("pagamentos").select("aluno_id, valor").eq("status", "confirmado");
          if (activeAcademiaId) {
            paymentQuery = paymentQuery.eq("academia_id", activeAcademiaId);
          }
          const { data: payments } = await paymentQuery;

          const paymentSums = {};
          if (payments) {
            payments.forEach(p => {
              paymentSums[p.aluno_id] = (paymentSums[p.aluno_id] || 0) + Number(p.valor);
            });
          }

          // Mapeia e filtra os dados localmente
          const mapeados = alunos.map(aluno => {
            let diasPausados = 0;
            if (aluno.observacoes && aluno.observacoes.includes("[Dias Pausados: ")) {
              try {
                const parte = aluno.observacoes.split("[Dias Pausados: ")[1].split("]")[0];
                diasPausados = parseInt(parte);
              } catch (e) {}
            }

            return {
              ...aluno,
              plano_nome: aluno.planos?.nome || null,
              total_pago: paymentSums[aluno.id] || 0,
              dias_pausados: diasPausados
            };
          });

          // Aplica os filtros em memória
          let resultado = mapeados;
          if (nomeFilter) {
            const term = nomeFilter.toLowerCase();
            resultado = resultado.filter(aluno => aluno.nome && aluno.nome.toLowerCase().includes(term));
          }
          if (cpfFilter) {
            resultado = resultado.filter(aluno => aluno.cpf === cpfFilter);
          }
          if (statusFilter) {
            resultado = resultado.filter(aluno => aluno.status === statusFilter);
          }

          return resultado;
        }

        else if (methodUpper === "POST") {
          const insertData = { ...body };
          if (activeAcademiaId) {
            insertData.academia_id = activeAcademiaId;
          }

          if (body.cpf) {
            const { data: cpfExiste } = await supabaseClient
              .from("alunos")
              .select("id")
              .eq("cpf", body.cpf)
              .eq("academia_id", activeAcademiaId)
              .maybeSingle();

            if (cpfExiste) {
              throw new Error("Já existe um aluno cadastrado com este CPF.");
            }
          }

          const { data: newAluno, error } = await supabaseClient
            .from("alunos")
            .insert(insertData)
            .select("*, planos(nome)")
            .single();

          if (error) throw new Error("Erro ao cadastrar aluno: " + error.message);

          // Registra histórico
          await supabaseClient.from("historico_aluno").insert({
            aluno_id: newAluno.id,
            usuario_id: currentUserId,
            academia_id: activeAcademiaId,
            tipo_evento: "cadastro",
            status_anterior: null,
            status_novo: newAluno.status,
            descricao: "Matrícula inicial criada no sistema."
          });

          // Registra log
          await supabaseClient.from("logs").insert({
            usuario_id: currentUserId,
            academia_id: activeAcademiaId,
            modulo: "alunos",
            acao: "cadastrar",
            descricao: `Cadastrou o aluno "${newAluno.nome}" (CPF: ${newAluno.cpf || '—'})`,
            ip: "127.0.0.1"
          });

          return {
            ...newAluno,
            plano_nome: newAluno.planos?.nome || null,
            total_pago: 0,
            dias_pausados: 0
          };
        }
      }

      else if (path.startsWith("/alunos/") && path.endsWith("/status") && methodUpper === "PATCH") {
        const id = parseInt(path.split("/")[2]);
        const action = url.searchParams.get("action");

        const { data: aluno, error: getError } = await supabaseClient
          .from("alunos")
          .select("*")
          .eq("id", id)
          .eq("academia_id", activeAcademiaId)
          .single();

        if (getError || !aluno) throw new Error("Aluno não encontrado.");

        const statusAnterior = aluno.status;
        let statusNovo = statusAnterior;
        let vencimentoNovo = aluno.vencimento;
        let observacoesNovas = aluno.observacoes || "";
        let descricaoHist = "";
        let logAcao = "";
        let logDesc = "";

        if (action === "pausar") {
          const hoje = new Date().toISOString().split("T")[0];
          let diasRestantes = 0;
          if (aluno.vencimento && aluno.vencimento > hoje) {
            const dataVenc = new Date(aluno.vencimento);
            const dataHoje = new Date(hoje);
            diasRestantes = Math.ceil((dataVenc - dataHoje) / (1000 * 60 * 60 * 24));
          }

          statusNovo = "pausa";
          vencimentoNovo = null;
          observacoesNovas = `[Dias Pausados: ${diasRestantes}] ` + observacoesNovas;
          descricaoHist = `Pausou matrícula. ${diasRestantes} dias de crédito preservados.`;
          logAcao = "pausar";
          logDesc = `Pausou a matrícula do aluno "${aluno.nome}" preservando ${diasRestantes} dias`;
        }

        else if (action === "retomar") {
          let diasPreservados = 0;
          if (observacoesNovas.includes("[Dias Pausados: ")) {
            try {
              const parte = observacoesNovas.split("[Dias Pausados: ")[1].split("]")[0];
              diasPreservados = parseInt(parte);
              observacoesNovas = observacoesNovas.replace(`[Dias Pausados: ${parte}] `, "");
            } catch (e) {}
          }

          const novoVencDate = new Date();
          novoVencDate.setDate(novoVencDate.getDate() + diasPreservados);
          vencimentoNovo = novoVencDate.toISOString().split("T")[0];
          statusNovo = "ativo";
          descricaoHist = `Retomou a matrícula. Novo vencimento recalculado: ${novoVencDate.toLocaleDateString('pt-BR')}`;
          logAcao = "retomar";
          logDesc = `Retomou a matrícula do aluno "${aluno.nome}" (Vencimento recalculado para ${vencimentoNovo})`;
        }

        else if (action === "inativar") {
          statusNovo = "inativo";
          vencimentoNovo = null;
          descricaoHist = "Inativou o cadastro por completo.";
          logAcao = "inativar";
          logDesc = `Inativou o cadastro do aluno "${aluno.nome}"`;
        }

        else {
          throw new Error("Ação inválida.");
        }

        const { data: updatedAluno, error: updateError } = await supabaseClient
          .from("alunos")
          .update({
            status: statusNovo,
            vencimento: vencimentoNovo,
            observacoes: observacoesNovas
          })
          .eq("id", id)
          .eq("academia_id", activeAcademiaId)
          .select("*, planos(nome)")
          .single();

        if (updateError) throw new Error("Erro ao atualizar status do aluno: " + updateError.message);

        // Registra histórico e log
        await supabaseClient.from("historico_aluno").insert({
          aluno_id: id,
          usuario_id: currentUserId,
          academia_id: activeAcademiaId,
          tipo_evento: action,
          status_anterior: statusAnterior,
          status_novo: statusNovo,
          descricao: descricaoHist
        });

        await supabaseClient.from("logs").insert({
          usuario_id: currentUserId,
          academia_id: activeAcademiaId,
          modulo: "alunos",
          acao: logAcao,
          descricao: logDesc,
          ip: "127.0.0.1"
        });

        let diasPausados = 0;
        if (updatedAluno.observacoes && updatedAluno.observacoes.includes("[Dias Pausados: ")) {
          try {
            const parte = updatedAluno.observacoes.split("[Dias Pausados: ")[1].split("]")[0];
            diasPausados = parseInt(parte);
          } catch (e) {}
        }

        return {
          ...updatedAluno,
          plano_nome: updatedAluno.planos?.nome || null,
          dias_pausados: diasPausados
        };
      }

      else if (path.startsWith("/alunos/") && methodUpper === "PUT") {
        const id = parseInt(path.split("/")[2]);

        if (body.cpf) {
          const { data: cpfExiste } = await supabaseClient
            .from("alunos")
            .select("id")
            .eq("cpf", body.cpf)
            .eq("academia_id", activeAcademiaId)
            .neq("id", id)
            .maybeSingle();

          if (cpfExiste) {
            throw new Error("Já existe outro aluno cadastrado com este CPF.");
          }
        }

        const { data: updatedAluno, error } = await supabaseClient
          .from("alunos")
          .update(body)
          .eq("id", id)
          .eq("academia_id", activeAcademiaId)
          .select("*, planos(nome)")
          .single();

        if (error) throw new Error("Erro ao editar dados cadastrais do aluno: " + error.message);

        // Historico e log
        await supabaseClient.from("historico_aluno").insert({
          aluno_id: id,
          usuario_id: currentUserId,
          academia_id: activeAcademiaId,
          tipo_evento: "edicao",
          status_anterior: updatedAluno.status,
          status_novo: updatedAluno.status,
          descricao: "Atualizou informações cadastrais."
        });

        await supabaseClient.from("logs").insert({
          usuario_id: currentUserId,
          academia_id: activeAcademiaId,
          modulo: "alunos",
          acao: "editar",
          descricao: `Editou os dados cadastrais do aluno "${updatedAluno.nome}"`,
          ip: "127.0.0.1"
        });

        return {
          ...updatedAluno,
          plano_nome: updatedAluno.planos?.nome || null
        };
      }

      // 4. ROTAS DE PAGAMENTOS
      else if (path === "/pagamentos") {
        if (methodUpper === "GET") {
          let query = supabaseClient.from("pagamentos").select("*, alunos(nome, whatsapp, telefone), planos(nome), usuarios(nome)");
          if (activeAcademiaId) {
            query = query.eq("academia_id", activeAcademiaId);
          }
          const { data: pagamentos, error } = await query.order("criado_em", { ascending: false });

          if (error) throw new Error("Erro ao buscar pagamentos: " + error.message);

          return pagamentos.map(p => ({
            ...p,
            aluno_nome: p.alunos?.nome || "Aluno Removido",
            plano_nome: p.planos?.nome || "Plano Removido",
            operador_nome: p.usuarios?.nome || "Operador Desconhecido"
          }));
        }

        else if (methodUpper === "POST") {
          const { aluno_id, plano_id, valor, forma_pagamento, data_pagamento, novo_vencimento, observacoes } = body;

          // Busca dados do aluno e do plano (filtrados por academia_id)
          const { data: aluno } = await supabaseClient.from("alunos").select("status, nome").eq("id", aluno_id).eq("academia_id", activeAcademiaId).single();
          const { data: plano } = await supabaseClient.from("planos").select("nome").eq("id", plano_id).eq("academia_id", activeAcademiaId).single();

          if (!aluno) throw new Error("Aluno não encontrado.");
          if (!plano) throw new Error("Plano não encontrado.");

          const statusAnterior = aluno.status;

          // Atualiza dados do aluno para ativo, vencimento atualizado
          const { error: updateError } = await supabaseClient
            .from("alunos")
            .update({
              status: "ativo",
              vencimento: novo_vencimento
            })
            .eq("id", aluno_id)
            .eq("academia_id", activeAcademiaId);

          if (updateError) throw new Error("Erro ao atualizar matrícula do aluno: " + updateError.message);

          // Registra o pagamento
          const { data: pagamento, error: insertError } = await supabaseClient
            .from("pagamentos")
            .insert({
              aluno_id,
              plano_id,
              registrado_por: currentUserId || 1,
              academia_id: activeAcademiaId,
              valor,
              forma_pagamento,
              data_pagamento,
              novo_vencimento,
              observacoes,
              status: "confirmado"
            })
            .select()
            .single();

          if (insertError) throw new Error("Erro ao registrar o pagamento: " + insertError.message);

          // Histórico do Aluno
          const valorFormatado = Number(valor).toFixed(2).replace(".", ",");
          await supabaseClient.from("historico_aluno").insert({
            aluno_id,
            usuario_id: currentUserId,
            academia_id: activeAcademiaId,
            tipo_evento: "pagamento",
            status_anterior: statusAnterior,
            status_novo: "ativo",
            descricao: `Mensalidade registrada: R$ ${valorFormatado} via ${forma_pagamento.toUpperCase()}.`
          });

          // Log de Auditoria
          await supabaseClient.from("logs").insert({
            usuario_id: currentUserId,
            academia_id: activeAcademiaId,
            modulo: "alunos",
            acao: "pagamento",
            descricao: `Registrou pagamento do plano ${plano.nome} (R$ ${valorFormatado}) para o aluno "${aluno.nome}"`,
            ip: "127.0.0.1"
          });

          return {
            ...pagamento,
            aluno_nome: aluno.nome,
            plano_nome: plano.nome,
            operador_nome: currentUser?.nome || "Sistema"
          };
        }
      }

      // 5. ROTAS DE CONFIGURAÇÕES (Mapeadas para a tabela academias)
      else if (path === "/configuracoes") {
        if (methodUpper === "GET") {
          if (!activeAcademiaId) throw new Error("Academia não selecionada.");
          const { data: acad, error } = await supabaseClient
            .from("academias")
            .select("*")
            .eq("id", activeAcademiaId)
            .single();

          if (error) throw new Error("Erro ao buscar configurações: " + error.message);

          // Retorna no formato de configurações esperado pelo frontend
          return {
            nomeAcademia: acad.nome,
            whatsapp: acad.whatsapp,
            logo: acad.logo_url,
            endereco: acad.endereco,
            diasNotificacaoVencimento: acad.dias_notificacao_vencimento || 3,
            templateMensagem: acad.template_mensagem || 'Olá, {nome}. Seu plano {plano} vence em {vencimento}.',
            tipoChavePix: acad.tipo_chave_pix || 'cnpj',
            chavePix: acad.chave_pix || '',
            beneficiarioPix: acad.beneficiario_pix || '',
            cidadePix: acad.cidade_pix || ''
          };
        }

        else if (methodUpper === "POST") {
          if (!activeAcademiaId) throw new Error("Academia não selecionada.");

          const updateData = {
            nome: body.nomeAcademia,
            whatsapp: body.whatsapp,
            logo_url: body.logo,
            endereco: body.endereco,
            dias_notificacao_vencimento: parseInt(body.diasNotificacaoVencimento) || 3,
            template_mensagem: body.templateMensagem,
            tipo_chave_pix: body.tipoChavePix,
            chave_pix: body.chavePix,
            beneficiario_pix: body.beneficiarioPix,
            cidade_pix: body.cidadePix
          };

          const { error } = await supabaseClient
            .from("academias")
            .update(updateData)
            .eq("id", activeAcademiaId);

          if (error) throw new Error("Erro ao salvar configurações da academia: " + error.message);

          // Registra Log
          await supabaseClient.from("logs").insert({
            usuario_id: currentUserId,
            academia_id: activeAcademiaId,
            modulo: "configuracoes",
            acao: "editar",
            descricao: "Atualizou as configurações gerais do sistema",
            ip: "127.0.0.1"
          });

          return { status: "success", message: "Configurações atualizadas." };
        }
      }

      else if (path === "/configuracoes/importar" && methodUpper === "POST") {
        if (!activeAcademiaId) throw new Error("Academia não selecionada.");
        const backupData = body;
        
        // Limpa tabelas da ACADEMIA ATIVA apenas!
        await supabaseClient.from("pagamentos").delete().eq("academia_id", activeAcademiaId);
        await supabaseClient.from("historico_aluno").delete().eq("academia_id", activeAcademiaId);
        await supabaseClient.from("alunos").delete().eq("academia_id", activeAcademiaId);
        await supabaseClient.from("planos").delete().eq("academia_id", activeAcademiaId);
        await supabaseClient.from("logs").delete().eq("academia_id", activeAcademiaId);

        // Importa Planos
        const planosDict = {};
        for (const p of backupData.planos || []) {
          const { data: insertedPlan } = await supabaseClient
            .from("planos")
            .insert({
              nome: p.nome,
              valor: p.valor,
              quantidade_dias: p.quantidade_dias || p.duracao_dias || 30,
              status: p.status || "ativo",
              descricao: p.descricao,
              academia_id: activeAcademiaId
            })
            .select()
            .single();

          if (insertedPlan) {
            planosDict[p.nome.toLowerCase()] = insertedPlan.id;
          }
        }

        // Importa Alunos
        for (const a of backupData.alunos || []) {
          let planoId = a.plano_id;
          if (!planoId && a.plano_nome) {
            planoId = planosDict[a.plano_nome.toLowerCase()];
          }

          await supabaseClient.from("alunos").insert({
            nome: a.nome,
            cpf: a.cpf,
            data_nasc: a.data_nasc ? a.data_nasc.split("T")[0] : null,
            sexo: a.sexo,
            telefone: a.telefone,
            whatsapp: a.whatsapp || a.telefone,
            email: a.email,
            cep: a.cep,
            rua: a.rua,
            numero: a.numero,
            bairro: a.bairro,
            cidade: a.cidade,
            estado: a.estado,
            status: a.status || "ativo",
            plano_id: planoId,
            data_matricula: a.data_matricula ? a.data_matricula.split("T")[0] : new Date().toISOString().split("T")[0],
            vencimento: a.vencimento ? a.vencimento.split("T")[0] : null,
            observacoes: a.observacoes,
            academia_id: activeAcademiaId
          });
        }

        // Importa Pagamentos
        for (const p of backupData.pagamentos || []) {
          let planoId = p.plano_id;
          if (!planoId && p.plano_nome) {
            planoId = planosDict[p.plano_nome.toLowerCase()];
          }

          await supabaseClient.from("pagamentos").insert({
            aluno_id: p.aluno_id,
            plano_id: planoId || 1,
            registrado_por: currentUserId || 1,
            valor: p.valor,
            forma_pagamento: p.forma_pagamento || p.forma || "pix",
            data_pagamento: p.data_pagamento ? p.data_pagamento.split("T")[0] : new Date().toISOString().split("T")[0],
            novo_vencimento: p.novo_vencimento ? p.novo_vencimento.split("T")[0] : new Date().toISOString().split("T")[0],
            status: p.status || "confirmado",
            observacoes: p.observacoes,
            academia_id: activeAcademiaId
          });
        }

        // Importa Logs
        for (const l of backupData.logs || []) {
          await supabaseClient.from("logs").insert({
            usuario_id: currentUserId || 1,
            modulo: l.modulo || "sistema",
            acao: l.acao || "importar",
            descricao: l.descricao || l.detalhe,
            ip: l.ip || "127.0.0.1",
            criado_em: l.criado_em || l.data || new Date().toISOString(),
            academia_id: activeAcademiaId
          });
        }

        return { status: "success", message: "Backup importado com sucesso no Supabase." };
      }

      // 5.1. ROTA DE USUÁRIOS (Para Filtro de Auditoria e Aprovação)
      else if (path === "/usuarios" && methodUpper === "GET") {
        if (!currentUserId || !currentUser) {
          throw new Error("Não autorizado.");
        }

        const userRole = currentUser.nivel;

        let query = supabaseClient
          .from("usuarios")
          .select("id, nome, perfil, login, ativo, email, academia_id, uuid, academias(nome)");
        if (activeAcademiaId && userRole !== "Administrador") {
          query = query.eq("academia_id", activeAcademiaId);
        }
        
        // Se não for Administrador ou se não for solicitado explicitamente, só retorna os ativos
        const incluirInativos = url.searchParams.get("incluir_inativos") === "true";
        if (userRole !== "Administrador" || !incluirInativos) {
          query = query.eq("ativo", true);
        }

        const { data: users, error } = await query;

        if (error) throw new Error("Erro ao buscar usuários: " + error.message);

        const mappedUsers = users.map(u => ({
          ...u,
          academia_nome: u.academias?.nome || "Super Admin"
        }));

        // Filtro de segurança para retorno da lista de usuários
        if (userRole === "Secretaria") {
          // Secretaria só vê ela mesma
          return mappedUsers.filter(u => u.id === currentUserId);
        } else if (userRole === "Gerente Geral") {
          // Gerente Geral vê todos exceto Administradores
          return mappedUsers.filter(u => u.perfil !== "Administrador");
        }
        
        // Administrador vê todos
        return mappedUsers;
      }

      else if (path === "/usuarios/aprovar" && methodUpper === "POST") {
        if (!currentUserId || !currentUser || currentUser.nivel !== "Administrador") {
          throw new Error("Acesso não autorizado. Apenas administradores podem aprovar usuários.");
        }

        const { id, perfil } = body;
        let query = supabaseClient
          .from("usuarios")
          .update({ ativo: true, perfil: perfil })
          .eq("id", id);
        if (activeAcademiaId && currentUser.nivel !== "Administrador") {
          query = query.eq("academia_id", activeAcademiaId);
        }
        const { data, error } = await query.select().single();

        if (error) throw new Error("Erro ao aprovar usuário: " + error.message);

        // Registra o Log de Auditoria
        await supabaseClient.from("logs").insert({
          usuario_id: currentUserId,
          academia_id: activeAcademiaId,
          modulo: "seguranca",
          acao: "aprovar_usuario",
          descricao: `Aprovou o acesso do operador "${data.nome}" (${data.login}) como ${perfil}`,
          ip: "127.0.0.1"
        });

        return data;
      }

      else if (path === "/usuarios/rejeitar" && methodUpper === "POST") {
        if (!currentUserId || !currentUser || currentUser.nivel !== "Administrador") {
          throw new Error("Acesso não autorizado. Apenas administradores podem rejeitar usuários.");
        }

        const { id } = body;

        // Busca dados do usuário antes de deletar para o Log de Auditoria
        let querySelect = supabaseClient
          .from("usuarios")
          .select("nome, login")
          .eq("id", id);
        if (activeAcademiaId && currentUser.nivel !== "Administrador") {
          querySelect = querySelect.eq("academia_id", activeAcademiaId);
        }
        const { data: userToDel } = await querySelect.maybeSingle();

        let queryDelete = supabaseClient
          .from("usuarios")
          .delete()
          .eq("id", id);
        if (activeAcademiaId && currentUser.nivel !== "Administrador") {
          queryDelete = queryDelete.eq("academia_id", activeAcademiaId);
        }
        const { error } = await queryDelete;

        if (error) throw new Error("Erro ao rejeitar usuário: " + error.message);

        // Registra o Log de Auditoria
        if (userToDel) {
          await supabaseClient.from("logs").insert({
            usuario_id: currentUserId,
            academia_id: activeAcademiaId,
            modulo: "seguranca",
            acao: "rejeitar_usuario",
            descricao: `Rejeitou a solicitação de acesso do operador "${userToDel.nome}" (${userToDel.login})`,
            ip: "127.0.0.1"
          });
        }

        return { status: "success" };
      }

      else if (path === "/academias" && methodUpper === "GET") {
        if (!currentUserId || !currentUser || currentUser.nivel !== "Administrador") {
          throw new Error("Acesso não autorizado.");
        }
        const { data: academias, error } = await supabaseClient
          .from("academias")
          .select("id, nome")
          .order("nome", { ascending: true });

        if (error) throw new Error("Erro ao buscar academias: " + error.message);
        return academias;
      }

      else if (path === "/usuarios/atualizar" && methodUpper === "POST") {
        if (!currentUserId || !currentUser || currentUser.nivel !== "Administrador") {
          throw new Error("Acesso não autorizado.");
        }
        const { id, perfil, academia_id } = body;
        const { data, error } = await supabaseClient.rpc("admin_update_user", {
          user_id: id,
          new_perfil: perfil,
          new_academia_id: academia_id
        });
        if (error) throw new Error("Erro ao atualizar perfil e academia do operador: " + error.message);
        return { status: "success" };
      }

      else if (path === "/usuarios/alterar-senha" && methodUpper === "POST") {
        if (!currentUserId || !currentUser || currentUser.nivel !== "Administrador") {
          throw new Error("Acesso não autorizado.");
        }
        const { uuid, senha } = body;
        const { data, error } = await supabaseClient.rpc("admin_reset_user_password", {
          user_uuid: uuid,
          new_password: senha
        });
        if (error) throw new Error("Erro ao alterar senha do operador: " + error.message);
        return { status: "success" };
      }

      else if (path === "/usuarios/excluir" && methodUpper === "POST") {
        if (!currentUserId || !currentUser || currentUser.nivel !== "Administrador") {
          throw new Error("Acesso não autorizado.");
        }
        const { id } = body;
        const { data, error } = await supabaseClient.rpc("admin_delete_user", {
          user_id: id
        });
        if (error) throw new Error("Erro ao excluir operador: " + error.message);
        return { status: "success" };
      }

      // 6. ROTAS DE LOGS
      else if (path === "/logs" && methodUpper === "GET") {
        if (!currentUserId || !currentUser) {
          throw new Error("Não autorizado.");
        }

        const userRole = currentUser.nivel;

        let query = supabaseClient
          .from("logs")
          .select("*, usuarios(nome, perfil)");
        if (activeAcademiaId && userRole !== "Administrador") {
          query = query.eq("academia_id", activeAcademiaId);
        }
        const { data: logs, error } = await query.order("criado_em", { ascending: false });

        if (error) throw new Error("Erro ao buscar logs de auditoria: " + error.message);

        // Filtro de segurança por perfil
        let logsFiltrados = logs;

        if (userRole === "Secretaria") {
          // Secretaria vê apenas os seus próprios logs
          logsFiltrados = logs.filter(l => l.usuario_id === currentUserId);
        } else if (userRole === "Gerente Geral") {
          // Gerente Geral vê os dele mesmo, secretarias e outros gerentes. Não vê administradores.
          logsFiltrados = logs.filter(l => {
            const perfilOperador = l.usuarios?.perfil;
            return perfilOperador !== "Administrador";
          });
        }
        // Administrador vê todos.

        // Se o frontend enviar filtro por usuario_id específico na query string
        const usuarioFiltro = url.searchParams.get("usuario_id");
        if (usuarioFiltro) {
          const targetId = parseInt(usuarioFiltro);
          logsFiltrados = logsFiltrados.filter(l => l.usuario_id === targetId);
        }

        return logsFiltrados.map(l => ({
          ...l,
          usuario_nome: l.usuarios?.nome || "Sistema"
        }));
      }

      throw new Error(`Endpoint não implementado no Supabase Adapter: ${method} ${path}`);
    } catch (e) {
      console.error("Erro capturado no Adaptador Supabase:", e);
      throw e;
    }
  }
};
