# 🏛️ KlifAcademy — Sistema de Gestão Multitenant para Academias

O **KlifAcademy** é uma plataforma moderna e completa de gestão administrativa desenvolvida sob o conceito de **multitenancy (múltiplas organizações)**. Ela permite que diferentes academias  compartilhem a mesma infraestrutura de banco de dados com isolamento completo e seguro de seus dados.

Este projeto combina um frontend extremamente fluido e premium baseado em **Glassmorphism** e **Vanilla CSS** a um ecossistema de banco de dados robusto integrado ao **Supabase**.

---

## ⚡ Principais Recursos

### 👥 1. Portal Multitenant Dinâmico (KlifAcademy & Branding Personalizado)
* **Tela de Entrada Geral (KlifAcademy):** Apresenta uma estética rúnica e arcana com animações de gradiente em tempo real.
* **Seleção de Tenant (Gym Slug):** O operador digita o código identificador da sua academia. O sistema carrega instantaneamente no frontend o logotipo, nome e esquema de cores personalizados da academia desejada.

### 🔒 2. Segurança e Isolamento de Dados Rigorosos (RLS)
* **PostgreSQL Row Level Security (RLS):** Toda e qualquer tabela do banco de dados é blindada no nível do banco.
* **Prevenção de Vulnerabilidades:** Utilização de funções utilitárias nativas em PL/pgSQL declaradas como `SECURITY DEFINER` com `search_path` fixo, prevenindo ataques de escalabilidade de privilégios via `user_metadata` ou manipulação de sessões no frontend.

### 📋 3. Gestão Completa de Alunos e Matrículas
* **Controle de Status:** Cadastro inteligente de alunos (Ativo, Pausado, Inativo, Aguardando).
* **Pausa e Retomada de Planos:** Permite pausar matrículas preservando os dias de crédito do aluno, recalculando a nova data de vencimento automaticamente ao retomar.

### 💰 4. Controle Financeiro e de Planos
* **Planos Customizáveis:** Criação de pacotes com valores, durações e regras associadas a cada academia.
* **Fluxo de Caixa e Pagamentos:** Registro de mensalidades com formas de pagamento e cálculo automático do total pago acumulado por aluno.

### 🛡️ 5. Logs de Auditoria (Activity Trail)
* Rastreamento detalhado de todas as operações administrativas feitas por qualquer operador (Logins, alterações cadastrais, matrículas, pagamentos, suspensões).

---

## 🛠️ Stack Tecnológica

* **Frontend:** 
  * HTML5 Semântico.
  * Vanilla CSS3 (Design System proprietário com suporte a variáveis CSS nativas, temas escuros/claros dinâmicos e micro-animações).
  * JavaScript Puro (ES6+) para roteamento e controle lógico.
* **Backend & Banco de Dados (BaaS):**
  * **Supabase** (Autenticação JWT, Postgres Database, RLS Policies e Triggers).
  * **PostgreSQL** para procedimentos armazenados e funções utilitárias.

---

## 📂 Estrutura do Projeto

```text
├── KlifAcademy/
│   ├── Assets/                 # Logotipos, ícones e backgrounds (ex: bgacademia.png)
│   ├── css/
│   │   ├── designSystem.css    # Variáveis globais de cores, espaçamentos e fontes
│   │   └── styleLogin.css      # Estilização do portal e dos temas (Klif / Academias)
│   ├── js/
│   │   ├── api.js              # Integração cliente com a API do Supabase e rotas simutâneas
│   │   └── jsLogin.js          # Controle lógico do slider de login e aplicação de branding
│   ├── painel/                 # Painel do Dashboard administrativo do operador
│   │   ├── Painel.html
│   │   ├── jsPainel.js
│   │   └── stylePainel.css
│   ├── alunos/                 # Módulo de cadastro e gestão de alunos
│   ├── planos/                 # Módulo de gerenciamento de planos
│   ├── pagamentos/             # Histórico e controle financeiro
│   ├── configuracoes/          # Customizações do tenant (Pix, WhatsApp, etc.)
│   ├── index.html              # Ponto de entrada do sistema (Login/Seleção)
│   └── banco_politicas.sql     # Script SQL contendo a estrutura de RLS e Triggers do banco
└── README.md
```

---



## 💎 Créditos e Autoria

Este software foi concebido e estruturado sob os mais rígidos padrões de qualidade técnica e visual, com destaque para a criação original da identidade e portal **KlifAcademy** desenvolvido e gerenciado por Léo Júnio Souza de Jesus.

*Desenvolvido com foco em alta performance, usabilidade extrema e segurança de dados moderna.*
