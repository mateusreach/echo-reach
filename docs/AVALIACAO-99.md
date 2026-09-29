# Echo · Avaliação final (roteiro da página 99)

Data: 29/09/2026. Aplica o roteiro de `prompts-echo/99-avaliacao.md` ao sistema inteiro, no modo demonstração, que é o único disponível neste computador.

## 1. Funciona

| Página | Critérios de aceite | Como foi verificado |
|---|---|---|
| 02–17 | ✅ | testadas página a página no navegador, na época de cada commit |
| 18 Like: banco e regras | ✅ | `/like/diagnostico`, 15 regras passando (recheck após a limpeza da 25) |
| 19 Envio | ✅ A1 e A2 | navegador |
| 20 Caixa do cliente | ✅ | visão de cliente: contagem, “Começar revisão”, abas, calendário, sem nada interno |
| 21 Revisão | ✅ A1, A3, A4, A5 | pino em %, ajuste bloqueado sem motivo, comparação com clip-path, barra fixa no celular |
| 22 Grade, painel, histórico | ✅ A2 | painel mostra os mesmos 9 “com o cliente” do resumo. A1 (troca de datas e cobertura) está coberto pelo código de `movePublish`; A3 (relatório = decisões) sai direto de `liveDecisions` |
| 23 Notificações e links | ✅ A2, A3 | link revogado sem materiais; decisão do convidado com nome e e-mail. A1 e A4 (e-mail e lembretes) dependem do servidor conectado |
| 24 Busca e sino | ✅ A1, A2 | busca leva à revisão; cliente não acha tarefa interna nem rascunho. A3 (menos de 300 ms): cerca de 300 ms medidos com a máquina sobrecarregada |
| 25 Qualidade | ✅ no que não depende do banco | `docs/RELATORIO-QUALIDADE.md` |

**Dados sem listas fixas:** a última lista fixa, a de clientes do ⌘K, passou a usar a mesma fonte do resto do sistema (`ROSTER` no demo, tabela `brands` no banco). As 11 telas estáticas do piloto foram removidas na página 25.

## 2. Integra

- **Páginas aprovadas continuam abrindo.** A checagem de tipos e o build passam, e o diagnóstico do Like continua verde depois da limpeza.
- **Varredura de erros de console.** 39 rotas, como equipe e como cliente (78 carregamentos). Dois problemas encontrados e corrigidos:
  - `/pesquisa`: chaves repetidas na lista, porque no demo seções e campanhas de marcas diferentes têm o mesmo id;
  - `/agencia/clientes`: era uma tela antiga do piloto, que consultava o banco direto e quebrava no modo demonstração. Virou redirecionamento para `/clientes`, a carteira real da página 06, e todos os links foram atualizados.
  - Nas outras rotas: nenhum erro, nenhuma tela de falha.
- **Mesmo cliente em todos os ambientes.** O demo usa um só cadastro (`ROSTER`), e o banco usa `brand_id` em todas as tabelas novas.
- **Rótulos de status literais.** Seguem o contexto mestre:
  - Workspace: 7 estados, com Avaliação externa e Concluído;
  - Like: `STATUS_LABEL`.
- **Migrações.** Nenhuma migração apaga ou altera dados existentes: são só `CREATE … IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, funções, gatilhos e índices.

## 3. Permissões

- **Equipe × cliente.** Testado no demo (“ver como cliente”):
  - o cliente não vê rascunho, nota interna, tarefa interna nem painel da agência;
  - a equipe não decide pelo cliente;
  - só o admin registra aprovação por outro canal, com justificativa.
- **O banco nega o mesmo que a interface esconde.** As políticas estão em `docs/RLS-MATRIZ.md` e os testes em `supabase/tests/like_rls.test.sql`.
  - Rodar como agency_admin, agency_member sem permissão, client admin e client aprovador depende do ambiente conectado.

## 4. Visual

- **Só tokens da biblioteca.**
  - A estrela de favorito usava uma cor mostarda fixa (`#E8A93A`) e foi trocada pelo token de alerta.
  - As cores fixas que sobraram são intencionais:
    - o fundo escuro atrás de vídeos;
    - os controles brancos sobre imagens;
    - a prévia do e-mail, que imita o e-mail real;
    - a folha de impressão.
- **Estados.** Carregando (skeleton), vazio e sem resultado existiam em todas as telas novas.
  - **Falha com “Tentar novamente”** faltava em 12 telas (todas as do Like, Agenda, Campanha e Resultados do 360, e configurações do Workspace e da pesquisa).
  - Foi criado o componente `LoadFailed` (`components/echo/blocks.tsx`) e aplicado nelas.
- **360 px sem rolagem horizontal.** 20 páginas medidas; as 4 que falhavam foram corrigidas. As tabelas rolam no próprio contêiner (`.lb-table-wrap`).

## 5. Movimento

- O ⌘K abre sem animação.
- A regra geral de movimento reduzido fica em `motion.css`, e as telas novas do Like têm a própria (`like.css`: pinos, comentários novos e zoom).
- As partículas de aprovação não aparecem com movimento reduzido.

## 6. Texto

- Português do Brasil, com datas em dd/mm (o ano aparece quando muda) e erros que dizem o que fazer.
  - Exemplos: “Diga o que ajustar: escolha uma frase, escreva uma observação ou comente no material.” e “Este link expirou. Peça um novo à Reach.”

## Pendente

1. `lib/fina-restore.functions.ts` (restaurar o arquivo da Fina) ficou sem tela que o chame. Foi mantido de propósito: é uma ferramenta de recuperação de dados. Decidir se ganha um botão nas configurações da agência ou se sai.
2. **Tudo que depende do Supabase conectado:** ver `docs/RELATORIO-QUALIDADE.md` › “O que depende do ambiente conectado”.
3. **Telas antigas ainda sem o estado de falha próprio:**
   - Metas;
   - Personalização do 360;
   - Plano (Brand e 360);
   - Meu acesso;
   - Configurações da marca.
   
   Elas não ficam em branco: continuam no skeleton e voltam ao recarregar. Vale padronizar com `LoadFailed`.
