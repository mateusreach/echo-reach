# Echo · Matriz de permissões (RLS) do Like, notificações e busca

Página 25, F1. Regras tiradas das migrações `20260929150000_echo_like.sql`, `20260929160000_echo_like_notify_links.sql` e `20260929170000_echo_search.sql`. Os testes automáticos estão em `supabase/tests/like_rls.test.sql`.

**Como ler:** L = ler · C = criar · E = editar · X = excluir · — = nada. “RPC” quer dizer que a operação só acontece por uma função do banco que confere a regra, nunca por escrita direta na tabela.

Papéis:

- **Admin** é o `agency_admin`.
- **Equipe** é o membro da agência com acesso ao cliente (`is_agency_for_brand`).
- **Equipe sem acesso** é o membro da agência que não atende aquele cliente.
- **Aprovador**, **Revisor** e **Observador** são pessoas do cliente com `like.visualizar`, com o papel dado em `like_approvers`. Revisor e Observador também precisam de `like.comentar` para comentar.
- **Convidado** entra só pelo link `/l/$token`, sem conta.

| Tabela | Admin | Equipe | Equipe sem acesso | Aprovador | Revisor | Observador | Convidado |
|---|---|---|---|---|---|---|---|
| like_rounds | LCEX | LCEX | — | L (só enviadas) | L (só enviadas) | L (só enviadas) | L pelo link (RPC) |
| like_items | LCEX | LCEX | — | L (sem rascunho) | L (sem rascunho) | L (sem rascunho) | L pelo link (RPC) |
| like_versions | LCE* | LCE* | — | L (só enviadas) | L (só enviadas) | L (só enviadas) | L da versão atual (RPC) |
| like_comments | LCEX | LCEX | — | L, C, E próprio (sem internos) | L, C, E próprio (sem internos) | L (C se tiver `like.comentar`) | C pelo link com “comentar” (RPC) |
| like_decisions | L; C só por RPC (outro canal, com justificativa) | L; C nunca | — | L; C por RPC (`like_decide`) | L | L | C pelo link com “decidir” (RPC) |
| like_approvers | LCEX | LCEX | — | L | L | L | — |
| like_settings | LCEX | LCEX | — | L | L | L | — |
| like_views | LCEX | LCEX | — | LCE próprio | LCE próprio | LCE próprio | — |
| like_share_links | LCEX (criar e revogar por RPC) | LCEX | — | — | — | — | — (valida por hash, RPC) |
| like_link_codes | — (só funções) | — | — | — | — | — | — |
| like_activity | LCEX | LCEX | — | L (sem notas internas) | L (sem notas internas) | L (sem notas internas) | — |
| notifications | LCEX próprias | LCEX próprias | LCEX próprias | LCEX próprias | LCEX próprias | LCEX próprias | — |
| notification_prefs | LCEX próprias | LCEX próprias | LCEX próprias | LCEX próprias | LCEX próprias | LCEX próprias | — |
| echo_search() | tudo que a RLS deixa | idem | só o que a RLS deixa | sem tarefas, entregas, frentes, pessoas e rascunhos | idem | idem | — |

\* Versões enviadas são imutáveis: o gatilho `like_version_frozen` bloqueia a edição, e o gatilho `like_immutable` impede editar ou apagar decisões.

## Regras que os testes garantem

1. Cliente não vê rascunho interno nem comentário interno (`like_client_can_see`, `NOT internal`).
2. A equipe não decide pelo cliente. A exceção é o admin por “outro canal”, com justificativa de 10 ou mais caracteres.
3. Só aprovador decide; revisor e observador recebem erro em `like_decide`.
4. Pedir ajuste sem comentário, frase ou observação falha quando `require_comment_on_adjust` está ligado.
5. Aprovar duas vezes a mesma versão não duplica a integração.
6. Desfazer só vale para quem decidiu e por até 5 minutos.
7. Link revogado ou expirado: `like_link_open` devolve só o motivo, e comentar ou decidir falha.
8. `like_link_request_code` não pode ser chamado por `anon` nem `authenticated` (só `service_role`).
9. Nenhuma tabela criada nas migrações fica sem RLS (`node scripts/check-rls.mjs`).
10. Todas as funções `SECURITY DEFINER` fixam o `search_path`.

## Pontos de atenção

- `like_comments_client_write` exige `like.comentar`, não o papel em `like_approvers`. Um observador com essa permissão consegue comentar; isso é intencional (comentar ≠ decidir), mas convém revisar os presets de permissão.
- `echo_search` depende de `is_agency_org(organization_id do perfil)` para liberar tarefas e pessoas. Um perfil sem organização é tratado como cliente.
