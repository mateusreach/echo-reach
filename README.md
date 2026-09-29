# Reach Eco

Crie o "Reach Brand" (Reach Brand OS) — uma plataforma de inteligência estratégica de marcas, produto irmão/parceiro do "Reach Workspace" (já existe como outro projeto Lovable, chamado reach-elevate).

## Posicionamento
Reach Brand não é um gerenciador de tarefas nem uma plataforma de aprovação de conteúdo. É o "cérebro" de cada marca: fundação, posicionamento, narrativas, metodologia, planejamento estratégico e histórico de decisões, tudo centralizado. Cada marca tem seu "Brand Home".

## Identidade visual (deve ser da mesma família visual do Reach Workspace)
- Tema escuro como padrão (com opção clara/automática), fundo com gradiente sutil escuro (tons de azul/roxo/preto).
- Cor de destaque: gradiente laranja→rosa (o mesmo da marca Reach, como no logo "r."), usado em botões primários, badges de status e destaques.
- Botões totalmente arredondados (pill-shaped), com o mesmo padrão do Reach Workspace: primário (preenchido gradiente laranja), secundário (contorno/translúcido), terciário (texto), ícone, flutuante.
- Cards com bordas suaves bastante arredondadas, sombras discretas, efeito "glass" (vidro fosco) em header, sidebar, painéis flutuantes e modais — usado com moderação.
- Tipografia: um único família moderna tipo Inter, hierarquia clara (Display/H1/H2/H3/Título/Texto/Legenda), evitar peso ultra bold.
- Muito espaço em branco, poucas cores, poucos elementos, foco total no conteúdo/estratégia — inspiração Apple HIG, Linear, Notion, Arc Browser.
- Tela de login no mesmo estilo do Reach Workspace: logo com ícone de gradiente arredondado, nome do produto, campo de email/senha, toggle Entrar/Criar conta, botão primário laranja em pill.

## Estrutura de layout
Header fixo (glass) → Sidebar fixa e recolhível à esquerda (glass, ícones, busca, favoritos) → Área principal de conteúdo → Painel Contextual recolhível à direita (relacionamentos, arquivos, comentários, IA, histórico). Priorizar painéis laterais e overlays leves em vez de modais pesados.

## Papéis e permissões
- Usuários da agência (Reach): acesso completo de criação/edição em todo o Brand Home da marca.
- Usuários do cliente: acesso apenas de VISUALIZAÇÃO ao conteúdo do Brand (fundação, planejamento, narrativas etc. — tudo isso é produzido pela agência), mas acesso completo de gestão dentro do seu próprio módulo "Espaço 360" (ver abaixo).

## Navegação principal (módulos do MVP V1) — sidebar
1. Brand Home (visão geral da marca: identidade, posicionamento, resumo do que está feito e planejado)
2. Estrutura da Marca (fundação: propósito, valores, posicionamento, personas, tom de voz)
3. Biblioteca Editorial (pilares, categorias, subcategorias, ideias de conteúdo)
4. Biblioteca Criativa (referências visuais, materiais criativos)
5. Referências (benchmarks, inspirações)
6. Radar (tendências e sinais de mercado)
7. Mercado (concorrência, posicionamento competitivo)
8. Canais (redes/canais da marca e status)
9. Resultados (indicadores e desempenho)
10. Evolução da Marca (timeline/histórico de decisões e aprendizados — nada se perde, tudo evolui)
11. Especialistas IA (painel de assistentes de IA especializados que usam o contexto da marca — Reach AI Panel)
12. Pesquisa Global (busca em toda a plataforma)
13. **Espaço 360** (NOVO módulo, destacado separadamente na navegação, "espaço do cliente"): aqui o cliente organiza e acompanha a EXECUÇÃO do que foi definido no planejamento do Brand. Deve conter:
   - Roadmap visual com fases e marcos
   - Metas e objetivos organizados por mês (ex: Julho, Agosto, Setembro...), cada mês mostrando: metas definidas, status (não iniciado/em andamento/concluído), progresso percentual
   - Lista de tarefas/ações derivadas do planejamento estratégico
   - Indicador geral de progresso do roadmap

## Dados de exemplo
Não há dados reais de cliente disponíveis ainda. Popule o Brand Home e o Espaço 360 com um exemplo FICTÍCIO e claramente identificável como exemplo (ex: marca "Aurora Cosméticos", cliente fictício da agência Reach), incluindo: fundação de marca básica, 3-4 pilares editoriais, um roadmap de exemplo com metas mensais (últimos 3 meses + próximos 3 meses) e status variados de progresso.

## Posicionamento como plataforma parceira
Incluir, no menu/rodapé, um link/badge discreto "Parte do ecossistema Reach" com referência ao "Reach Workspace" como plataforma parceira (sem integração técnica de login/dados por enquanto — apenas identidade visual compartilhada e menção cruzada).

Comece pela estrutura geral (layout, navegação, tela de login, Brand Home e Espaço 360 com dados de exemplo) antes de detalhar os módulos mais profundos.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/84a878e8-a903-4c29-9ea2-ec32c3f87a46).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
