-- ====================================================================
-- SCRIPT DE SEGURANÇA SUPABASE (POLÍTICAS RLS & AUTO-SINCRONIZAÇÃO)
-- Como rodar: Copie e cole este script no painel "SQL Editor" do Supabase
-- ====================================================================

-- 1. ADICIONAR COLUNA PARA MAPEAMENTO DO SUPABASE AUTH
-- Isso nos permite vincular o id único do Supabase Auth (UUID)
-- com a nossa tabela de usuarios (que usa chaves numéricas inteiras).
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS uuid uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS email varchar(120);

-- 2. FUNÇÃO E TRIGGER PARA SINCRONIZAÇÃO AUTOMÁTICA DE NOVOS USUÁRIOS
-- Toda vez que um operador fizer o cadastro pelo site ("Cadastre-se"),
-- o Supabase Auth criará a conta internamente. Esta trigger interceptará
-- esse evento e inserirá automaticamente o registro na tabela "public.usuarios".
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.usuarios (nome, login, senha_hash, perfil, ativo, academia_id, uuid, email)
  VALUES (
    COALESCE(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'name', 'Operador'), -- Pega o nome do metadado
    COALESCE(new.raw_user_meta_data->>'login', SPLIT_PART(new.email, '@', 1)), -- Nome de usuário
    'supabase_managed', -- Identifica que a senha é gerenciada pelo Supabase Auth
    COALESCE(new.raw_user_meta_data->>'perfil', 'Secretaria'), -- Perfil padrão
    COALESCE((new.raw_user_meta_data->>'ativo')::boolean, false), -- Começa inativo (false) por padrão no cadastro
    (new.raw_user_meta_data->>'academia_id')::integer, -- Vincula a academia do cadastro
    new.id, -- Guarda o UUID de autenticação do Supabase
    new.email -- E-mail do usuário
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoga a execução pública/anon/authenticated desta função trigger por motivos de segurança
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Remove a trigger anterior se ela já existir para evitar duplicidade
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Vincula a trigger à tabela de usuários internos do Supabase Auth
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. FUNÇÕES AUXILIARES DE SEGURANÇA (EVITAM USO INSEGURO DE user_metadata)
-- Estas funções buscam o perfil e a academia diretamente na tabela public.usuarios
-- usando o uuid do usuário logado (auth.uid()). Como elas usam SECURITY DEFINER
-- e search_path explicitamente configurado, elas rodam de forma segura ignorando
-- a política RLS da tabela usuarios, o que previne loops/recursão infinita.
CREATE OR REPLACE FUNCTION public.get_user_perfil()
RETURNS text AS $$
  SELECT perfil FROM public.usuarios WHERE uuid = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Revoga a execução pública/anon desta função (necessária apenas para usuários autenticados avaliarem RLS)
REVOKE EXECUTE ON FUNCTION public.get_user_perfil() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.get_user_academia_id()
RETURNS integer AS $$
  SELECT academia_id FROM public.usuarios WHERE uuid = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Revoga a execução pública/anon desta função (necessária apenas para usuários autenticados avaliarem RLS)
REVOKE EXECUTE ON FUNCTION public.get_user_academia_id() FROM PUBLIC, anon;

-- 4. HABILITAR ROW LEVEL SECURITY (RLS) NAS TABELAS
ALTER TABLE public.academias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_aluno ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- 5. CRIAÇÃO DAS POLÍTICAS DE ACESSO (POLICIES)

-- Tabela: academias
-- A verificação do código de acesso (slug) na tela de entrada é pública.
DROP POLICY IF EXISTS "Permitir leitura pública de academias" ON public.academias;
CREATE POLICY "Permitir leitura pública de academias" ON public.academias
    FOR SELECT TO anon, authenticated USING (true);

-- Tabela: planos
-- Planos podem ser visualizados por qualquer operador autenticado (Administrador tem acesso total, outros filtram por academia)
DROP POLICY IF EXISTS "Planos - Operador acessa planos da própria academia" ON public.planos;
CREATE POLICY "Planos - Operador acessa planos da própria academia" ON public.planos
    FOR ALL TO authenticated
    USING ((public.get_user_perfil() = 'Administrador') OR (academia_id = public.get_user_academia_id()))
    WITH CHECK ((public.get_user_perfil() = 'Administrador') OR (academia_id = public.get_user_academia_id()));

-- Tabela: usuarios
-- Operadores podem ler os dados de usuários (Administrador acessa todos, outros filtram por academia)
DROP POLICY IF EXISTS "Usuarios - Operador acessa usuarios da própria academia" ON public.usuarios;
CREATE POLICY "Usuarios - Operador acessa usuarios da própria academia" ON public.usuarios
    FOR ALL TO authenticated
    USING ((public.get_user_perfil() = 'Administrador') OR (academia_id = public.get_user_academia_id()))
    WITH CHECK ((public.get_user_perfil() = 'Administrador') OR (academia_id = public.get_user_academia_id()));

-- Tabela: alunos
-- Alunos protegidos por academia (Administrador acessa todos, outros filtram por academia)
DROP POLICY IF EXISTS "Alunos - Operador acessa alunos da própria academia" ON public.alunos;
CREATE POLICY "Alunos - Operador acessa alunos da própria academia" ON public.alunos
    FOR ALL TO authenticated
    USING ((public.get_user_perfil() = 'Administrador') OR (academia_id = public.get_user_academia_id()))
    WITH CHECK ((public.get_user_perfil() = 'Administrador') OR (academia_id = public.get_user_academia_id()));

-- Tabela: pagamentos
-- Movimentações financeiras (Administrador acessa todas, outros filtram por academia)
DROP POLICY IF EXISTS "Pagamentos - Operador acessa pagamentos da própria academia" ON public.pagamentos;
CREATE POLICY "Pagamentos - Operador acessa pagamentos da própria academia" ON public.pagamentos
    FOR ALL TO authenticated
    USING ((public.get_user_perfil() = 'Administrador') OR (academia_id = public.get_user_academia_id()))
    WITH CHECK ((public.get_user_perfil() = 'Administrador') OR (academia_id = public.get_user_academia_id()));

-- Tabela: historico_aluno
-- Ações de histórico (Administrador acessa todos, outros filtram por academia)
DROP POLICY IF EXISTS "Historico - Operador acessa historico da própria academia" ON public.historico_aluno;
CREATE POLICY "Historico - Operador acessa historico da própria academia" ON public.historico_aluno
    FOR ALL TO authenticated
    USING ((public.get_user_perfil() = 'Administrador') OR (academia_id = public.get_user_academia_id()))
    WITH CHECK ((public.get_user_perfil() = 'Administrador') OR (academia_id = public.get_user_academia_id()));

-- Tabela: logs
-- Visualização de logs (Administrador acessa todos, outros filtram por academia)
DROP POLICY IF EXISTS "Logs - Operador acessa logs da própria academia" ON public.logs;
CREATE POLICY "Logs - Operador acessa logs da própria academia" ON public.logs
    FOR ALL TO authenticated
    USING ((public.get_user_perfil() = 'Administrador') OR (academia_id = public.get_user_academia_id()))
    WITH CHECK ((public.get_user_perfil() = 'Administrador') OR (academia_id = public.get_user_academia_id()));

-- Tabela: academias (Permissão de Edição/Update)
-- Permite que o operador atualize as configurações (Administrador atualiza qualquer uma, outros apenas a própria)
DROP POLICY IF EXISTS "Permitir update de academias por administradores" ON public.academias;
CREATE POLICY "Permitir update de academias por administradores" ON public.academias
    FOR UPDATE TO authenticated
    USING ((public.get_user_perfil() = 'Administrador') OR (id = public.get_user_academia_id()))
    WITH CHECK ((public.get_user_perfil() = 'Administrador') OR (id = public.get_user_academia_id()));

-- Tabela: configuracoes (Caso exista separadamente no Supabase)
-- Como a tabela 'configuracoes' original do SQLite não possui a coluna 'academia_id',
-- habilitamos o RLS e permitimos a leitura para usuários autenticados da plataforma.
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Configuracoes - Operador acessa configuracoes da propria academia" ON public.configuracoes;
CREATE POLICY "Configuracoes - Leitura de configuracoes para autenticados" ON public.configuracoes
    FOR SELECT TO authenticated
    USING (true);
