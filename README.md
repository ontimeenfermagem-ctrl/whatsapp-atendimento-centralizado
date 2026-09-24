# whatsapp-atendimento-centralizado
Sistema Centralizado de Atendimento WhatsApp com API Oficial e QR Code

Hoje este repo serve, no Railway, as páginas da Imersão GPS do Plantão Sem Medo em
https://io.escolaenfermagemdevalor.com.br (Express mínimo em `server.js`):

| Rota | Arquivo | O que é |
| --- | --- | --- |
| `/igps_set_lp_26-ingresso` | `public/igps_set_lp_26-ingresso/index.html` | página de venda (com o pré-formulário) |
| `/igps_set_lp_26-obrigado` | `public/igps_set_lp_26-obrigado/index.html` | obrigado (compra aprovada) |
| `/igps_set_lp_26-aguardando-pagamento` | `public/igps_set_lp_26-aguardando-pagamento/index.html` | Pix aguardando confirmação |
| `/gps`, `/obrigado` | — | endereços antigos: 301 para a página de venda e para o obrigado, **mantendo a query** |

HTML, JS e CSS saem com `Cache-Control: no-cache` (revalidam pelo ETag a cada visita): com a
campanha no ar, qualquer correção entra na hora. Imagens e fontes ficam 30 dias em cache.

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
que garante que a tela e a gravação nunca discordam. A fonte é o repo paginas. Mudou lá? Copie
para cá mantendo as 3 linhas de comentário do topo (com os dois repos lado a lado):

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
