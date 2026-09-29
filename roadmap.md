# Reach OS — Integração Brand + Workspace

Prioridade: INTEGRAR > PRESERVAR > PADRONIZAR > OTIMIZAR.

## Auditoria (concluída)

**Brand (projeto atual)** — TanStack Start + Lovable Cloud.
Rotas: `/agencia/*` (home, equipe, clientes, calendário, comunicação, modelos, configurações),
`/b/$brandSlug/*` (início, plano, biblioteca, espaço-360, agenda, resultados, campanha, configurações), `/auth`.
Core já existente: `organizations`, `profiles`, `user_roles` (agency_admin/agency_member/client),
`user_permissions`, `team_members`, `brands` (cliente central, com `modules` jsonb), `brand_members`,
convites, RLS por organização com `is_agency_org`, `is_brand_member`, `has_role`, `has_permission`.
Design system: `src/styles.css` (tokens oklch + 4 temas Reach), `components/ui`, `ui-reach/primitives`,
`reach/*` (app-shell, brand-shell, sidebar, topbar, glass-card, form-modal, module-nav, page-header).

**Workspace (ZIP)** — protótipo estático: `index.html` + `styles.css` + `app.js` (vanilla, sem build).
Persistência 100% em `localStorage` (`cliente-nunca-sem-post-v1`) — referência funcional, não arquitetura.
Modelo: `clients[] → fronts[] → tasks[]`, além de `team[]`, `templates[]`, `notes[]`, `sectors[]`.
Telas: Work/risco, Clientes, Cliente, Rotinas, Minha agenda, Avaliações, Equipe, Pessoa, Modelos,
Cronograma, Meu acesso. Lógica-chave: `risk()` (verde/amarelo/laranja/vermelho a partir de
`approvedUntil` − hoje − `leadDays`), `period()` por recorrência (semanal/quinzenal/mensal/avulsa),
roadmap mensal, frases rápidas de avaliação, checklist, paleta pessoal por colaborador.
Status oficiais (7, preservar literalmente): Parada, Iniciada, Avaliação interna,
Aguardando retorno externo, Ajuste, Avaliação externa, Concluído.

**Equivalências / conflitos**
- Cliente: `data.clients` (Workspace) ≡ `brands` (Brand) → **usar `brands` como cadastro único**.
- Equipe: `data.team` ≡ `team_members` + `profiles` → **usar o core existente**, acrescentando paleta/liderança.
- Modelos: `data.templates` ≡ `plan_templates` (Brand) → objetivos diferentes; manter separados
  (`workspace_templates` = modelo de demanda operacional).
- Tarefas: `espaco360_tasks` (Brand, ligada a campanha/iniciativa) ≠ tarefa operacional do Workspace
  (ligada a frente/ciclo de recorrência) → tabelas distintas, mesmo cliente e mesma pessoa.
- Tema: o ZIP tem toggle claro/escuro próprio → descartar, usar o tema do Brand.

## Fases

- [x] FASE 1 — Auditoria do Brand
- [x] FASE 2 — Auditoria do ZIP do Workspace
- [x] FASE 3 — Mapa de equivalências e conflitos
- [ ] FASE 4 — Core compartilhado: `brands.modules` passa a controlar Brand/Workspace por cliente
- [x] FASE 5 — Home do ecossistema (`/`), hub Brand | Workspace
- [x] FASE 6 — Switcher global flutuante (inferior, compacto, extensível)
- [x] FASE 7 — Rotas `/workspace/*`: Work, Clientes, Cliente, Rotinas, Minha agenda,
      Avaliações, Equipe, Configurações, Meu acesso (schema já na FASE 4)
- [x] FASE 8 — Workspace usando tokens/glass/surface/pill do Brand (sem DS paralelo)
- [x] Workspace pronto para execução: formulários de frentes e demandas, aplicação de
  modelos, Cronograma mensal e Modelos/Setores editáveis (Brand intocado)
- [x] FASE 9 — Integração de clientes (um cadastro, dois módulos): cadastro/edição de
  cliente e módulos direto no Workspace usando `brands` (createBrand/updateBrand do Brand),
  lista de clientes sem Workspace ativo com ativação em 1 clique, e Canais do cliente
  (espaco360_channels) compartilhados entre Brand e Workspace
- [ ] FASE 10 — Integração de equipe/usuários
- [x] FASE 11 — Deep links Brand ↔ Workspace: "Consultar Brand" no Workspace e
  "Ver no Workspace" no painel do cliente no Brand
- [ ] FASE 12 — Revisão de permissões e RLS
- [ ] FASE 13 — Testes (login, home, switcher, cliente, equipe, permissão, tarefa, status, avaliação, cronograma, responsividade)
- [ ] FASE 14 — Limpeza de redundâncias comprovadas

## Correções 16/09

- Brand restaurado ao original: `src/routes/index.tsx` e `src/routes/b.$brandSlug.index.tsx`
  voltaram exatamente à versão do remix. Única adição mantida no Brand: o switcher
  flutuante montado no `__root` (não altera conteúdo nem lógica do Brand).
- Fina Fragrância repovoada a partir do Plano 360 2026 (`src/lib/brand-data.ts`):
  19 iniciativas, 6 campanhas Q2, 3 canais, acompanhamento mensal (abr–jun),
  3 reuniões e 6 tarefas; módulos Plano/Espaço 360/Biblioteca/Workspace ativos.
- Pendente: lista dos demais clientes (não existem no banco do remix).

## Reach Echo — etapa atual (concluída)
- [x] Workspace nativo (iframe removido), shell + Visão geral + Controle
- [x] Home Reach Echo em `/` (Brand | Workspace + Clientes/Equipe/Configurações)
- [x] Switcher global com botão Echo
- [x] Auth: convite/recuperação têm prioridade sobre sessão ativa; criação de senha obrigatória; "Criar conta" oculto
- [x] RLS: leitura interna do Workspace removida para brand_member
- [ ] Testes C/D/F/G/H de ponta a ponta com usuários reais (convite e perfil cliente)

## Reach Echo — FASE 2 (entregas + client hub)
- [x] Camada ENTREGA: `workspace_work_orders`, `workspace_work_order_sources`, `workspace_tasks.work_order_id`
- [x] RPCs: `ensure_front_work_order`, `dispatch_brand_item_to_work_order` (interno), `submit_client_request_to_workspace` (cliente)
- [x] RLS: entregas e origens só para a agência dona do cliente
- [x] Client Hub único em `/clientes` e `/clientes/$brandSlug`; `/workspace/clientes` redireciona
- [x] Página operacional do cliente reorganizada: FRENTE → ENTREGA → TAREFAS + demandas avulsas
- [x] Controle mensal 1–31 com cobertura, marcador de hoje e limite de antecedência
- [x] Rotinas nativas: mesmas tarefas por período e agrupadas por status/pessoa/setor/cliente
- [x] Botão 🚀 reutilizável (`send-to-execution.tsx`) em Solicitações, Tarefas e Tarefas de reunião do 360
- [ ] Calendário mensal em grade; Minha agenda com contexto de entrega
- [ ] Testes com perfil Cliente real (RLS de entregas) e fluxo completo 360 → conclusão
