document.addEventListener("DOMContentLoaded", () => {
  const slider = document.querySelector(".login-slider");
  const loginContainer = document.querySelector(".login-container");

  const logoImg = document.getElementById("login-logo-img");
  const titleEl = document.getElementById("login-title");
  const subtitleText = document.getElementById("login-subtitle-text");

  // Navegação entre Formulários (4 painéis)
  window.showForm = function (formIndex) {
    // Remove alertas ativos ao mudar de tela
    document.querySelectorAll(".login-alert").forEach((alert) => alert.remove());

    // Desloca o slider (0%, -25%, -50%, -75%)
    const offset = formIndex * -25;
    slider.style.transform = `translateX(${offset}%)`;

    // Atualiza subtítulo com base no formulário ativo
    if (!subtitleText) return;

    const activeTenant = JSON.parse(localStorage.getItem("wpa_tenant_ativo"));
    const nomeAcademia = activeTenant ? activeTenant.nome : "Klif-Academy";

    if (formIndex === 0) {
      subtitleText.textContent = "Digite o código da academia para continuar";
    } else if (formIndex === 1) {
      subtitleText.textContent = `Acesse sua conta na ${nomeAcademia}`;
    } else if (formIndex === 2) {
      subtitleText.textContent = `Cadastre sua conta de operador na ${nomeAcademia}`;
    } else if (formIndex === 3) {
      subtitleText.textContent = "Recupere o acesso à sua conta";
    }
  };

  // Aplica o branding dinamicamente com base na academia ativa
  window.aplicarBrandingAcademia = function (tenant) {
    if (tenant) {
      document.body.classList.remove("klif-theme");
      if (logoImg && tenant.logo_url) {
        logoImg.src = tenant.logo_url.replace('../', '');
      }
      if (titleEl) {
        const partes = tenant.nome.split(" ");
        const first = partes[0] || "";
        const rest = partes.slice(1).join(" ") || "";
        titleEl.innerHTML = `<strong>${first}</strong><span>${rest}</span>`;
      }
      showForm(1); // Direciona para o painel de login (Pane 1)
    } else {
      document.body.classList.add("klif-theme");
      if (logoImg) {
        logoImg.src = "Assets/logoKlif.png"; // Logo genérica
      }
      if (titleEl) {
        titleEl.innerHTML = `<strong>Klif</strong><span>Academy</span>`;
      }
      showForm(0); // Direciona para seleção de academia (Pane 0)
    }
  };

  // Inicializa o portal checando se já possui tenant ativo
  const activeTenant = JSON.parse(localStorage.getItem("wpa_tenant_ativo"));
  aplicarBrandingAcademia(activeTenant);

  // --- FORMULÁRIO DE SELEÇÃO DE ACADEMIA ---
  const formSelect = document.getElementById("form-select-tenant");
  const paneSelect = document.getElementById("pane-select-tenant");

  if (formSelect) {
    formSelect.addEventListener("submit", async (e) => {
      e.preventDefault();
      const slugInput = document.getElementById("select-tenant-slug");
      const submitBtn = formSelect.querySelector(".btn-submit");

      const slug = slugInput.value.trim().toLowerCase();
      if (!slug) {
        showAlert(paneSelect, "Por favor, digite o código de acesso.", "error");
        return;
      }

      submitBtn.classList.add("loading");
      document.querySelectorAll(".login-alert").forEach((alert) => alert.remove());

      try {
        const academia = await api.request(`/academias/verificar?slug=${slug}`, "GET");
        submitBtn.classList.remove("loading");
        
        // Salva a academia selecionada na sessão local
        localStorage.setItem("wpa_tenant_ativo", JSON.stringify(academia));
        
        showAlert(paneSelect, `Carregando portal da ${academia.nome}...`, "success");
        
        setTimeout(() => {
          aplicarBrandingAcademia(academia);
          slugInput.value = "";
        }, 1000);

      } catch (err) {
        submitBtn.classList.remove("loading");
        showAlert(paneSelect, err.message || "Código da academia inválido.", "error");
      }
    });
  }

  // --- AÇÃO MUDAR DE ACADEMIA ---
  const btnChangeTenant = document.getElementById("link-change-tenant");
  if (btnChangeTenant) {
    btnChangeTenant.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem("wpa_tenant_ativo");
      localStorage.removeItem("wpa_usuario_logado");
      localStorage.removeItem("wpa_token");
      aplicarBrandingAcademia(null);
    });
  }

  // Alternar Visibilidade da Senha
  const togglePasswordBtns = document.querySelectorAll(".btn-toggle-password");
  togglePasswordBtns.forEach((btn) => {
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

  // Função Auxiliar para Exibir Alertas
  function showAlert(paneElement, message, type = "error") {
    const oldAlert = paneElement.querySelector(".login-alert");
    if (oldAlert) oldAlert.remove();

    const alertDiv = document.createElement("div");
    alertDiv.className = `login-alert ${type}`;

    const icon = document.createElement("i");
    if (type === "error") {
      icon.className = "fa-solid fa-circle-exclamation";
    } else {
      icon.className = "fa-solid fa-circle-check";
    }

    const textSpan = document.createElement("span");
    textSpan.textContent = message;

    alertDiv.appendChild(icon);
    alertDiv.appendChild(textSpan);

    paneElement.insertBefore(alertDiv, paneElement.firstChild);
  }

  // --- SUBMISSÃO DE FORMULÁRIOS ---

  // 1. Formulário de Login
  const loginForm = document.getElementById("form-login");
  const loginPane = document.getElementById("pane-login");

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById("login-username");
    const passwordInput = document.getElementById("login-password");
    const submitBtn = loginForm.querySelector(".btn-submit");

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      showAlert(loginPane, "Por favor, preencha todos os campos obrigatórios.", "error");
      return;
    }

    submitBtn.classList.add("loading");
    document.querySelectorAll(".login-alert").forEach((alert) => alert.remove());

    api.request("/auth/login", "POST", { username, password })
      .then((data) => {
        submitBtn.classList.remove("loading");
        showAlert(loginPane, `Bem-vindo de volta, ${data.user.nome}! Redirecionando...`, "success");

        localStorage.setItem("wpa_token", data.access_token);
        localStorage.setItem("wpa_usuario_logado", JSON.stringify(data.user));

        setTimeout(() => {
          window.location.replace("painel/Painel.html");
        }, 1000);
      })
      .catch((err) => {
        submitBtn.classList.remove("loading");
        showAlert(loginPane, err.message || "Erro de conexão com o servidor.", "error");
      });
  });

  // 2. Formulário de Cadastro
  const registerForm = document.getElementById("form-register");
  const registerPane = document.getElementById("pane-register");

  registerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("reg-name");
    const usernameInput = document.getElementById("reg-username");
    const emailInput = document.getElementById("reg-email");
    const passwordInput = document.getElementById("reg-password");
    const confirmInput = document.getElementById("reg-confirm-password");
    const termsCheck = document.getElementById("reg-terms");
    const submitBtn = registerForm.querySelector(".btn-submit");

    const name = nameInput.value.trim();
    const username = usernameInput.value.trim().toLowerCase();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;

    if (!name || !username || !email || !password || !confirmPassword) {
      showAlert(registerPane, "Todos os campos de cadastro são obrigatórios.", "error");
      return;
    }

    // Validação de Nome de Usuário (apenas letras, números, pontos e traços)
    const usernameRegex = /^[a-z0-9._-]+$/;
    if (!usernameRegex.test(username)) {
      showAlert(registerPane, "Nome de usuário inválido. Use apenas letras minúsculas, números, pontos (.) ou traços (-).", "error");
      return;
    }

    if (username.length < 3) {
      showAlert(registerPane, "O nome de usuário deve conter no mínimo 3 caracteres.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showAlert(registerPane, "As senhas não coincidem. Tente novamente.", "error");
      return;
    }

    if (password.length < 6) {
      showAlert(registerPane, "A senha deve conter no mínimo 6 caracteres.", "error");
      return;
    }

    if (!termsCheck.checked) {
      showAlert(registerPane, "Você precisa aceitar os Termos e Políticas para se cadastrar.", "error");
      return;
    }

    // Inicia carregamento
    submitBtn.classList.add("loading");
    document.querySelectorAll(".login-alert").forEach((alert) => alert.remove());

    api.request("/auth/register", "POST", { name, username, email, password })
      .then((data) => {
        submitBtn.classList.remove("loading");
        showAlert(registerPane, "Cadastro administrativo realizado com sucesso!", "success");

        // Limpa formulário
        registerForm.reset();

        // Volta para o login após sucesso
        setTimeout(() => {
          showForm(1);
          // Exibe um alerta de sucesso no login informando que pode logar
          showAlert(loginPane, "Cadastro concluído. Insira suas credenciais para entrar.", "success");
        }, 1500);
      })
      .catch((err) => {
        submitBtn.classList.remove("loading");
        showAlert(registerPane, err.message || "Erro ao realizar cadastro.", "error");
      });
  });

  // 3. Formulário de Esqueci a Senha
  const forgotForm = document.getElementById("form-forgot");
  const forgotPane = document.getElementById("pane-forgot");

  forgotForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const emailInput = document.getElementById("forgot-email");
    const submitBtn = forgotForm.querySelector(".btn-submit");
    const email = emailInput.value.trim();

    if (!email) {
      showAlert(forgotPane, "Por favor, informe seu e-mail cadastrado.", "error");
      return;
    }

    // Validação básica de e-mail regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert(forgotPane, "Por favor, insira um e-mail válido.", "error");
      return;
    }

    // Inicia carregamento
    submitBtn.classList.add("loading");
    document.querySelectorAll(".login-alert").forEach((alert) => alert.remove());

    setTimeout(() => {
      submitBtn.classList.remove("loading");
      showAlert(forgotPane, "Link de redefinição enviado para " + email, "success");
      forgotForm.reset();

      setTimeout(() => {
        showForm(1);
        showAlert(loginPane, "Verifique sua caixa de entrada para redefinir a senha.", "success");
      }, 2000);
    }, 1500);
  });
});
