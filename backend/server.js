const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

// Explicit CORS configuration allowing all origins and custom headers
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-academia-id']
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

const PORT = 3000;
const JWT_SECRET = 'klifacademy_local_secret_key';
const DB_PATH = path.join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco SQLite:', err.message);
  } else {
    console.log('Conectado ao banco SQLite em:', DB_PATH);
    initDatabase();
  }
});

// Promisified DB functions
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDatabase() {
  try {
    await dbRun(`CREATE TABLE IF NOT EXISTS academias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      logo_url TEXT,
      whatsapp TEXT,
      endereco TEXT,
      dias_notificacao_vencimento INTEGER DEFAULT 3,
      template_mensagem TEXT DEFAULT 'Olá, {nome}. Seu plano {plano} vence em {vencimento}.',
      tipo_chave_pix TEXT DEFAULT 'cnpj',
      chave_pix TEXT DEFAULT '',
      beneficiario_pix TEXT DEFAULT '',
      cidade_pix TEXT DEFAULT '',
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      login TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      perfil TEXT NOT NULL,
      ativo INTEGER DEFAULT 0,
      academia_id INTEGER,
      uuid TEXT UNIQUE,
      email TEXT UNIQUE,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE SET NULL
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS planos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      valor REAL NOT NULL,
      quantidade_dias INTEGER NOT NULL,
      status TEXT DEFAULT 'ativo',
      descricao TEXT,
      observacoes TEXT,
      academia_id INTEGER,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE CASCADE
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS alunos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cpf TEXT,
      data_nasc TEXT,
      sexo TEXT,
      telefone TEXT,
      whatsapp TEXT,
      email TEXT,
      cep TEXT,
      rua TEXT,
      numero TEXT,
      bairro TEXT,
      cidade TEXT,
      estado TEXT,
      status TEXT DEFAULT 'ativo',
      plano_id INTEGER,
      data_matricula TEXT,
      vencimento TEXT,
      observacoes TEXT,
      academia_id INTEGER,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plano_id) REFERENCES planos(id) ON DELETE SET NULL,
      FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE CASCADE
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS pagamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aluno_id INTEGER NOT NULL,
      plano_id INTEGER,
      registrado_por INTEGER,
      academia_id INTEGER NOT NULL,
      valor REAL NOT NULL,
      forma_pagamento TEXT NOT NULL,
      data_pagamento TEXT NOT NULL,
      novo_vencimento TEXT NOT NULL,
      observacoes TEXT,
      status TEXT DEFAULT 'confirmado',
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
      FOREIGN KEY (plano_id) REFERENCES planos(id) ON DELETE SET NULL,
      FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
      FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE CASCADE
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS historico_aluno (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aluno_id INTEGER NOT NULL,
      usuario_id INTEGER,
      academia_id INTEGER NOT NULL,
      tipo_evento TEXT NOT NULL,
      status_anterior TEXT,
      status_novo TEXT,
      descricao TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
      FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE CASCADE
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      academia_id INTEGER,
      modulo TEXT,
      acao TEXT,
      descricao TEXT,
      ip TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
      FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE CASCADE
    )`);

    console.log('Tabelas inicializadas com sucesso.');
    await seedDatabase();
  } catch (err) {
    console.error('Erro ao inicializar tabelas:', err.message);
  }
}

async function seedDatabase() {
  const countAcad = await dbGet('SELECT COUNT(*) as count FROM academias');
  if (countAcad.count === 0) {
    console.log('Semeando banco de dados com dados iniciais de teste...');
    // Seed Academia
    await dbRun(`INSERT INTO academias (nome, slug, logo_url, whatsapp, endereco, dias_notificacao_vencimento, template_mensagem, tipo_chave_pix, chave_pix, beneficiario_pix, cidade_pix)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Bem-Estar Fitness',
        'bemestar',
        '../Assets/logoAcademia.png',
        '(11) 98765-4321',
        'Av. Paulista, 1000 - São Paulo, SP',
        3,
        'Olá, {nome}. Seu plano {plano} vence em {vencimento}.',
        'cnpj',
        '12.345.678/0001-99',
        'Academia Bem-Estar Fitness Ltda',
        'Sao Paulo'
      ]
    );

    // Seed Usuarios (Calif, admin, secretaria, alana.santos)
    const hash1 = bcrypt.hashSync('123456', 10);
    await dbRun(`INSERT INTO usuarios (nome, login, senha_hash, perfil, ativo, academia_id, uuid, email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Calif', 'calif', hash1, 'Administrador', 1, 1, 'admin-uuid-calif-12345', 'leo080396@gmail.com']
    );

    await dbRun(`INSERT INTO usuarios (nome, login, senha_hash, perfil, ativo, academia_id, uuid, email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Administrador', 'admin', hash1, 'Administrador', 1, 1, 'admin-uuid-admin-54321', 'admin@bemestar.com']
    );

    await dbRun(`INSERT INTO usuarios (nome, login, senha_hash, perfil, ativo, academia_id, uuid, email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Alana Santos', 'alana.santos', hash1, 'Secretaria', 1, 1, 'secretaria-uuid-98765', 'alana@bemestar.com']
    );

    await dbRun(`INSERT INTO usuarios (nome, login, senha_hash, perfil, ativo, academia_id, uuid, email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Secretaria', 'secretaria', hash1, 'Secretaria', 1, 1, 'secretaria-uuid-11111', 'secretaria@bemestar.com']
    );

    // Seed Planos
    await dbRun(`INSERT INTO planos (id, nome, valor, quantidade_dias, status, descricao, academia_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [1, 'Mensal', 90.00, 30, 'ativo', 'Acesso livre à musculação e área cardio.', 1]
    );
    await dbRun(`INSERT INTO planos (id, nome, valor, quantidade_dias, status, descricao, academia_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [2, 'Quinzenal', 60.00, 15, 'ativo', 'Plano rápido de 15 dias.', 1]
    );
    await dbRun(`INSERT INTO planos (id, nome, valor, quantidade_dias, status, descricao, academia_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [3, 'Trimestral', 270.00, 90, 'ativo', 'Musculação livre por 3 meses.', 1]
    );

    // Seed Alunos
    const formatISO = (date) => date.toISOString().split('T')[0];
    const hoje = new Date();
    
    let venc1 = new Date(); venc1.setDate(hoje.getDate() + 2);
    let mat1 = new Date(); mat1.setDate(hoje.getDate() - 128);
    await dbRun(`INSERT INTO alunos (nome, cpf, data_nasc, sexo, telefone, email, status, plano_id, data_matricula, vencimento, observacoes, academia_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Ana Beatriz Souza', '123.456.789-00', '1995-04-12', 'F', '(11) 98765-4321', 'ana.souza@email.com', 'ativo', 1, formatISO(mat1), formatISO(venc1), 'Aluna pontual nos pagamentos. Prefere aulas no período da manhã.', 1]
    );

    let venc2 = new Date(); venc2.setDate(hoje.getDate() - 11);
    let mat2 = new Date(); mat2.setDate(hoje.getDate() - 100);
    await dbRun(`INSERT INTO alunos (nome, cpf, data_nasc, sexo, telefone, email, status, plano_id, data_matricula, vencimento, observacoes, academia_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Carlos Eduardo Silva', '234.567.890-11', '1988-08-23', 'M', '(11) 97654-3210', 'carlos.edu@email.com', 'aguardando', 3, formatISO(mat2), formatISO(venc2), 'Problemas com horário de trabalho.', 1]
    );

    let venc3 = new Date(); venc3.setDate(hoje.getDate() - 24);
    let mat3 = new Date(); mat3.setDate(hoje.getDate() - 150);
    await dbRun(`INSERT INTO alunos (nome, cpf, data_nasc, sexo, telefone, email, status, plano_id, data_matricula, vencimento, observacoes, academia_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Fernanda Lima Santos', '345.678.901-22', '1992-12-05', 'F', '(11) 96543-2109', 'fernanda.lima@email.com', 'ausente', 1, formatISO(mat3), formatISO(venc3), null, 1]
    );

    let mat4 = new Date(); mat4.setDate(hoje.getDate() - 60);
    await dbRun(`INSERT INTO alunos (nome, cpf, data_nasc, sexo, telefone, email, status, plano_id, data_matricula, vencimento, observacoes, academia_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Rodrigo Matos Oliveira', '456.789.012-33', '1990-01-30', 'M', '(11) 95432-1098', 'rodrigo.matos@email.com', 'pausa', 3, formatISO(mat4), null, '[Dias Pausados: 15] Solicitou pausa de 15 dias por viagem.', 1]
    );

    let venc5 = new Date(); venc5.setDate(hoje.getDate() + 4);
    let mat5 = new Date(); mat5.setDate(hoje.getDate() - 30);
    await dbRun(`INSERT INTO alunos (nome, cpf, data_nasc, sexo, telefone, email, status, plano_id, data_matricula, vencimento, observacoes, academia_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Juliana Costa Pereira', '567.890.123-44', '1997-10-15', 'F', '(11) 94321-0987', 'juliana.costa@email.com', 'ativo', 1, formatISO(mat5), formatISO(venc5), null, 1]
    );

    let venc6 = new Date(); venc6.setDate(hoje.getDate() - 8);
    let mat6 = new Date(); mat6.setDate(hoje.getDate() - 40);
    await dbRun(`INSERT INTO alunos (nome, cpf, data_nasc, sexo, telefone, email, status, plano_id, data_matricula, vencimento, observacoes, academia_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Mariana Rodrigues', '678.901.234-55', '1993-02-18', 'F', '(11) 92109-8765', 'mari.rod@email.com', 'aguardando', 1, formatISO(mat6), formatISO(venc6), null, 1]
    );

    let mat7 = new Date(); mat7.setDate(hoje.getDate() - 180);
    await dbRun(`INSERT INTO alunos (nome, cpf, data_nasc, sexo, telefone, email, status, plano_id, data_matricula, vencimento, observacoes, academia_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Lucas Fernandes', '789.012.345-66', '2000-06-25', 'M', '(11) 91098-7654', 'lucas.fer@email.com', 'inativo', 1, formatISO(mat7), null, null, 1]
    );

    // Seed Pagamentos
    let pag1 = new Date(); pag1.setDate(hoje.getDate() - 28);
    await dbRun(`INSERT INTO pagamentos (aluno_id, plano_id, registrado_por, academia_id, valor, forma_pagamento, data_pagamento, novo_vencimento, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, 1, 1, 1, 90.00, 'pix', formatISO(pag1) + 'T14:32:00.000Z', formatISO(venc1), 'confirmado']
    );

    let pag1_2 = new Date(); pag1_2.setDate(hoje.getDate() - 58);
    let venc1_2 = new Date(); venc1_2.setDate(hoje.getDate() - 28);
    await dbRun(`INSERT INTO pagamentos (aluno_id, plano_id, registrado_por, academia_id, valor, forma_pagamento, data_pagamento, novo_vencimento, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, 1, 1, 1, 90.00, 'dinheiro', formatISO(pag1_2) + 'T09:15:00.000Z', formatISO(venc1_2), 'confirmado']
    );

    let pag1_3 = new Date(); pag1_3.setDate(hoje.getDate() - 88);
    let venc1_3 = new Date(); venc1_3.setDate(hoje.getDate() - 58);
    await dbRun(`INSERT INTO pagamentos (aluno_id, plano_id, registrado_por, academia_id, valor, forma_pagamento, data_pagamento, novo_vencimento, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, 1, 1, 1, 90.00, 'pix', formatISO(pag1_3) + 'T18:10:00.000Z', formatISO(venc1_3), 'confirmado']
    );

    let pag2 = new Date(); pag2.setDate(hoje.getDate() - 100);
    await dbRun(`INSERT INTO pagamentos (aluno_id, plano_id, registrado_por, academia_id, valor, forma_pagamento, data_pagamento, novo_vencimento, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [2, 3, 1, 1, 270.00, 'debito', formatISO(pag2) + 'T10:20:00.000Z', formatISO(venc2), 'confirmado']
    );

    let pag3 = new Date(); pag3.setDate(hoje.getDate() - 54);
    await dbRun(`INSERT INTO pagamentos (aluno_id, plano_id, registrado_por, academia_id, valor, forma_pagamento, data_pagamento, novo_vencimento, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [3, 1, 1, 1, 90.00, 'credito', formatISO(pag3) + 'T19:40:00.000Z', formatISO(venc3), 'confirmado']
    );

    // Seed Historico Aluno
    await dbRun(`INSERT INTO historico_aluno (aluno_id, usuario_id, academia_id, tipo_evento, status_anterior, status_novo, descricao)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [1, 1, 1, 'pagamento', 'aguardando', 'ativo', 'Mensalidade registrada: R$ 90,00 via Pix.']
    );
    await dbRun(`INSERT INTO historico_aluno (aluno_id, usuario_id, academia_id, tipo_evento, status_anterior, status_novo, descricao)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [4, 1, 1, 'pausar', 'ativo', 'pausa', 'Matrícula pausada. 15 dias de crédito preservados.']
    );

    // Seed Logs
    await dbRun(`INSERT INTO logs (usuario_id, academia_id, modulo, acao, descricao, ip)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [1, 1, 'auth', 'login', 'Efetuou login administrativo no sistema (SQLite Local)', '127.0.0.1']
    );
    await dbRun(`INSERT INTO logs (usuario_id, academia_id, modulo, acao, descricao, ip)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [1, 1, 'alunos', 'cadastrar', 'Cadastrou o aluno "Ana Beatriz Souza"', '127.0.0.1']
    );

    console.log('Semeador concluído com sucesso.');
  }
}

async function atualizarStatusAutomatico(academiaId, usuarioId) {
  try {
    const alunos = await dbAll('SELECT * FROM alunos WHERE academia_id = ? AND status != "pausa"', [academiaId]);
    if (!alunos || alunos.length === 0) return;

    const hojeStr = new Date().toISOString().split('T')[0];
    const hoje = new Date(hojeStr + "T12:00:00");

    for (const aluno of alunos) {
      let statusCalculado = aluno.status;

      if (aluno.vencimento) {
        const vencDate = new Date(aluno.vencimento + "T12:00:00");
        const diffTime = hoje - vencDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          statusCalculado = 'ativo';
        } else if (diffDays <= 7) {
          statusCalculado = 'aguardando';
        } else if (diffDays <= 60) {
          statusCalculado = 'ausente';
        } else {
          statusCalculado = 'inativo';
        }
      } else {
        if (aluno.data_matricula) {
          const matDate = new Date(aluno.data_matricula + "T12:00:00");
          const diffTime = hoje - matDate;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays > 60) {
            statusCalculado = 'inativo';
          } else if (diffDays > 7) {
            statusCalculado = 'ausente';
          } else {
            if (aluno.status !== 'ativo' && aluno.status !== 'aguardando') {
              statusCalculado = 'ativo';
            }
          }
        } else {
          if (aluno.status !== 'ativo' && aluno.status !== 'aguardando' && aluno.status !== 'inativo' && aluno.status !== 'ausente') {
            statusCalculado = 'ativo';
          }
        }
      }

      if (aluno.status !== statusCalculado) {
        await dbRun('UPDATE alunos SET status = ? WHERE id = ?', [statusCalculado, aluno.id]);

        let desc = "";
        if (statusCalculado === "inativo") {
          desc = "Matrícula inativada automaticamente por mais de 60 dias sem plano ativo.";
        } else if (statusCalculado === "ausente") {
          desc = "Alterado automaticamente para Ausente por atraso superior a 7 dias.";
        } else if (statusCalculado === "aguardando") {
          desc = "Alterado automaticamente para Aguardando Pagamento por vencimento do plano.";
        } else if (statusCalculado === "ativo") {
          desc = "Alterado automaticamente para Ativo.";
        }

        await dbRun(`INSERT INTO historico_aluno (aluno_id, usuario_id, academia_id, tipo_evento, status_anterior, status_novo, descricao)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [aluno.id, usuarioId || null, academiaId, 'sistema_status', aluno.status, statusCalculado, desc]
        );
      }
    }
  } catch (e) {
    console.error("Erro no status update:", e);
  }
}

// Verification middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Token ausente.' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido ou expirado.' });
    req.user = user;
    next();
  });
}

// 0. VERIFICAÇÃO DE ACADEMIA
app.get('/academias/verificar', async (req, res) => {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: 'Slug é obrigatório.' });
  try {
    const acad = await dbGet('SELECT * FROM academias WHERE LOWER(slug) = ?', [slug.toLowerCase()]);
    if (!acad) return res.status(404).json({ error: 'Academia não encontrada ou código inválido.' });
    res.json(acad);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1. LOGIN
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  console.log(`[API Log] Tentativa de login recebida para o usuário: "${username}"`);
  
  if (!username || !password) return res.status(400).json({ error: 'Preencha todos os campos.' });
  try {
    const user = await dbGet('SELECT * FROM usuarios WHERE LOWER(login) = ? OR LOWER(email) = ?', [username.toLowerCase().trim(), username.toLowerCase().trim()]);
    if (!user) {
      console.log(`[API Log] Usuário "${username}" não encontrado na base de dados.`);
      return res.status(400).json({ error: 'Usuário ou senha incorretos.' });
    }
    
    const isPasswordCorrect = bcrypt.compareSync(password, user.senha_hash);
    if (!isPasswordCorrect) {
      console.log(`[API Log] Senha incorreta para o usuário "${username}".`);
      return res.status(400).json({ error: 'Usuário ou senha incorretos.' });
    }

    if (!user.ativo) {
      console.log(`[API Log] Usuário "${username}" está inativo (aguardando aprovação).`);
      return res.status(403).json({ error: 'Sua conta está aguardando aprovação do administrador.' });
    }

    const token = jwt.sign({
      id: user.id,
      nome: user.nome,
      login: user.login,
      email: user.email,
      perfil: user.perfil,
      academia_id: user.academia_id
    }, JWT_SECRET, { expiresIn: '24h' });

    await dbRun(`INSERT INTO logs (usuario_id, academia_id, modulo, acao, descricao, ip)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [user.id, user.academia_id, 'auth', 'login', 'Efetuou login administrativo no sistema (SQLite Local)', req.ip || '127.0.0.1']
    );

    console.log(`[API Log] Login bem-sucedido para o usuário: "${username}" (${user.perfil})`);

    res.json({
      access_token: token,
      token_type: "bearer",
      user: {
        id: user.id,
        nome: user.nome,
        login: user.login,
        email: user.email,
        nivel: user.perfil || 'Administrador',
        perfil: user.perfil || 'Administrador',
        academia_id: user.academia_id,
        avatar: user.nome[0].toUpperCase()
      }
    });
  } catch (err) {
    console.error("[API Log Error]", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. REGISTER
app.post('/auth/register', async (req, res) => {
  const { name, username, email, password } = req.body;
  try {
    const academiaId = req.headers['x-academia-id'] ? parseInt(req.headers['x-academia-id']) : 1;

    const existingLogin = await dbGet('SELECT id FROM usuarios WHERE LOWER(login) = ?', [username.toLowerCase().trim()]);
    if (existingLogin) return res.status(400).json({ error: 'Este nome de usuário já está em uso.' });

    const emailCadastro = email.includes("@") ? email : `${username.toLowerCase()}@bemestar.com`;
    const existingEmail = await dbGet('SELECT id FROM usuarios WHERE LOWER(email) = ?', [emailCadastro.toLowerCase().trim()]);
    if (existingEmail) return res.status(400).json({ error: 'Este e-mail já está em uso.' });

    const hash = bcrypt.hashSync(password, 10);
    const uuid = 'user-uuid-' + Math.random().toString(36).substring(2) + Date.now().toString(36);

    await dbRun(`INSERT INTO usuarios (nome, login, email, senha_hash, perfil, ativo, academia_id, uuid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, username.toLowerCase().trim(), emailCadastro, hash, 'Secretaria', 0, academiaId, uuid]
    );

    res.json({
      status: "success",
      message: "Cadastro administrativo realizado com sucesso!",
      user: { nome: name, login: username }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. EDIT PROFILE
app.put('/auth/perfil', authenticateToken, async (req, res) => {
  const { nome, email } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório.' });
  try {
    await dbRun('UPDATE usuarios SET nome = ? WHERE id = ?', [nome, req.user.id]);
    const user = await dbGet('SELECT * FROM usuarios WHERE id = ?', [req.user.id]);
    
    await dbRun(`INSERT INTO logs (usuario_id, academia_id, modulo, acao, descricao, ip)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [user.id, user.academia_id, 'auth', 'editar_perfil', `Alterou dados pessoais. Novo Nome: ${nome}`, req.ip || '127.0.0.1']
    );

    res.json({
      id: user.id,
      nome: user.nome,
      login: user.login,
      email: email || user.email,
      nivel: user.perfil,
      avatar: user.nome[0].toUpperCase()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. ALTERAR SENHA
app.put('/auth/senha', authenticateToken, async (req, res) => {
  const { senha_atual, senha_nova } = req.body;
  try {
    const user = await dbGet('SELECT * FROM usuarios WHERE id = ?', [req.user.id]);
    if (!bcrypt.compareSync(senha_atual, user.senha_hash)) {
      return res.status(400).json({ error: 'Senha atual incorreta.' });
    }

    const hash = bcrypt.hashSync(senha_nova, 10);
    await dbRun('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [hash, req.user.id]);

    await dbRun(`INSERT INTO logs (usuario_id, academia_id, modulo, acao, descricao, ip)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [user.id, user.academia_id, 'auth', 'alterar_senha', 'Realizou alteração da senha de acesso administrativa', req.ip || '127.0.0.1']
    );

    res.json({ status: "success", message: "Senha atualizada com sucesso." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. LISTAR PLANOS
app.get('/planos', authenticateToken, async (req, res) => {
  try {
    let sql = 'SELECT * FROM planos';
    let params = [];
    if (req.user.perfil !== 'Administrador') {
      sql += ' WHERE academia_id = ?';
      params.push(req.user.academia_id);
    }
    const plans = await dbAll(sql + ' ORDER BY id ASC', params);
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. CRIAR PLANO
app.post('/planos', authenticateToken, async (req, res) => {
  const { nome, valor, quantidade_dias, status, descricao } = req.body;
  const academiaId = req.user.academia_id;
  try {
    const existing = await dbGet('SELECT id FROM planos WHERE LOWER(nome) = ? AND academia_id = ?', [nome.toLowerCase(), academiaId]);
    if (existing) return res.status(400).json({ error: "Já existe um plano cadastrado com este nome." });

    const resInsert = await dbRun(`INSERT INTO planos (nome, valor, quantidade_dias, status, descricao, academia_id)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [nome, valor, quantidade_dias, status || 'ativo', descricao || null, academiaId]
    );

    await dbRun(`INSERT INTO logs (usuario_id, academia_id, modulo, acao, descricao, ip)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, academiaId, 'planos', 'criar', `Criou o plano ${nome} com valor R$ ${valor}`, req.ip || '127.0.0.1']
    );

    const newPlan = await dbGet('SELECT * FROM planos WHERE id = ?', [resInsert.lastID]);
    res.json(newPlan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. EDITAR PLANO
app.put('/planos/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { nome, valor, quantidade_dias, status, descricao } = req.body;
  const academiaId = req.user.academia_id;
  try {
    const existing = await dbGet('SELECT id FROM planos WHERE LOWER(nome) = ? AND academia_id = ? AND id != ?', [nome.toLowerCase(), academiaId, id]);
    if (existing) return res.status(400).json({ error: "Já existe outro plano com este nome." });

    await dbRun(`UPDATE planos SET nome = ?, valor = ?, quantidade_dias = ?, status = ?, descricao = ?
      WHERE id = ? AND (academia_id = ? OR ? = 'Administrador')`,
      [nome, valor, quantidade_dias, status, descricao || null, id, academiaId, req.user.perfil]
    );

    await dbRun(`INSERT INTO logs (usuario_id, academia_id, modulo, acao, descricao, ip)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, academiaId, 'planos', 'editar', `Editou dados do plano ${nome}`, req.ip || '127.0.0.1']
    );

    const updated = await dbGet('SELECT * FROM planos WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. LISTAR ALUNOS
app.get('/alunos', authenticateToken, async (req, res) => {
  const academiaId = req.user.academia_id;
  const statusFilter = req.query.status;
  const nomeFilter = req.query.nome;
  const cpfFilter = req.query.cpf;
  try {
    await atualizarStatusAutomatico(academiaId, req.user.id);

    let sql = `
      SELECT a.*, p.nome AS plano_nome,
             (SELECT COALESCE(SUM(pa.valor), 0) FROM pagamentos pa WHERE pa.aluno_id = a.id AND pa.status = 'confirmado') AS total_pago
      FROM alunos a
      LEFT JOIN planos p ON a.plano_id = p.id
      WHERE (a.academia_id = ? OR ? = 'Administrador')
    `;
    let params = [academiaId, req.user.perfil];

    if (statusFilter) {
      sql += ' AND a.status = ?';
      params.push(statusFilter);
    }
    if (nomeFilter) {
      sql += ' AND LOWER(a.nome) LIKE ?';
      params.push('%' + nomeFilter.toLowerCase() + '%');
    }
    if (cpfFilter) {
      sql += ' AND a.cpf = ?';
      params.push(cpfFilter);
    }

    const rows = await dbAll(sql + ' ORDER BY a.nome ASC', params);
    
    const mapped = rows.map(aluno => {
      let diasPausados = 0;
      if (aluno.observacoes && aluno.observacoes.includes("[Dias Pausados: ")) {
        try {
          const parte = aluno.observacoes.split("[Dias Pausados: ")[1].split("]")[0];
          diasPausados = parseInt(parte);
        } catch (e) {}
      }
      return {
        ...aluno,
        dias_pausados: diasPausados
      };
    });

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. CADASTRAR ALUNO
app.post('/alunos', authenticateToken, async (req, res) => {
  const body = req.body;
  const academiaId = req.user.academia_id;
  try {
    if (body.cpf) {
      const existing = await dbGet('SELECT id FROM alunos WHERE cpf = ? AND academia_id = ?', [body.cpf, academiaId]);
      if (existing) return res.status(400).json({ error: "Já existe um aluno cadastrado com este CPF." });
    }

    const resInsert = await dbRun(`INSERT INTO alunos (
        nome, cpf, data_nasc, sexo, telefone, whatsapp, email, cep, rua, numero, bairro, cidade, estado, status, plano_id, data_matricula, vencimento, observacoes, academia_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.nome,
        body.cpf || null,
        body.data_nasc || null,
        body.sexo || null,
        body.telefone || null,
        body.whatsapp || body.telefone || null,
        body.email || null,
        body.cep || null,
        body.rua || null,
        body.numero || null,
        body.bairro || null,
        body.cidade || null,
        body.estado || null,
        body.status || 'ativo',
        body.plano_id || null,
        body.data_matricula || null,
        body.vencimento || null,
        body.observacoes || null,
        academiaId
      ]
    );

    const newId = resInsert.lastID;

    await dbRun(`INSERT INTO historico_aluno (aluno_id, usuario_id, academia_id, tipo_evento, status_anterior, status_novo, descricao)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId, req.user.id, academiaId, 'cadastro', null, body.status || 'ativo', 'Matrícula inicial criada no sistema.']
    );

    await dbRun(`INSERT INTO logs (usuario_id, academia_id, modulo, acao, descricao, ip)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, academiaId, 'alunos', 'cadastrar', `Cadastrou o aluno "${body.nome}" (CPF: ${body.cpf || '—'})`, req.ip || '127.0.0.1']
    );

    const created = await dbGet(`
      SELECT a.*, p.nome AS plano_nome, 0 AS total_pago, 0 AS dias_pausados
      FROM alunos a
      LEFT JOIN planos p ON a.plano_id = p.id
      WHERE a.id = ?
    `, [newId]);

    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. EDITAR STATUS DO ALUNO
app.patch('/alunos/:id/status', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { action } = req.query;
  const academiaId = req.user.academia_id;
  try {
    const aluno = await dbGet('SELECT * FROM alunos WHERE id = ? AND (academia_id = ? OR ? = "Administrador")', [id, academiaId, req.user.perfil]);
    if (!aluno) return res.status(404).json({ error: "Aluno não encontrado." });

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
      return res.status(400).json({ error: "Ação inválida." });
    }

    await dbRun(`UPDATE alunos SET status = ?, vencimento = ?, observacoes = ? WHERE id = ?`,
      [statusNovo, vencimentoNovo, observacoesNovas, id]
    );

    await dbRun(`INSERT INTO historico_aluno (aluno_id, usuario_id, academia_id, tipo_evento, status_anterior, status_novo, descricao)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, academiaId, action, statusAnterior, statusNovo, descricaoHist]
    );

    await dbRun(`INSERT INTO logs (usuario_id, academia_id, modulo, acao, descricao, ip)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, academiaId, 'alunos', logAcao, logDesc, req.ip || '127.0.0.1']
    );

    const updated = await dbGet(`
      SELECT a.*, p.nome AS plano_nome,
             (SELECT COALESCE(SUM(pa.valor), 0) FROM pagamentos pa WHERE pa.aluno_id = a.id AND pa.status = 'confirmado') AS total_pago
      FROM alunos a
      LEFT JOIN planos p ON a.plano_id = p.id
      WHERE a.id = ?
    `, [id]);

    let diasPausados = 0;
    if (updated.observacoes && updated.observacoes.includes("[Dias Pausados: ")) {
      try {
        const parte = updated.observacoes.split("[Dias Pausados: ")[1].split("]")[0];
        diasPausados = parseInt(parte);
      } catch (e) {}
    }

    res.json({
      ...updated,
      dias_pausados: diasPausados
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. EDITAR ALUNO
app.put('/alunos/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  const academiaId = req.user.academia_id;
  try {
    if (body.cpf) {
      const existing = await dbGet('SELECT id FROM alunos WHERE cpf = ? AND academia_id = ? AND id != ?', [body.cpf, academiaId, id]);
      if (existing) return res.status(400).json({ error: "Já existe outro aluno cadastrado com este CPF." });
    }

    await dbRun(`UPDATE alunos SET
      nome = ?, cpf = ?, data_nasc = ?, sexo = ?, telefone = ?, whatsapp = ?, email = ?, cep = ?, rua = ?, numero = ?, bairro = ?, cidade = ?, estado = ?, plano_id = ?, data_matricula = ?, observacoes = ?
      WHERE id = ? AND (academia_id = ? OR ? = 'Administrador')`,
      [
        body.nome,
        body.cpf || null,
        body.data_nasc || null,
        body.sexo || null,
        body.telefone || null,
        body.whatsapp || null,
        body.email || null,
        body.cep || null,
        body.rua || null,
        body.numero || null,
        body.bairro || null,
        body.cidade || null,
        body.estado || null,
        body.plano_id || null,
        body.data_matricula || null,
        body.observacoes || null,
        id,
        academiaId,
        req.user.perfil
      ]
    );

    await dbRun(`INSERT INTO historico_aluno (aluno_id, usuario_id, academia_id, tipo_evento, status_anterior, status_novo, descricao)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, academiaId, 'edicao', body.status, body.status, 'Atualizou informações cadastrais.']
    );

    await dbRun(`INSERT INTO logs (usuario_id, academia_id, modulo, acao, descricao, ip)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, academiaId, 'alunos', 'editar', `Editou os dados cadastrais do aluno "${body.nome}"`, req.ip || '127.0.0.1']
    );

    const updated = await dbGet(`
      SELECT a.*, p.nome AS plano_nome,
             (SELECT COALESCE(SUM(pa.valor), 0) FROM pagamentos pa WHERE pa.aluno_id = a.id AND pa.status = 'confirmado') AS total_pago
      FROM alunos a
      LEFT JOIN planos p ON a.plano_id = p.id
      WHERE a.id = ?
    `, [id]);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. LISTAR PAGAMENTOS
app.get('/pagamentos', authenticateToken, async (req, res) => {
  const academiaId = req.user.academia_id;
  try {
    const rows = await dbAll(`
      SELECT pa.*,
             al.nome AS aluno_nome,
             al.whatsapp AS aluno_whatsapp,
             al.telefone AS aluno_telefone,
             pl.nome AS plano_nome,
             us.nome AS operador_nome
      FROM pagamentos pa
      LEFT JOIN alunos al ON pa.aluno_id = al.id
      LEFT JOIN planos pl ON pa.plano_id = pl.id
      LEFT JOIN usuarios us ON pa.registrado_por = us.id
      WHERE (pa.academia_id = ? OR ? = 'Administrador')
      ORDER BY pa.criado_em DESC
    `, [academiaId, req.user.perfil]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. REGISTRAR PAGAMENTO
app.post('/pagamentos', authenticateToken, async (req, res) => {
  const { aluno_id, plano_id, valor, forma_pagamento, data_pagamento, novo_vencimento, observacoes } = req.body;
  const academiaId = req.user.academia_id;
  try {
    const aluno = await dbGet('SELECT status, nome FROM alunos WHERE id = ? AND academia_id = ?', [aluno_id, academiaId]);
    const plano = await dbGet('SELECT nome FROM planos WHERE id = ? AND academia_id = ?', [plano_id, academiaId]);

    if (!aluno) return res.status(404).json({ error: "Aluno não encontrado." });
    if (!plano) return res.status(404).json({ error: "Plano não encontrado." });

    const statusAnterior = aluno.status;

    await dbRun('UPDATE alunos SET status = ?, vencimento = ?, plano_id = ? WHERE id = ?', ['ativo', novo_vencimento, plano_id, aluno_id]);

    const resInsert = await dbRun(`INSERT INTO pagamentos (
        aluno_id, plano_id, registrado_por, academia_id, valor, forma_pagamento, data_pagamento, novo_vencimento, observacoes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [aluno_id, plano_id, req.user.id, academiaId, valor, forma_pagamento, data_pagamento, novo_vencimento, observacoes || null, 'confirmado']
    );

    const formatVal = Number(valor).toFixed(2).replace('.', ',');

    await dbRun(`INSERT INTO historico_aluno (aluno_id, usuario_id, academia_id, tipo_evento, status_anterior, status_novo, descricao)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [aluno_id, req.user.id, academiaId, 'pagamento', statusAnterior, 'ativo', `Mensalidade registrada: R$ ${formatVal} via ${forma_pagamento.toUpperCase()}.`]
    );

    await dbRun(`INSERT INTO logs (usuario_id, academia_id, modulo, acao, descricao, ip)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, academiaId, 'alunos', 'pagamento', `Registrou pagamento do plano ${plano.nome} (R$ ${formatVal}) para o aluno "${aluno.nome}"`, req.ip || '127.0.0.1']
    );

    const created = await dbGet('SELECT * FROM pagamentos WHERE id = ?', [resInsert.lastID]);
    res.json({
      ...created,
      aluno_nome: aluno.nome,
      plano_nome: plano.nome,
      operador_nome: req.user.nome
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 14. CONFIGURAÇÕES DA ACADEMIA
app.get('/configuracoes', authenticateToken, async (req, res) => {
  const academiaId = req.user.academia_id;
  try {
    const acad = await dbGet('SELECT * FROM academias WHERE id = ?', [academiaId]);
    if (!acad) return res.status(404).json({ error: "Academia não encontrada." });
    
    res.json({
      nomeAcademia: acad.nome,
      whatsapp: acad.whatsapp,
      logo: acad.logo_url,
      endereco: acad.endereco,
      diasNotificacaoVencimento: acad.dias_notificacao_vencimento,
      templateMensagem: acad.template_mensagem,
      tipoChavePix: acad.tipo_chave_pix,
      chavePix: acad.chave_pix,
      beneficiarioPix: acad.beneficiario_pix,
      cidadePix: acad.cidade_pix
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/configuracoes', authenticateToken, async (req, res) => {
  const academiaId = req.user.academia_id;
  const body = req.body;
  try {
    await dbRun(`UPDATE academias SET
        nome = ?, whatsapp = ?, logo_url = ?, endereco = ?, dias_notificacao_vencimento = ?, template_mensagem = ?, tipo_chave_pix = ?, chave_pix = ?, beneficiario_pix = ?, cidade_pix = ?
      WHERE id = ?`,
      [
        body.nomeAcademia,
        body.whatsapp,
        body.logo,
        body.endereco,
        parseInt(body.diasNotificacaoVencimento) || 3,
        body.templateMensagem,
        body.tipoChavePix,
        body.chavePix,
        body.beneficiarioPix,
        body.cidadePix,
        academiaId
      ]
    );

    await dbRun(`INSERT INTO logs (usuario_id, academia_id, modulo, acao, descricao, ip)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, academiaId, 'configuracoes', 'editar', 'Atualizou as configurações gerais do sistema', req.ip || '127.0.0.1']
    );

    res.json({ status: "success", message: "Configurações atualizadas." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 15. IMPORTAR BACKUP
app.post('/configuracoes/importar', authenticateToken, async (req, res) => {
  const academiaId = req.user.academia_id;
  const backupData = req.body;
  try {
    await dbRun('DELETE FROM pagamentos WHERE academia_id = ?', [academiaId]);
    await dbRun('DELETE FROM historico_aluno WHERE academia_id = ?', [academiaId]);
    await dbRun('DELETE FROM alunos WHERE academia_id = ?', [academiaId]);
    await dbRun('DELETE FROM planos WHERE academia_id = ?', [academiaId]);
    await dbRun('DELETE FROM logs WHERE academia_id = ?', [academiaId]);

    const planosDict = {};
    for (const p of backupData.planos || []) {
      const resP = await dbRun(`INSERT INTO planos (nome, valor, quantidade_dias, status, descricao, academia_id) VALUES (?, ?, ?, ?, ?, ?)`,
        [p.nome, p.valor, p.quantidade_dias || p.duracao_dias || 30, p.status || 'ativo', p.descricao, academiaId]
      );
      planosDict[p.nome.toLowerCase()] = resP.lastID;
    }

    for (const a of backupData.alunos || []) {
      let planoId = a.plano_id;
      if (!planoId && a.plano_nome) {
        planoId = planosDict[a.plano_nome.toLowerCase()];
      }

      await dbRun(`INSERT INTO alunos (
          nome, cpf, data_nasc, sexo, telefone, whatsapp, email, cep, rua, numero, bairro, cidade, estado, status, plano_id, data_matricula, vencimento, observacoes, academia_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          a.nome, a.cpf, a.data_nasc ? a.data_nasc.split("T")[0] : null, a.sexo, a.telefone, a.whatsapp || a.telefone,
          a.email, a.cep, a.rua, a.numero, a.bairro, a.cidade, a.estado, a.status || 'ativo', planoId || null,
          a.data_matricula ? a.data_matricula.split("T")[0] : new Date().toISOString().split("T")[0],
          a.vencimento ? a.vencimento.split("T")[0] : null, a.observacoes, academiaId
        ]
      );
    }

    for (const p of backupData.pagamentos || []) {
      let planoId = p.plano_id;
      if (!planoId && p.plano_nome) {
        planoId = planosDict[p.plano_nome.toLowerCase()];
      }

      await dbRun(`INSERT INTO pagamentos (aluno_id, plano_id, registrado_por, academia_id, valor, forma_pagamento, data_pagamento, novo_vencimento, status, observacoes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.aluno_id, planoId || null, req.user.id || 1, academiaId, p.valor, p.forma_pagamento || p.forma || 'pix',
          p.data_pagamento ? p.data_pagamento.split("T")[0] : new Date().toISOString().split("T")[0],
          p.novo_vencimento ? p.novo_vencimento.split("T")[0] : new Date().toISOString().split("T")[0],
          p.status || 'confirmado', p.observacoes
        ]
      );
    }

    for (const l of backupData.logs || []) {
      await dbRun(`INSERT INTO logs (usuario_id, modulo, acao, descricao, ip, criado_em, academia_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id || 1, l.modulo || 'sistema', l.acao || 'importar', l.descricao || l.detalhe, l.ip || '127.0.0.1',
          l.criado_em || l.data || new Date().toISOString(), academiaId
        ]
      );
    }

    res.json({ status: "success", message: "Backup importado com sucesso no SQLite." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 16. OPERADORES E SESSÕES
app.get('/usuarios', authenticateToken, async (req, res) => {
  const userRole = req.user.perfil;
  const includeInactive = req.query.incluir_inativos === 'true';
  const academiaId = req.user.academia_id;
  try {
    let sql = `
      SELECT u.id, u.nome, u.perfil, u.login, u.ativo, u.email, u.academia_id, u.uuid,
             a.nome AS academia_nome
      FROM usuarios u
      LEFT JOIN academias a ON u.academia_id = a.id
      WHERE 1=1
    `;
    let params = [];

    if (userRole !== 'Administrador') {
      sql += ' AND u.academia_id = ?';
      params.push(academiaId);
    }

    if (userRole !== 'Administrador' || !includeInactive) {
      sql += ' AND u.ativo = 1';
    }

    const rows = await dbAll(sql, params);

    let filtered = rows;
    if (userRole === 'Secretaria') {
      filtered = rows.filter(u => u.id === req.user.id);
    } else if (userRole === 'Gerente Geral') {
      filtered = rows.filter(u => u.perfil !== 'Administrador');
    }

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/usuarios/aprovar', authenticateToken, async (req, res) => {
  if (req.user.perfil !== 'Administrador') return res.status(403).json({ error: 'Não autorizado.' });
  const { id, perfil } = req.body;
  try {
    await dbRun('UPDATE usuarios SET ativo = 1, perfil = ? WHERE id = ?', [perfil, id]);
    const user = await dbGet('SELECT * FROM usuarios WHERE id = ?', [id]);

    await dbRun(`INSERT INTO logs (usuario_id, academia_id, modulo, acao, descricao, ip)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, req.user.academia_id, 'seguranca', 'aprovar_usuario', `Aprovou o acesso do operador "${user.nome}" (${user.login}) como ${perfil}`, req.ip || '127.0.0.1']
    );

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/usuarios/rejeitar', authenticateToken, async (req, res) => {
  if (req.user.perfil !== 'Administrador') return res.status(403).json({ error: 'Não autorizado.' });
  const { id } = req.body;
  try {
    const user = await dbGet('SELECT nome, login FROM usuarios WHERE id = ?', [id]);
    if (user) {
      await dbRun('DELETE FROM usuarios WHERE id = ?', [id]);
      
      await dbRun(`INSERT INTO logs (usuario_id, academia_id, modulo, acao, descricao, ip)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.id, req.user.academia_id, 'seguranca', 'rejeitar_usuario', `Rejeitou a solicitação de acesso do operador "${user.nome}" (${user.login})`, req.ip || '127.0.0.1']
      );
    }
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/academias', authenticateToken, async (req, res) => {
  if (req.user.perfil !== 'Administrador') return res.status(403).json({ error: 'Não autorizado.' });
  try {
    const rows = await dbAll('SELECT id, nome FROM academias ORDER BY nome ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/usuarios/atualizar', authenticateToken, async (req, res) => {
  if (req.user.perfil !== 'Administrador') return res.status(403).json({ error: 'Não autorizado.' });
  const { id, perfil, academia_id } = req.body;
  try {
    await dbRun('UPDATE usuarios SET perfil = ?, academia_id = ? WHERE id = ?', [perfil, academia_id, id]);
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/usuarios/alterar-senha', authenticateToken, async (req, res) => {
  if (req.user.perfil !== 'Administrador') return res.status(403).json({ error: 'Não autorizado.' });
  const { uuid, senha } = req.body;
  try {
    const hash = bcrypt.hashSync(senha, 10);
    await dbRun('UPDATE usuarios SET senha_hash = ? WHERE uuid = ?', [hash, uuid]);
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/usuarios/excluir', authenticateToken, async (req, res) => {
  if (req.user.perfil !== 'Administrador') return res.status(403).json({ error: 'Não autorizado.' });
  const { id } = req.body;
  try {
    await dbRun('DELETE FROM usuarios WHERE id = ?', [id]);
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 17. LOGS DE AUDITORIA
app.get('/logs', authenticateToken, async (req, res) => {
  const userRole = req.user.perfil;
  const academiaId = req.user.academia_id;
  const usuarioFiltro = req.query.usuario_id;
  try {
    let sql = `
      SELECT l.*, u.nome AS usuario_nome, u.perfil AS usuario_perfil
      FROM logs l
      LEFT JOIN usuarios u ON l.usuario_id = u.id
      WHERE 1=1
    `;
    let params = [];

    if (userRole !== 'Administrador') {
      sql += ' AND l.academia_id = ?';
      params.push(academiaId);
    }

    if (usuarioFiltro) {
      sql += ' AND l.usuario_id = ?';
      params.push(parseInt(usuarioFiltro));
    }

    const rows = await dbAll(sql + ' ORDER BY l.criado_em DESC', params);

    let filtered = rows;
    if (userRole === 'Secretaria') {
      filtered = rows.filter(l => l.usuario_id === req.user.id);
    } else if (userRole === 'Gerente Geral') {
      filtered = rows.filter(l => l.usuario_perfil !== 'Administrador');
    }

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando localmente em http://127.0.0.1:${PORT}`);
});
