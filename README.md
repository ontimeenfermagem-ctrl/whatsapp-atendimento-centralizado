# whatsapp-atendimento-centralizado
Sistema Centralizado de Atendimento WhatsApp com API Oficial e QR Code

Hoje este repo serve, no Railway, as páginas da Imersão GPS do Plantão Sem Medo em
https://io.escolaenfermagemdevalor.com.br (Express mínimo em `server.js`):

| Rota | Arquivo | O que é |
| --- | --- | --- |
| `/igps_set_lp_26-ingresso` | `public/igps_set_lp_26-ingresso/index.html` | página de venda A, lote 1 (com o pré-formulário) |
| `/igps_set_lp_26-ingresso-b` | `public/igps_set_lp_26-ingresso-b/index.html` | versão B, lote 2 (R$ 9,90), dourada; usa os `.js` e as imagens da pasta da A |
| `/igps_set_lp_26-ingresso-c` | `public/igps_set_lp_26-ingresso-c/index.html` | versão C, R$ 3,00 com desconto de 24 h; usa os `.js` e as imagens da pasta da A |
| `/igps_set_lp_26-obrigado` | `public/igps_set_lp_26-obrigado/index.html` | obrigado (compra aprovada) |
| `/igps-lp-formacao` | `public/igps-lp-formacao/index.html` | antecipação da Formação Enfermagem de Valor 2.0: os botões abrem a Ficha dos Presentes (nome, WhatsApp e e-mail), que vai para o painel do paginas (ver "Ficha dos Presentes da Formação") |
| `/igps_set_lp_26-aguardando-pagamento` | `public/igps_set_lp_26-aguardando-pagamento/index.html` | Pix aguardando confirmação |
| `/calculo-de-medicação-calculadora` | `public/calculo-de-medicacao-calculadora/index.html` | calculadora de medicação para enfermagem (abre também sem acento). Base de medicamentos em `meds.js`, contas e conferências em `calc.js`, tela em `app.js` |
| `/BF_out_LS_26-inscricao-a` | `public/bf_out_ls_26-inscricao/index.html` | captação gratuita da Black Friday (lista VIP do vitalício), a página ORIGINAL (roxa, a da CEO; voltou em 05/10 exatamente como era na 68eef0e): nome, e-mail e WhatsApp vão para a planilha `BF_out_LS_26`, o n8n e o painel do paginas (ver "Lista VIP da Black Friday") |
| `/BF_out_LS_26-inscricao-b` | `public/bf_out_ls_26-inscricao-b/index.html` | versão B da captação (teste A/B): layout do modelo "vitalício" em coluna única; mesmo formulário, API, obrigada e Pixel da A. Capas e Izabel vêm da pasta da A. O n8n recebe `pagina.variante` (`a`/`b`), tirada do `page_url`; planilha e painel já recebem o `page_url` |
| `/BF_out_LS_26-obrigada` | `public/bf_out_ls_26-obrigada/index.html` | obrigada da lista VIP: botão do grupo do WhatsApp (abre sozinho em 15 s), suporte e contagem até 26/10 20h |
| `/BF_out_LS_26-obrigada-b` | `public/bf_out_ls_26-obrigada-b/index.html` | obrigada da versão B (a captação B manda para cá): layout do modelo, com o mesmo grupo, suporte, contagem e Pixel (`Lead` com o mesmo `content_name`) da obrigada A |
| `/BF_out_LS_26-inscricao-a-b` | `public/bf_out_ls_26-inscricao-a-b/index.html` | versão com o layout do Open Design (preto, amarelo, Izabel com as marcas em órbita; ver "Visual" abaixo): mesmo formulário, API e Pixel. Manda para a obrigada `-a-b`. O n8n recebe `pagina.variante: 'a-b'` |
| `/BF_out_LS_26-obrigada-a-b` | `public/bf_out_ls_26-obrigada-a-b/index.html` | obrigada da versão `-a-b`, no mesmo visual: mesmo grupo, suporte, redirecionamento de 15 s, contagem e Pixel (`Lead` com o mesmo `content_name`) |
| `/gps`, `/obrigado` | — | endereços antigos: 301 para a página de venda e para o obrigado, **mantendo a query** |

HTML, JS e CSS saem com `Cache-Control: no-cache` (revalidam pelo ETag a cada visita): com a
campanha no ar, qualquer correção entra na hora. Imagens ficam 30 dias em cache; as fontes de
`public/fonts/` (nome com versão, `-v1`) ficam 1 ano, `immutable`.

## Velocidade das páginas

O que deixa as páginas rápidas, e o que não desfazer sem querer (medido com o Lighthouse no perfil
celular, o mesmo do PageSpeed):

- **Fontes do próprio site.** Os arquivos em `public/fonts/` são os MESMOS do Google Fonts, byte a
  byte (Bricolage Grotesque, DM Sans e JetBrains Mono, faixas `latin` e `latin-ext`; nas páginas da
  Black Friday, Archivo variável — largura 62–125 e peso 400–900 — e Instrument Sans), e as regras
  `@font-face` estão no `<style>` de cada página, iguais às do Google (pesos, faixas de caracteres,
  `font-display: swap`). O CSS do Google bloqueava a primeira pintura (até 1,2 s no celular) e abria
  duas conexões a mais. Fonte nova ou peso novo: baixe o arquivo do Google, salve com nome novo
  (`-v2`), acrescente a regra e não reaproveite o nome antigo (o cache é de 1 ano).
- **Reserva com a largura certa.** Enquanto a fonte não chega, o texto usa `Bricolage Grotesque
  reserva` / `DM Sans reserva` (Arial com `size-adjust` medido nos textos da página), que ocupam o
  mesmo espaço; a troca não empurra o layout (era um CLS de 0,159: a reserva antiga, Arial Narrow, é
  23% mais estreita). Elas só cobrem os caracteres que a fonte web desenha.
- **Meta Pixel adiado (só nas páginas de venda).** O `fbq` nasce na hora e enfileira o PageView e
  qualquer evento; o arquivo do Pixel (~250 KB com a configuração, ~500 ms de tela travada no
  celular) só é baixado no primeiro toque, tecla ou rolagem, ou 3 s depois de a página carregar, e
  aí envia a fila inteira. No obrigado e no aguardando o Pixel continua imediato (o obrigado
  redireciona em 16 s). Na Black Friday `-a-b`: adiado na inscrição, como aqui; na obrigada a fila (init,
  PageView e o `Lead` da conversão) nasce no `<head>` e o arquivo é pedido assim que as fontes que a
  tela pediu ficam prontas, no máximo 1,5 s depois. Quem chega do formulário já tem as fontes no
  cache, então para essa pessoa o Pixel sai na hora; numa visita fria os ~265 KB dele não disputam a
  rede com o título.
- **Black Friday:** o que vem abaixo vale para a versão `-a-b`. A A original voltou como era (fontes
  do Google, Pixel na hora e as imagens JPG de antes), então ela tem a velocidade de antes (LCP de
  ~4 s no celular), e a B segue como a outra sessão fez.
- **Black Friday `-a-b`: sem preload de fonte e `font-display: block`.** Num trace do Lighthouse em
  produção, o `<link rel="preload">` das fontes (e também pedir fonte por script antes da primeira
  pintura, com `document.fonts.load`) fazia o Chrome segurar a primeira pintura da página inteira até
  ~2,5 s, com os arquivos já baixados. Sem o preload, as fontes saem na primeira montagem da tela; com
  `block`, o texto aparece uma vez, já na fonte certa (com `swap` ele nascia em Arial e pulava na
  troca: CLS de até 0,26 na obrigada). Não volte o preload nessas duas páginas.
- **Black Friday `-a-b`: a Izabel dentro do HTML no celular.** Até 1040 px de largura, a foto do topo (o
  maior elemento da tela) vem embutida no HTML em base64 (o mesmo `img/izabel-750.avif`): aparece
  junto com a página, sem esperar outro pedido (LCP simulado de ~2,4 s para ~1,4 s). No computador
  ela vem dos arquivos, com preload. Trocou a foto? Regere o base64 (o comando está no comentário do
  `<picture>` do palco) nos DOIS lugares: o palco e a foto da professora (que reaproveita a mesma
  imagem; o brotli cobra ~90 bytes pela repetição).
- **Black Friday `-a-b`: a aura não entra no CLS.** A `.hero__aura` tem o topo da caixa no 0 e sobe com
  `translate: 0 -19.2308%` (19,23% de 130% = os 25% do layout): fica no mesmo lugar, pixel a pixel,
  mas não "anda" quando o hero cresce durante a carga (era a maior parte do CLS, e chegou a 0,26
  numa rodada em produção). Na obrigada, as quebras fixas do título (3 linhas em qualquer fonte)
  seguram o painel do botão no lugar quando a fonte chega.
- **Vídeos sob demanda.** Cada vídeo é a capa do próprio YouTube (`public/igps_set_lp_26-ingresso/videos/<id>.webp`
  e `.jpg`) + o botão de play; as capas só são baixadas quando a seção chega perto da tela. No play,
  o player é montado com os mesmos parâmetros de antes e `autoplay=1`. Antes, os 3 players vinham na
  abertura: ~1,6 MB e ~3 s de JavaScript no celular. Vídeo novo: `data-yt="<id>"` no `<div class="vid">`
  e as duas capas na pasta `videos/` (`https://i.ytimg.com/vi_webp/<id>/sddefault.webp` e `/vi/<id>/sddefault.jpg`).
- **Foto da Iza responsiva.** `public/igps_set_lp_26-ingresso/img/iza-{480,720,900}.{avif,webp}`
  (diferença máxima de 18/255 para o `iza.jpg`, que segue de reserva e no `og:image`); no computador
  ela é pré-carregada (é o maior elemento da primeira tela), no celular não (fica abaixo da dobra).
  Foto nova: gere as 6 versões com a mesma largura e qualidade.
- **Provas sob demanda.** A lista vem de `/igps_set_lp_26-ingresso/provas.json` (o `server.js` lê a
  pasta `provas/`) só quando a seção chega perto da tela.
- **Conexões do formulário só quando ele abre.** O `pre-formulario.js` abre a conexão com o paginas e
  com a Hotmart ao abrir o modal (no `<head>` elas só disputavam banda com o topo).

Toda resposta sai também com `X-Frame-Options: DENY` (nenhum outro site consegue pôr a página dentro
de uma moldura e sobrepor o formulário ou o botão de pagamento), `Strict-Transport-Security:
max-age=31536000` (depois da primeira visita, o navegador só abre o site por HTTPS durante 1 ano),
`X-Content-Type-Options: nosniff` e `Referrer-Policy: strict-origin-when-cross-origin`. A página agora
coleta nome, WhatsApp e e-mail; antes não coletava nada.

Os redirecionamentos de `/gps` e `/obrigado` levam a query junto: um anúncio, a bio ou um QR antigo
com UTM (`/gps?utm_source=facebook&utm_content=criativo-07`) chega à página com a campanha, e o `sck`
vai preenchido para a Hotmart.

```sh
npm install
npm start            # http://localhost:3000/igps_set_lp_26-ingresso
```

## Lista VIP da Black Friday

`/BF_out_LS_26-inscricao-a` pede nome completo, e-mail e WhatsApp (mesma régua do `lead-rules.js`, na
tela e no servidor) e manda um POST para `/api/bf_out_ls_26/lead` (`bf-leads.js`). O servidor valida
de novo e repassa para o Apps Script da planilha
[BF_out_LS_26](https://docs.google.com/spreadsheets/d/1k_hGE6VnSyDiazuwBA3YY9wesnxe_0sbjAka2_6Xduk/edit),
que grava uma linha com data/hora, contato, UTMs do primeiro toque, dispositivo e página. A oferta
abre no dia 26/10 às 20h.

- **Instalação do Apps Script**: passo a passo no topo de `apps-script/bf_out_ls_26.gs`. No fim, o
  Railway precisa de `BF_SHEETS_URL` (URL `/exec` da implantação) e `BF_SHEETS_TOKEN` (o token que a
  função `configurar` mostra). Os cabeçalhos da planilha são criados pelo próprio script.
- **A inscrição nunca trava pela planilha**: se ela falhar ou as variáveis faltarem, a pessoa vê a
  confirmação normalmente e o lead sai no log do Railway com a etiqueta `BF_LEAD_NAO_GRAVADO`.
- **n8n**: cada inscrição válida vai também, em paralelo, para `https://n8n.tecnicadevalor.com.br/webhook/black-outubro-26`
  (`BF_WEBHOOK_URL` troca; `off` desliga): evento `inscricao_bf_out_ls_26` com `lead` (nome, primeiro_nome,
  e-mail, WhatsApp, só dígitos e com 55), `utm` (as 5), `rastreio` (dispositivo, page_url) e `inscrito_em`.
  A página não espera o n8n; são 3 tentativas (na hora, 3 s e 10 s) e o que não chegar sai no log com a
  etiqueta `BF_N8N_NAO_ENVIADO`. O workflow precisa estar **ativo** no n8n (senão ele responde 404).
- **Painel (repo `paginas`)**: cada inscrição válida vai também, em paralelo e pelo servidor (nada muda
  na página), para `POST https://lp.escolaenfermagemdevalor.com.br/api/inscricao` com a página
  `bf-out-ls-26` (`BF_PAINEL_URL` troca; `off` desliga). É a aba **Black Friday — lista VIP** do
  `/painel` de lá: inscritos, UTMs por origem, mídia, campanha, conteúdo, termo e dia, a lista com o
  WhatsApp e o CSV. A mesma pessoa enviando de novo soma envio, não vira inscrita nova. São até 6
  tentativas (na hora, 3 s, 10 s, 30 s, 1 min e 2 min) para `429` e `5xx`: o paginas aceita 240
  inscrições por minuto vindas deste servidor, e as esperas espalham um pico. Recusa (`422`, por
  exemplo um e-mail cujo domínio não existe) não se repete e sai no log como `BF_PAINEL_RECUSOU`; o
  que não chegar sai como `BF_PAINEL_NAO_ENVIADO`. A página `bf-out-ls-26` está no
  `js/checkout-config.js` do paginas (`checkout: null`, captação gratuita) e na cópia dele em
  `public/igps_set_lp_26-ingresso/js/`: mudou lá, copie para cá.
- **Depois da inscrição**: a página vai para `/BF_out_LS_26-obrigada#inscrito` (atributo
  `data-obrigado` do formulário). O link do grupo fica no botão `#grupo` da obrigada, que também
  redireciona sozinha em 15 s. Trocou o grupo? Mude lá e no `data-grupo` (abaixo).
- **Plano B**: com `data-obrigado` vazio, a confirmação aparece na própria página, com o botão do
  `data-grupo`.
- **Pixel**: `PageView` nas duas páginas; `Lead` com `content_name: 'BF_out_LS_26'` em toda abertura
  da obrigada (base da conversão personalizada; o `content_name` separa dos leads do GPS, que usam o
  mesmo Pixel). Recarregar a obrigada conta outro lead.
- **Anti-robô**: campo escondido `site` (preenchido = descartado em silêncio) e no máximo 8 envios
  por IP a cada 10 minutos.
- **Três versões no ar**: a A original (`-a` → `obrigada`), a B do modelo "vitalício" (`-b` →
  `obrigada-b`) e a do Open Design (`-a-b` → `obrigada-a-b`). Todas mandam para a mesma API, planilha,
  n8n e aba do painel; a versão de cada lead está no `page_url` (e, no n8n, em `pagina.variante`). As
  três obrigadas disparam o mesmo `Lead` (`content_name: 'BF_out_LS_26'`), então a conversão
  personalizada conta as três.
- **Visual da versão `-a-b` (identidade Black Friday)**: as duas páginas `-a-b` seguem o layout `black-friday-vitalicio.html`
  do projeto do Open Design (preto editorial, berinjela como luz, amarelo `#FFE000` só no destaque e
  no botão; Archivo + Instrument Sans). A inscrição é o layout inteiro (CSS e marcação), com o
  formulário de sempre dentro dele: mesmos ids, régua, máscara, mensagens, campo `site` e envio. O
  que o layout não desenhou (erro de campo, sugestão de e-mail, "Enviando...", plano B) usa as mesmas
  peças. A obrigada usa as mesmas peças (faixa, logo, painel, botão, contagem) com o texto e os
  scripts de antes. Os arquivos do layout estão em `public/bf_out_ls_26-inscricao/img/`: a Izabel
  recortada em AVIF/WebP (480, 600 e 750 px; a 750 em PNG de reserva, sem perda), o logo e o
  símbolo da Escola reduzidos a 3x do tamanho na tela (o logo original tinha 3875 px para aparecer
  com 28) e os outros símbolos como vieram. Comparada com o layout no mesmo navegador, a página
  difere em 0,03% a 0,06% dos pixels (de 390 a 1440 px de largura), só nas bordas dessas imagens
  reduzidas. As fontes são as do Google, byte a byte, em `public/fonts/archivo-*` e
  `instrument-sans-*` (ver "Velocidade das páginas").

## Pré-formulário da página de venda

Os dois botões de compra (`a[data-checkout]`) não vão direto para a Hotmart: abrem um modal
("Falta pouco, preciosa! 💚") que pede **nome completo**, **WhatsApp com DDD** (máscara
`(11) 91234-5678`) e **e-mail** (só `.com` ou `.com.br`, como no site da Escola). Ao enviar, a
pessoa segue para o checkout da Hotmart já preenchido, com todas as UTMs.

A máscara do WhatsApp preserva o cursor: quem volta para corrigir um dígito no meio do número digita
no lugar certo. Antes, o cursor pulava para o fim, e o número ficava errado mas válido.

Arquivos, em `public/igps_set_lp_26-ingresso/js/`:

- `pre-formulario.js`: o modal e o envio. É o `js/inscricao.js` do repo **paginas** (a página
  `/viver-de-furo-inscricao`, com o mesmo fluxo) adaptado para modal e para outro site.
- `lead-rules.js` e `checkout-config.js`: **CÓPIAS** de `paginas/js/`. Não edite aqui (ver abaixo).

### Para onde vão os dados

O formulário manda um POST para o endereço do seu `data-api`:
`https://lp.escolaenfermagemdevalor.com.br/api/inscricao` (o servidor do repo **paginas**). Lá o
contato passa pela mesma régua da tela, o link do checkout é montado e a linha é gravada em
`inscricoes` com `pagina = 'imersao-gps'`, o contato, as UTMs do primeiro toque, `fbclid`/`gclid`,
dispositivo e o link exato que foi aberto. O painel do paginas (`/painel`) mostra os inscritos e,
pelo webhook da Hotmart (`POST /api/hotmart/venda`, também no paginas), as vendas de cada ingresso
e de onde elas vieram (UTMs e `sck`).

- **CORS**: a página mora em outro site, então o envio é cross-origin, sem cookie, com o JSON em
  `text/plain` (sem preflight: uma ida a menos antes do checkout). O paginas só aceita isso de
  origens liberadas: `https://io.escolaenfermagemdevalor.com.br` já está no `checkout-config.js` de
  lá (página `imersao-gps`, campo `origem`). Para um domínio de teste/preview, acrescente-o na
  variável `INSCRICAO_ORIGENS` do paginas (separada por vírgulas).
- **Só o checkout da Hotmart**: o link que o paginas devolve só é aberto se começar pelo checkout do
  produto do config (`https://pay.hotmart.com/R107667362D`). Qualquer outro endereço (API trocada,
  deploy errado) vale como falha e cai no plano B abaixo. A página nunca leva o contato da pessoa
  para outro lugar.
- **Nada trava a venda**: se o paginas demorar mais de 3,5 s, cair, recusar o CORS, responder erro
  ou devolver um link que não seja esse checkout, a página monta o mesmo link sozinha (com UTMs,
  `sck` e contato), manda o lead de novo por `sendBeacon` e segue para o checkout. O que segura a
  pessoa é o contato inválido: o erro da tela ou o 422 do paginas, mostrado no campo.
- **"Ir direto para o pagamento"**: depois de **2 envios recusados** (pela tela ou pelo 422), aparece
  abaixo do botão o link `#pf-direto`. Ele leva ao link do botão tocado, já com as UTMs e o `sck`
  (sem o contato). Por esse caminho o lead não é gravado. Assim, quem tem um contato fora da régua
  (celular de fora do Brasil, e-mail `.pt`, `.org.br` ou de universidade) ainda consegue comprar.
- **Sem JavaScript, ou em navegador sem `<dialog>`**: o formulário fica escondido
  (`.pf:not([open]){display:none}`) e o botão vai direto para a Hotmart. Sem `<dialog>`, o link já
  vai com as UTMs, e o `pre-formulario.js` bloqueia o envio nativo do formulário, que faria um GET
  com nome, WhatsApp e e-mail na URL. Sem JavaScript nenhum, vai sem as UTMs, porque quem as põe nos
  links é script.
- **Pixel** (538380380948773):
  - `abriu_pre_formulario` (custom): na primeira vez que o modal abre.
  - `Lead`: **depois** da resposta do paginas. Não dispara no 422, porque contato recusado não é
    lead. Dispara também quando o paginas falha, porque o contato passou pela mesma régua na tela.
    Sai uma vez só e não se repete para o mesmo contato já guardado neste aparelho (quem volta do
    checkout e envia de novo).
  - `InitiateCheckout` (valor do `data-valor` do botão, em BRL): na saída para o checkout.
  - No envio pelo formulário, o `Lead` e o `InitiateCheckout` levam `eventID` = o id do pedido (o
    mesmo `id` que vai no POST), e a Meta usa esse id para não contar o evento duas vezes.
  - O clique no botão só abre o modal e não dispara `InitiateCheckout`. O link "Ir direto para o
    pagamento" e o botão sem modal disparam, sem `eventID`.
- **localStorage** (tudo opcional, em try/catch):
  - `ev_gps_rastreio_v1`: a campanha do primeiro toque.
  - `ev_gps_inscricao_v1`: o contato enviado e a hora do envio. Ele só volta preenchido no modal nas
    **24 h** seguintes, porque um computador de posto de enfermagem é usado por muita gente.
  - `ev_pesquisa_visitante`: o id do aparelho.

### UTMs e sck até a Hotmart

**Todo** link para `pay.hotmart.com` ganha as UTMs (`utm_source`, `utm_medium`, `utm_campaign`,
`utm_term`, `utm_content`) e o `sck`. Nesta página, o `sck` é o **`utm_content`** (o criativo do
anúncio). O href original fica em `data-checkout-base`. Assim, mesmo que o modal falhe, quem toca no
botão chega ao checkout com a campanha.

A campanha é um **bloco**: a primeira visita com qualquer UTM fica guardada inteira neste
aparelho. Quem volta depois pela bio continua creditada ao anúncio, sem misturar campo a campo.

Isso acontece em dois tempos:

1. Um script inline, síncrono, no fim do `body` do `index.html`, roda enquanto a página é lida,
   antes de qualquer arquivo `.js`. Ele põe nos links as UTMs **da URL**, mais `sck` = `utm_content`,
   e guarda o href original em `data-checkout-base`. Com rede ruim, quem toca antes de os arquivos
   chegarem também leva a campanha.
2. Depois, o `pre-formulario.js` refaz os links a partir de `data-checkout-base`, com o **primeiro
   toque** guardado.

### Por que não tem o widget.min.js da Hotmart

O site da Escola carrega o "script da Hotmart", `widget.min.js` com `hotmart-fb.min.css`. Esta página
**não** carrega nenhum dos dois, e não precisa de guarda (`MutationObserver`) para protegê-los, pelos
motivos abaixo:

- O widget **não repassa UTM nenhuma**. O repasse das UTMs e do `sck`, que era o que se esperava
  dele, é feito pelos nossos scripts (acima).
- Ele carrega jQuery 3.2.1 e fancybox só para abrir numa janela os links com a classe `hotmart-fb`.
  Esta página não tem nenhum link assim, e no celular ele nem abre a janela.
- Se a verificação dele em `api-checkout-vue.hotmart.com` falhar (bloqueador de anúncio, rede
  ruim), ele **apaga da página todo link para hotmart.com**, inclusive os botões de compra.
- O custo foi medido no Chromium com a CPU 6x mais lenta (um Android simples): de 90 a 420 ms a mais
  de tarefas longas e cerca de 53 KB gzip de jQuery e fancybox.
- É um jQuery com falhas conhecidas (CVE-2019-11358, CVE-2020-11022, CVE-2020-11023), rodando numa
  página que coleta nome, WhatsApp e e-mail.

### Como trocar de lote

1. Troque o link dos três links de compra: os dois botões `data-checkout` e o "Ir direto para o
   pagamento" (`#pf-direto-link`). Use o link da oferta nova (o mesmo produto `R107667362D`, outro
   `off=`) e troque também o `data-valor` dos botões (o valor do `InitiateCheckout`).
2. Atualize o que a página mostra (preço, "Lote 01", a lista de lotes).

Para quem passa pelo formulário, só isso já basta. O link do botão tocado vai no envio, e o paginas
aceita a oferta dele porque é do mesmo produto do config. Ele grava o link com a oferta nova e, quando
a Hotmart avisar a venda, reconhece a oferta pelo link que a **própria compradora** abriu (mesmo
e-mail ou mesmos 8 últimos dígitos do telefone). O link de **outra** pessoa não vale: qualquer um pode
chamar o `/api/inscricao`, e uma inscrição inventada não pode mudar a página de uma venda.

Quem compra o lote novo **sem** ter aberto o link da página (link repassado, afiliado, outro e-mail e
outro telefone) é reconhecido pelo id numérico do produto. Depois da 1ª venda, esse id vai em
`hotmart.produtos` da página `imersao-gps`, no `checkout-config.js` do paginas, e o arquivo é copiado
para cá (`DEPLOY.md` do paginas, seção 5.3). Para reconhecer pela própria oferta, acrescente o código
novo em `hotmart.ofertas` e copie o arquivo para cá.

Produto **diferente** (outro código depois de `pay.hotmart.com/`) é outra história: o paginas
ignora link de outro produto e manda para o `checkout` do config dele. Nesse caso mude primeiro o
`checkout` da página `imersao-gps` no `checkout-config.js` do paginas, publique, e copie o arquivo.
Até copiar, a página recusa o link que a API devolve (não é o caminho do config daqui) e usa o plano B.

### As cópias do paginas

`js/lead-rules.js` (nome, WhatsApp e e-mail) e `js/checkout-config.js` (link do checkout, sck,
régua do e-mail) são os mesmos arquivos que o servidor do paginas usa para validar e gravar: é o
que garante que a tela e a gravação nunca discordam. A Ficha dos Presentes da Formação usa as
mesmas cópias (entrada `formacao-ev`). A fonte é o repo paginas. Mudou lá? Copie para cá mantendo
as 3 linhas de comentário do topo (com os dois repos lado a lado):

```sh
for f in lead-rules checkout-config; do
  destino=public/igps_set_lp_26-ingresso/js/$f.js
  { head -n 3 "$destino"; cat ../paginas/js/$f.js; } > "$destino.novo" && mv "$destino.novo" "$destino"
done
```

### Testar localmente

1. No paginas: `node tests/e2e/stack.mjs up` (banco local descartável; imprime `SUPABASE_URL` e
   `SUPABASE_SERVICE_ROLE_KEY`) e, em outro terminal, o `server.mjs` com essas duas variáveis,
   `PORT=8080` e `INSCRICAO_ORIGENS=http://localhost:3000`.
2. Aqui: `npm start` e, só na sua cópia local, troque o `data-api` do formulário para o endereço do
   paginas local (`http://localhost:8080/api/inscricao`). Não publique essa troca.
3. Abra `http://localhost:3000/igps_set_lp_26-ingresso?utm_source=teste&utm_content=criativo-1`,
   toque num botão e confira a linha em `inscricoes` e o link final (com `sck=criativo-1`).

## Ficha dos Presentes da Formação

Os 11 botões de `/igps-lp-formacao` (`a[data-cta]`) abrem um pop-up com **nome completo**,
**WhatsApp com DDD** (máscara `(11) 91234-5678`) e **e-mail** (só `.com` ou `.com.br`). É o mesmo
pré-formulário da venda do GPS, nas cores desta página. O script é
`public/igps-lp-formacao/js/pre-formulario.js`, uma cópia adaptada do da venda do GPS (aquele está
vendendo e não é mexido). As regras vêm das mesmas cópias do paginas em
`public/igps_set_lp_26-ingresso/js/` (entrada `formacao-ev` do `checkout-config.js`).

- **Para onde vai**: POST no `/api/inscricao` do paginas com `pagina: "formacao-ev"`. A ficha cai na
  aba **"Formação EV 2.0 — antecipação"** do `/painel`, com as UTMs, `fbclid`/`gclid`, `page_url`,
  dispositivo e o id do aparelho. Não há webhook do n8n para ela (o paginas só tem o do GPS).
- **Por enquanto só capta**: a `formacao-ev` está com `checkout: null` no config do paginas. A
  resposta vem com `checkout: null` e o pop-up mostra **"Ficha recebida!"** com o WhatsApp enviado e
  um "Corrigir". A pessoa continua na página.
- **UTMs só da URL aberta**: diferente da venda do GPS, nenhuma campanha fica guardada no aparelho.
  Quem volta sem UTM envia sem UTM.
- **Nada trava**: com 3,5 s sem resposta, erro 5xx ou rede caída, a ficha vai de novo por
  `sendBeacon` e o pop-up mostra "Ficha recebida". Só o 422 de contato inválido segura a pessoa
  (erro no campo).
- **Toque antes do `.js` chegar** (rede lenta): o script inline do fim da página segura o toque (o
  `href="#"` levaria ao topo) e o pop-up abre quando o arquivo carrega.
- **localStorage**: `ev_formacao_inscricao_v1` (o contato, que volta preenchido por 24 h) e
  `ev_pesquisa_visitante` (o id do aparelho, o mesmo da venda do GPS).
- **Pixel**: a página não tem. Se um dia entrar, o script já dispara `Lead` (e `InitiateCheckout`,
  com checkout) como na venda do GPS.

### Quando o link do checkout chegar

1. No paginas: o link (com o `off=`) vai em `checkout` da `formacao-ev`, e a oferta em
   `hotmart.ofertas`. Se o botão do boleto (12x de R$ 89,25) for outra oferta do mesmo produto, ela
   também entra em `hotmart.ofertas`. Publique.
2. Aqui: copie o `checkout-config.js` de novo (ver "As cópias do paginas"). Com isso o mesmo envio
   passa a seguir para o checkout da Hotmart já preenchido, com as UTMs e `sck` = `utm_content`, sem
   mexer no script.
3. No HTML:
   - Ponha o link nos `href` dos botões; o do boleto leva a oferta dele. É o caminho de quem não
     tem o pop-up e o que manda a oferta do botão tocado.
   - Troque o texto do botão do pop-up para "Continuar para o pagamento".
   - Se quiser, acrescente a linha do cadeado e o "Ir direto para o pagamento" (`#pf-direto`), como
     na venda do GPS.
