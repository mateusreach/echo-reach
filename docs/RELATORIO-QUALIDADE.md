# Echo · Relatório de qualidade (página 25)

Data: 29/09/2026. O que foi verificado, o que foi removido e o que ainda depende do ambiente conectado.

## Resumo

| Item | Situação |
|---|---|
| Checagem de tipos | ✅ 0 erros (`npx tsc --noEmit -p .`) |
| Build | ✅ passa (`npm run build`) |
| RLS nas migrações (A2) | ✅ 26 tabelas criadas nas migrações, todas com RLS; nenhuma função `SECURITY DEFINER` sem `search_path` (`npm run test:rls`) |
| Matriz de permissões (F1) | ✅ `docs/RLS-MATRIZ.md` |
| Testes SQL (F1) | 🟡 escritos em `supabase/tests/like_rls.test.sql` (14 verificações com pgTAP); **rodar no ambiente conectado** com `supabase test db` |
| Testes ponta a ponta (F2) | 🟡 escritos em `tests/e2e/` (Playwright); **falta instalar** `@playwright/test` (ver abaixo) |
| Diagnóstico do Like no demo | ✅ `/like/diagnostico`: 15 passos, todos passando |
| Responsividade (F3) | ✅ 20 páginas medidas em 360 e 768 px; 4 tinham rolagem horizontal em 360 px e foram corrigidas |
| Acessibilidade (F4) | ✅ nas páginas auditadas: nenhum botão ou link sem nome, nenhuma imagem sem `alt`, nenhum campo sem rótulo; movimentos respeitam `prefers-reduced-motion` |
| Desempenho (F5) | ✅ migração de índices `20260929180000_echo_perf_indexes.sql` (cliente + estado + data) |
| Limpeza (F6) | ✅ 11 telas do piloto viraram redirecionamentos e 25 arquivos sem uso foram removidos |

## Responsividade: o que estava errado

| Página | Largura medida em 360 px | Causa | Correção |
|---|---|---|---|
| `/workspace` | 681 px | linha de lista (`ops-row`) não encolhia com o selo de estado | `min-width: 0` nos filhos e quebra de linha abaixo de 560 px (`styles/echo/app.css`) |
| `/e360/fina-fragrancia` | 408 px | mesma linha de lista | mesma correção |
| `/like/painel` | 366 px | mesma linha de lista (aba Prazos) | mesma correção |
| `/like/$slug/historico` | 509 px | tabela “Por frente e campanha” sem rolagem própria | tabela dentro de `.lb-table-wrap` |

O teste `tests/e2e/responsivo.spec.ts` repete essa medida em 360, 768, 1024 e 1440 px para as 20 páginas.

## Removido e por quê (A3)

**Telas estáticas do piloto (dados fixos da Fina Fragrância).** Viraram redirecionamentos, para links antigos não quebrarem:

| Rota antiga | Vai para | Onde o conteúdo vive agora |
|---|---|---|
| `/estrutura`, `/evolucao`, `/editorial`, `/referencias`, `/criativa`, `/canais` | `/agencia/clientes` | Brand de cada cliente: Plano, Biblioteca e Identidade |
| `/mercado`, `/radar`, `/especialistas-ia` | `/` | sem equivalente real ainda (eram só texto de exemplo) |
| `/resultados` | `/e360` | Espaço 360 › Resultados |
| `/pesquisa` (lista fixa) | (reescrita) | busca real da página 24 |

**Arquivos sem nenhum uso.** Encontrados por varredura de imports, em rodadas até não sobrar nenhum. Todos continuam no histórico do git:

- **Casca do piloto:** `components/reach/app-shell`, `module-page`, `sidebar`, `topbar`, `module-nav`, `module-switcher`, `page-header`, `background`, `glass-card`, `command-palette`.
  - Foram substituídos por `components/echo/shell` e `layout`.
- **Formulários antigos do Workspace e da agência:** `colaborador-drawer`, `agency-invite-modal`, `workspace-forms`, `workspace-ui`, `send-to-execution`, `client-task-owners`, `section-editor`, `identidade-visual-section`, `referencias-panel`, `uploader`.
  - Foram substituídos pelas telas das páginas 07, 10 e 13.
- **Dados do protótipo:** `lib/brand-data`, `lib/nav`, `lib/workspace-bridge`, `lib/workspace-legacy-data` (e o teste dele).
  - O `workspace-legacy` era o protótipo antigo do Workspace.

O `sitemap.xml` agora lista só `/` e `/auth`: o Echo é uma área logada.

## O que depende do ambiente conectado (A1)

1. **Aplicar as migrações** novas, em ordem:
   - `20260929120000` a `20260929150000`, das páginas anteriores;
   - `20260929160000_echo_like_notify_links`;
   - `20260929170000_echo_search`;
   - `20260929180000_echo_perf_indexes`.
2. **Rodar** `supabase test db` (testes de RLS e dos links).
3. **Publicar as funções de servidor** `like-notify` e `like-link-code`:
   - configurar `RESEND_API_KEY`, `ECHO_MAIL_FROM` e `ECHO_APP_URL`;
   - agendar `like-notify` a cada 5 minutos.
4. **Ligar `pg_cron`**, para os lembretes (`like_send_reminders`, a cada hora).
5. **Playwright:**
   - instalar: `npm i -D @playwright/test && npx playwright install chromium`;
   - rodar `npm run test:e2e`: primeiro no modo demonstração, depois com `ECHO_URL` apontando para o ambiente conectado.
6. **Testes que precisam de usuários reais.** Estão listados no fim de `like_rls.test.sql`:
   - convite e criação de senha;
   - regras `todos` e `sequencial` com duas pessoas;
   - o fluxo completo 360 → Workspace → Like → cobertura.

## Como checar antes de sincronizar (F7)

```bash
npm run check
npm run build
```

`npm run check` roda três coisas: os tipos, a RLS nas migrações e os testes da escala de cobertura.
