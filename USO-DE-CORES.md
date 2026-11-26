# Uso de cores no site ZENI

Este arquivo registra **onde cada cor é usada** no site. A origem das cores é `zeni-site/src/styles/tokens.css` (design system, seção 2). **Atualizar este arquivo sempre que um uso de cor mudar** (regra também no `CLAUDE.md`).

Última atualização: 26/11/2026.

Regras gerais: só tokens, nunca hex solto fora de `tokens.css`; sem vermelho nem verde (exceção provisória: o fantasma do ZENI real, seção 5); texto sobre gradiente é `cinza-900` (exceto onde indicado); gradientes só em tons claros.

## 1. Paleta

### Cinzas
| Token | Hex |
|---|---|
| `cinza-50` | #F1F3F4 |
| `cinza-100` | #E6EAEA |
| `cinza-200` | #CAD2D4 |
| `cinza-300` | #ADBABD |
| `cinza-400` | #91A2A6 (sem uso) |
| `cinza-500` | #758B8F |
| `cinza-600` | #5E7073 (sem uso) |
| `cinza-700` | #475557 |
| `cinza-800` | #30393B |
| `cinza-900` | #1A1F20 |
| `white` | #FFFFFF |

### Amarelo da marca
`brand-amarelo-50` #FEFDF1 · `-100` #FDFADD · `-200` #FAF4AD · `-300` #F7ED7E · `-400` #F4E64D · `-500` #F1E01D

### Azul da marca
`brand-blue-50` #F0FBFF (sem uso direto) · `-100` #E3F7FF · `-200` #B3E9FF · `-600` #0080B2 (a 40% no cartão "minha evolução"; cheio nos dias escolhidos do lembrete) · `-700` #005B80 (links) · `-800` #00374D (números do dashboard e etiqueta de IA)

### Tons únicos
`brand-bruma` #98B5BE · `brand-seixo` #C4C4C4 · `brand-porcelana` #F5FAFE

### Semânticos (aliases)
| Token | Aponta para | Uso |
|---|---|---|
| `bg-page` | white | fundo de painéis, avatar, pílula, menu, modal, campos |
| `bg-subtle` | porcelana | toque pressionado em linhas e menu (o fundo geral do app deixou de usá-lo) |
| `bg-highlight` | blue-100 | avisos informativos, etiqueta de IA |
| `bg-accent` | amarelo-300 | botão principal, selo, alternador ligado |
| `bg-accent-pressed` | amarelo-400 | botão principal pressionado |
| `bg-inverse` | cinza-900 | botão Voltar, opção ativa do alternador de período, dia ligado, bolinha do alternador, aviso urgente |
| `text-primary` | cinza-900 | texto padrão, linha e pontos do gráfico |
| `text-secondary` | cinza-700 | texto de apoio (`.botao-motivo`, estado do alternador, texto do modal) |
| `text-brand` | blue-800 | títulos (h1 a h3), rótulos, ícones e elementos de destaque (ver seção 5.1) |
| `text-link` | blue-700 | links |
| `text-on-accent` | cinza-900 | texto sobre amarelo |
| `text-on-inverse` | white | texto sobre `bg-inverse` |
| `icon-on-inverse` | amarelo-300 | ícone do aviso urgente |
| `border-strong` | cinza-500 | bordas de botão vazado, alternador, campos, dias |
| `border-subtle` | seixo | divisor das linhas de navegação |

## 2. Home

| Elemento | Cor |
|---|---|
| Fundo da página (`.app`, vale para todas as telas) | `cinza-50` |
| Fundo da Home | `--grad-home`: linear de `cinza-50` (topo), `cinza-300` (40%) até `blue-800` a 80% de opacidade (base), de ponta a ponta da tela |
| Avatar e pílula do ZENI | fundo `bg-page`; ícones (pessoa e bateria) `text-brand`; texto da pílula `text-primary`; "ZENI desconectado" em `cinza-700` |
| **Painel do dashboard** (`.home-dados`) | **gradiente radial (elipse) centrado em 30% / 25%: `cinza-200` perto do canto superior esquerdo a `cinza-100` nas bordas**; glow interno `--brilho-interno` |
| **Cartões de suavidade e ritmo** (`.dado`) | gradiente 160°, `cinza-50` a `cinza-200`; glow interno `--brilho-interno` |
| Número do dashboard (com valor e estado vazio "–") | `blue-800` |
| Rótulos "suavidade" e "ritmo" | `text-brand` (blue-800) |
| **Cartão "minha evolução"** (`.cartao--azul`) | 4 camadas: radial `blue-100` (85% 10%), radial `blue-200` (10% 35%), radial `blue-600` a 40% de opacidade (80% 100%, token `--blue-600-40`), base `blue-100`; glow interno; texto e ícone `text-brand` (blue-800) |
| **Cartão "começar o exercício"** (`.cartao--amarelo`) | 4 camadas: radial `amarelo-50` (15% 10%), `amarelo-500` (90% 25%), `amarelo-200` (30% 100%), base `amarelo-300`; glow interno; texto e ícone `text-brand` (blue-800) |
| Aviso de conexão | `aviso--informacao`: fundo `bg-highlight`, ícone `text-brand` |

## 3. Minha evolução (painel inferior)

| Elemento | Cor |
|---|---|
| Película atrás do painel | `--scrim` (cinza-900 a 40%) |
| Fundo do painel | `bg-page` |
| Alternador 7 / 30 dias | borda `border-strong`; ativo: fundo e borda `bg-inverse`, texto `text-on-inverse` |
| Gráfico: linha e pontos | `text-primary` (cinza-900) |
| Gráfico: área | `amarelo-200` |
| Gráfico: eixos | `cinza-300` |
| Gráfico: números e datas (0, 50, 100 e os dias) e rótulos em caixa-alta | `text-rotulo` (`cinza-600`) |
| "NOTA DE CADA EXERCÍCIO", "N EXERCÍCIOS", "NOTA MÉDIA" | `text-brand`, caixa alta, peso 600 |
| Valor da nota média | `text-primary`, negrito |
| Botão Exportar | `bg-accent` (amarelo-300), texto `text-on-accent` |
| Botão Voltar | `bg-inverse`, texto `text-on-inverse` |

## 4. Componentes comuns

| Componente | Cor |
|---|---|
| Botão principal | `bg-accent` (sempre à direita nas ações duplas); pressionado `bg-accent-pressed`; texto `text-on-accent` |
| Botão Voltar | `bg-inverse` (preto, sempre à esquerda nas ações duplas); pressionado `cinza-800`; texto `text-on-inverse` |
| Botão vazado | borda `border-strong`; texto `text-primary`; pressionado `bg-subtle` |
| Botão desativado | borda `border-strong`; texto `text-secondary` |
| Avisos | informação: fundo `bg-highlight`, ícone `text-brand`; atenção: fundo `amarelo-200`, ícone `text-brand`; urgente: fundo `bg-inverse`, texto `text-on-inverse`, ícone `icon-on-inverse` |
| Etiqueta de IA | fundo `bg-highlight`, texto `blue-800` |
| Linha de navegação | texto `text-primary`; divisor `border-subtle`; chevron `text-brand`; pressionada `bg-subtle` |
| Menu do avatar | fundo `bg-page`; item pressionado `bg-subtle` |
| Alternador (liga/desliga) | borda `border-strong`; bolinha `bg-inverse`; ligado: trilho `bg-accent`; estado em `text-secondary` |
| Seletor de dias (lembretes) | não escolhido: fundo e borda `blue-200`, texto `text-primary`; escolhido: fundo e borda `blue-600` (#0080B2), texto `text-on-inverse`; sem visto e sem brilho interno |
| Campos | borda `border-strong`; fundo `bg-page`; rótulo `text-brand` |
| Selo (nota) | fundo `bg-accent`, texto `text-on-accent` |
| Modal central | fundo `bg-page`; película `--scrim`; texto de apoio `text-secondary` |

## 5. Exercício

| Elemento | Cor |
|---|---|
| Bulb que pulsa | `--grad-bulb-pulso`: `amarelo-300` até transparente |
| Contador de tempo | `text-brand` |
| Contador da instrução ("Exercício 1 de 3") e da pergunta da triagem | `text-brand` |
| Indicador de voz | fundo `amarelo-200`, texto `text-primary` |
| Tela de espera | fundo `--grad-amarelo` (amarelo-50, 300, 500); texto `text-primary` |
| Tela de carregamento | fundo `bg-page`; bulb `cinza-100`; preenchimento em gradiente `amarelo-400`, `amarelo-300`, `amarelo-100`; halo desfocado (blur de 32 px) em `amarelo-300` atrás do oval, que acende até 80% no ritmo do preenchimento |
| Personagem 3D: corpo | gradiente por vértice na altura: `cinza-100` da cabeça e ombros (a partir de 0,6 m) até `cinza-200` perto da cintura (abaixo de 0,05 m); material fosco, sem textura |
| Personagem 3D: o ZENI | `brand-bruma` |
| Personagem 3D: céu / chão | `white` / `cinza-100` |
| Personagem 3D: linha de mesa (exercícios D e F) | `cinza-300` |
| Personagem 3D: fantasma do ZENI real (só com o ZENI conectado) | translúcido (55%), com brilho da mesma cor; muda suave de `fantasma-perto` (verde suave, #7CC99A) a `fantasma-meio` (`amarelo-400`) a `fantasma-longe` (coral suave, #EE9A7E) conforme o ZENI real se afasta do caminho do exercício (até 15°: verde; 45° ou mais: coral) |
| Teste ao vivo do ZENI (conexão): mostradores | fundo `cinza-50` com `--brilho-interno`; brilho `amarelo-300` que cresce com o movimento; desenho do ZENI (silhueta) |
| Teste ao vivo: barra de movimento e barras de "parado" da calibração | trilho `cinza-100`, preenchimento `amarelo-500`, rótulo `text-rotulo` |
| Teste ao vivo: lista de verificação | ícone em círculo `cinza-100` (pendente) ou `bg-accent` com `text-on-accent` (ok); texto `text-secondary` / `text-primary` |
| Guia de posição da calibração (desenho) | "você" em `cinza-200`, rótulos `text-rotulo`, mesa `cinza-400`, seta `text-brand` |

## 4.1 Brilho interno

`--brilho-interno` (branco 70%, 30 px, interno) está em: painel do dashboard, cartões de dados, cartões da home, e agora em componentes de fundo colorido ou escuro: avisos, selo, etiqueta de IA, indicador de voz e trilho do alternador (o seletor de período e os dias do lembrete não têm brilho) (os dias do lembrete não têm brilho desde 26/11). **Os botões (`.botao`, incluindo os das ações duplas dos bottom sheets) não têm brilho nem gradiente.** Componentes de fundo branco (painel, modal, menu, avatar, pílula, campos) também não mostram o brilho (seria branco sobre branco).

## 5.1 Títulos

Todos os `h1`, `h2` e `h3` usam `text-brand` (regra em `base.css`), assim como `.cartao-titulo`. Também usam `text-brand` os elementos de destaque: `.conectar-destaque` (texto em destaque), `.conectar-numero` (contagem de segundos) e `.hora-valor` (horário do lembrete). Todo `.icone` do site é `text-brand`, com o mesmo traço (`--stroke-icone`, 1,75 px); só ficam claros os ícones sobre fundo escuro (aviso urgente e marca dos dias ligados). Isso cobre os títulos dos painéis, a pergunta da triagem, o nome do exercício e os títulos dos cartões da home.

## 6. Tokens definidos, sem uso

`cinza-400`, `cinza-600`, `blue-50` (fora dos gradientes), `grad-cinza-card` (o painel do dashboard agora é `cinza-100` chapado), `grad-amarelo-card`, `grad-azul-card`, `grad-bruma-card`.

## 6.1 Fora da regra de `text-brand` (continuam como estavam)

Texto corrido e valores (`text-primary`), texto dos botões, texto de avisos (inclusive do aviso urgente, em branco sobre `bg-inverse`), a letra da pílula, o valor da nota média, o ícone de verificado e as marcas dos dias (ficam dentro de áreas amarelas ou escuras), e os ícones sobre fundo escuro.

## 7. Histórico de mudanças de cor

| Data | Mudança |
|---|---|
| 26/11/2026 | Novos tokens `--fantasma-perto` (#7CC99A), `--fantasma-meio` (`amarelo-400`) e `--fantasma-longe` (#EE9A7E) para a cor do fantasma do ZENI real no exercício, a pedido do grupo. Primeiro verde e primeiro tom avermelhado da paleta; provisórios até o teste com usuários (design system, pendência 5). Teste ao vivo e guia de calibração registrados na seção 5 (só tokens existentes). |
| 26/11/2026 | Bulb da home: de `amarelo-200` para `porcelana`. |
| 26/11/2026 | Glow branco interno (`--brilho-interno`, 30 px, branco 70%) no painel do dashboard, nos cartões de suavidade e ritmo e nos dois cartões da home. |
| 26/11/2026 | Cartões de suavidade e ritmo: de `cinza-100`→`cinza-300` para `cinza-50`→`cinza-200`. |
| 26/11/2026 | Painel do dashboard: de `grad-cinza-card` (`cinza-50`→`cinza-200`) para `cinza-100` chapado. |
| 26/11/2026 | Cartão "minha evolução": de cinzas (50, 200, 300, 100) para azuis claros (`blue-50`, `blue-200`, `blue-100`). A classe passou de `.cartao--cinza` para `.cartao--azul`. |
| 26/11/2026 | Rótulos do gráfico de evolução em `text-secondary` (antes `text-primary`). |
| 26/11/2026 | Cartão "minha evolução": de `blue-50`/`blue-200`/`blue-100` para `blue-100`, `blue-200` e `blue-600` a 40% de opacidade (novo token `--blue-600-40`). |
| 26/11/2026 | Fundo da página (`.app`): de `bg-subtle` (porcelana) para `cinza-50`. |
| 26/11/2026 | Painel do dashboard: de `cinza-100` para `cinza-200` chapado (destacar do fundo `cinza-50`). |
| 26/11/2026 | Painel do dashboard: de `cinza-200` chapado para gradiente 160° de `cinza-200` a `cinza-100`. |
| 26/11/2026 | Números grandes do dashboard: de `cinza-900` (com valor) e `cinza-700` (vazio) para `blue-700`. |
| 26/11/2026 | Números grandes do dashboard: de `blue-700` para `blue-800`. |
| 26/11/2026 | Títulos (h1 a h3 e títulos dos cartões), rótulos (dashboard, gráfico, campos, contadores) e ícones (cartões da home, avatar, bateria, chevron, avisos de informação e atenção): de `cinza-900`, `cinza-800`, `cinza-700` e `blue-700` para `text-brand` (novo token, `blue-800`). |
| 26/11/2026 | Painel do dashboard: de gradiente linear 160° para radial, `cinza-200` no centro e `cinza-100` nas bordas (mais claro nas bordas). |
| 26/11/2026 | Painel do dashboard: centro do radial movido de 50% / 50% para 30% / 25%, deixando o canto superior esquerdo mais escuro. |
| 26/11/2026 | Padronização: `.icone` todo em `text-brand`; `.conectar-destaque`, `.conectar-numero` e `.hora-valor` em `text-brand`; brilho interno em avisos, selo, etiqueta de IA, indicador de voz, seletor ativo, dias ligados e trilho do alternador; botões duplos: Voltar preto à esquerda, principal amarelo à direita, em todos os bottom sheets. |
| 26/11/2026 | Botões (`.botao`) sem brilho interno nem gradiente, em qualquer lugar (inclusive nos bottom sheets). |
| 26/11/2026 | Dias do lembrete: escolhidos em `blue-600`, não escolhidos em `cinza-600` (antes `bg-inverse` e branco com contorno); sem brilho interno. |
| 26/11/2026 | Dias do lembrete: sem visto; não escolhidos de `cinza-600` para `blue-200` (texto `text-primary`). |
| 26/11/2026 | Tela de carregamento do exercício: halo desfocado em `amarelo-300` ao redor do oval. |
| 26/11/2026 | Corpo do personagem 3D: de `brand-porcelana` chapado para gradiente `cinza-100` (cima) a `cinza-200` (cintura). |
| 26/11/2026 | Opção ativa do seletor 7 / 30 dias: sem brilho interno, chapada em `bg-inverse`. |
| 26/11/2026 | Rótulos sobre fundo branco (gráfico, caixa-alta do gráfico, "nota média", campos) passam a `text-rotulo` (= `cinza-600`), token novo. "suavidade" e "ritmo" ficam em `text-brand` por contraste. |
| 26/11/2026 | "Nota média" do gráfico vira bullet: fundo `blue-600` e texto (rótulo e valor) em `bg-page` (branco), vazado. |
| 26/11/2026 | "Nota média" no bullet: rótulo em medium (500) e número em bold (700), os dois em `white` (o tom mais claro, igual ao fundo do bottom sheet). |
| 26/11/2026 | "Nota média" no bullet: rótulo passa de medium para light (300); o peso 300 entra no carregamento da fonte. Cor não muda. |
| 26/11/2026 | Frase de tendência de Minha evolução vira cartão: fundo `cinza-200` com `--brilho-interno`; texto em `text-primary`. |
| 26/11/2026 | Cartão da frase de tendência: gradiente radial de `cinza-200` (centro) a `cinza-50` (bordas), além do brilho interno; padding de 20 px. |
| 26/11/2026 | Alternador 7 / 30 dias vira toggle: trilho `blue-600` a 50% (token novo `--blue-600-50`), opção escolhida `blue-600` com texto `white`, a outra com `text-primary`. Antes: bordas `border-strong` e escolhida `bg-inverse`. |
| 26/11/2026 | Exportar vira menu suspenso aberto para cima: fundo `cinza-100` com `--brilho-interno`, texto `text-primary`, ícones `text-brand`. |
| 26/11/2026 | Logo da marca na Home (`src/assets/zeni-logo.svg`). |
| 26/11/2026 | Logo da Home em `text-brand` (`blue-800`), aplicado por máscara em vez da cor `#161616` do arquivo; tamanho reduzido em 50% (24 px para 12 px de altura); depois +20% (14,4 px). |
| 26/11/2026 | Tela de entrada nova: gradiente linear `cinza-100` (topo), `cinza-300` (40%) e `blue-800` (base); logo em `white` por máscara. |
| 26/11/2026 | Fundo da Home: o gradiente da tela de entrada (`--grad-home`, token novo), com o azul a 80%. Substitui o bulb `--grad-bulb` (porcelana). |
| 26/11/2026 | Fundo da Home: azul do gradiente (`--grad-home`) de 80% para 30% de opacidade. |
| 26/11/2026 | Topo do gradiente da Home: de `cinza-100` para `cinza-50` (mais claro). |
| 26/11/2026 | Fundo da Home: azul do gradiente de 30% para 60% de opacidade. |
| 26/11/2026 | Fundos dos cartões "minha evolução" e "começar o exercício" e do painel do dashboard a 80% de opacidade (só as cores do fundo, via `color-mix`; texto e ícones a 100%). Cartões de suavidade e ritmo ficam a 100%. |
| 26/11/2026 | Fundo da Home (`--grad-home`) inteiro a 50% de opacidade, sobre o fundo da página (`cinza-50`). O azul, que já era 60% no token, fica com cerca de 30% efetivos. |
| 26/11/2026 | Azul do `--grad-home` de 60% para 80%; com o gradiente a 50% na Home, o azul fica com cerca de 40% efetivos. |
| 26/11/2026 | Aviso do computador (`AvisoWeb`): fundo no gradiente da tela de entrada (`cinza-100`, `cinza-300`, `blue-800`), cartão `bg-page`, título, logo e ícone em `text-brand`, texto em `text-primary`. |
