# Instruções para Configurar o Banco de Dados Supabase

## Passo 1: Acessar o Supabase Dashboard

1. Acesse https://supabase.com/dashboard
2. Faça login na sua conta
3. Selecione o projeto que você está usando para esta aplicação

## Passo 2: Executar o Script SQL

1. No menu lateral esquerdo, clique em **SQL Editor**
2. Clique em **+ New Query** para criar uma nova consulta
3. Copie todo o conteúdo do arquivo `database-schema.sql`
4. Cole no editor SQL
5. Clique em **Run** (ou pressione Ctrl+Enter)

## Passo 3: Verificar as Tabelas Criadas

1. No menu lateral, clique em **Table Editor**
2. Você deverá ver as seguintes novas tabelas:
   - `user_missions` - Missões personalizadas do usuário
   - `user_inventory` - Inventário de itens cosméticos
   - `user_equipped_items` - Itens atualmente equipados
   - `user_achievements` - Conquistas desbloqueadas
   - `user_time_goal` - Meta de tempo do usuário

3. A tabela `user_stats` foi atualizada com a coluna `account_created_at`

## Passo 4: Configurar Row Level Security (RLS) - OPCIONAL

Se você quiser adicionar segurança extra, pode configurar políticas RLS para cada tabela:

### Para user_missions:
```sql
-- Permitir que usuários vejam apenas suas próprias missões
CREATE POLICY "Users can view own missions" ON user_missions
  FOR SELECT USING (auth.uid() = user_id);

-- Permitir que usuários insiram suas próprias missões
CREATE POLICY "Users can insert own missions" ON user_missions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Permitir que usuários atualizem suas próprias missões
CREATE POLICY "Users can update own missions" ON user_missions
  FOR UPDATE USING (auth.uid() = user_id);

-- Permitir que usuários deletem suas próprias missões
CREATE POLICY "Users can delete own missions" ON user_missions
  FOR DELETE USING (auth.uid() = user_id);

-- Ativar RLS
ALTER TABLE user_missions ENABLE ROW LEVEL SECURITY;
```

Repita políticas similares para as outras tabelas (`user_inventory`, `user_equipped_items`, `user_achievements`, `user_time_goal`).

## Passo 5: Testar a Aplicação

1. Reinicie o servidor de desenvolvimento se necessário
2. Faça login na aplicação
3. Teste as funcionalidades:
   - Criar uma missão personalizada
   - Abrir uma loot box (se tiver chaves)
   - Desbloquear uma conquista
   - Criar uma meta de tempo
4. Faça logout e login novamente para verificar se os dados foram salvos corretamente

## Notas Importantes

- **Backup**: Antes de executar o script, faça um backup do seu banco de dados
- **Dados Existentes**: O script usa `IF NOT EXISTS`, então não sobrescreverá tabelas existentes
- **Chaves (Keys)**: As chaves ainda não estão sendo salvas no banco. Se quiser persistir as chaves, adicione uma coluna `keys` na tabela `user_stats`:

```sql
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS keys INTEGER DEFAULT 0;
```

## Solução de Problemas

### Erro: "relation already exists"
- Isso significa que a tabela já existe. Você pode ignorar este erro ou deletar a tabela existente primeiro.

### Erro: "permission denied"
- Verifique se você tem permissões de administrador no projeto Supabase.

### Dados não aparecem após login
- Verifique o console do navegador (F12) para erros
- Confirme que as tabelas foram criadas corretamente no Table Editor
- Verifique se o `user_id` está correto nas tabelas
