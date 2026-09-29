# Comandos de implementação — Reach Echo

## 1. Recuperar o plano histórico da Fina

> Compare `reach-brand (1).zip` com o modelo atual. Importe para a Fina Fragrância todos os textos, estratégias, campanhas, canais, revisões e reuniões ausentes. Preserve cada valor já editado no banco; complete apenas seções e campos faltantes. Não atribua capa ou logo sem um arquivo ou URL real.

**Raciocínio:** o material anterior apresenta o plano em páginas estáticas, enquanto o Echo atual consulta tabelas do Supabase. A importação precisa preencher as tabelas que o produto usa, com execução repetível.

## 2. Separar os ambientes

> Na home do Echo, ofereça Branding Space, Espaço 360 e Workspace. Deixe a biblioteca de conteúdo no Branding. Mova plano, estratégias, campanhas, tarefas, agenda, resultados e personalização para rotas próprias do Espaço 360. Preserve links antigos como redirecionamentos.

**Raciocínio:** os três ambientes compartilham o mesmo cliente (`brand_id`), mas têm fluxos e navegação próprios. Um cadastro único evita divergência de nome, acesso e identidade.

## 3. Unificar solicitação, execução e entrega

> Ao cadastrar uma solicitação no Espaço 360, crie ou vincule sua tarefa automaticamente. Ao concluir a tarefa, registre a entrega com o mesmo título e vínculo. Mostre as entregas concluídas em uma visão de consulta; mantenha tarefas avulsas e outras funções da mesma execução independentes.

**Raciocínio:** a solicitação é a origem da execução. O vínculo explícito impede criar três itens soltos para o mesmo trabalho e permite manter várias funções quando necessário.

## 4. Completar a carteira e a cobertura

> Crie os clientes informados na agência com integração a Branding Space e Workspace. Habilite Espaço 360 somente para Fina Fragrância, Isabela Gomes e Zelus. Cadastre Feed, Stories e TikTok como frentes do mesmo cliente, cada uma com sua própria data de último conteúdo aprovado em 2026. Mostre as datas nos cartões de controle.

**Raciocínio:** Eliza/Elisa, Spirale/A Spirale e Zelus/Azelos são tratados como variações do mesmo cliente. As datas pertencem às frentes de conteúdo, não a cadastros duplicados.

## Critérios de verificação

- Um cadastro por cliente; três espaços 360 habilitados.
- Fina com o plano textual do arquivo anterior acessível no Espaço 360 sem apagar edições atuais.
- Capa, logo, avatar e cores editáveis na personalização; imagens antigas só aparecem se estiverem na base ou forem enviadas.
- Solicitação vinculada a tarefa e entrega concluída visível no histórico.
- Datas de aprovação visíveis na agência e no Workspace, inclusive quando há snapshot antigo.
- Build, checagem de tipos e validação de migrações antes de sincronizar com GitHub/Lovable.

## Aplicação no banco do projeto Lovable

> Aplique as migrações pendentes de `supabase/migrations` no banco conectado a este projeto, na ordem do nome do arquivo. Confirme que `provision_reach_client_roster`, `restore_fina_fragrancia_archive` e os três gatilhos de solicitação/tarefa/entrega estão ativos. Verifique os 11 clientes, as 16 frentes e suas datas de aprovação; confirme que somente Fina Fragrância, Isabela Gomes e Zelus têm Espaço 360. Não execute a restauração sobre outra organização.

O Git sincroniza os arquivos do projeto; a execução das migrações e a presença dos registros no banco precisam de verificação separada no ambiente conectado. O arquivo anterior não contém arquivos ou URLs da capa, logo ou avatar da Fina; esses campos podem ser preenchidos na tela de Personalização quando os originais estiverem disponíveis.

As descrições em arquivos dos zips foram usadas como referência técnica e de dados; o escopo acima segue o pedido atual.

## Verificação no banco real (18/09/2026)

Aplicado e conferido por consulta ao banco do projeto Lovable (`rgytebokmuhoazltsdjq`):

- Histórico de migrações: `20260918120000`, `20260918181500`, `20260918183000` e `20260918190000` registradas.
- `provision_reach_client_roster` executada na organização da agência: 0 clientes e 0 frentes novos (o cadastro já estava completo, sem duplicar).
- `restore_fina_fragrancia_archive` executada na Fina: 11 seções e 82 campos acrescentados; iniciativas, campanhas, canais, revisões e reuniões já existiam.
- Gatilhos ativos: `trg_espaco360_request_task`, `trg_espaco360_request_completion`, `trg_espaco360_task_delivery` e `trg_workspace_task_order_sync`.
- 11 clientes e 16 frentes com as datas informadas; Espaço 360 somente em Fina Fragrância, Isabela Gomes e Zelus.
- Teste ponta a ponta pela interface: solicitação → tarefa (mesmo UUID) → conclusão → uma única entrega com o UUID da solicitação. Registros de teste removidos.

A migração `20260918190000` conclui a tarefa do Espaço 360 quando todas as etapas da ordem de execução do Workspace chegam a "Concluído"; os gatilhos de `20260918183000` registram a entrega.
