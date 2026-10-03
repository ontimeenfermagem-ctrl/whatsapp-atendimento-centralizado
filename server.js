const express = require('express');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const hotmartWebhook = require('./hotmart-webhook');
const bfLeads = require('./bf-leads');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway fica atras de um proxy: necessario para IP/HTTPS corretos
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(compression());

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // A pagina de venda agora tem formulario com nome, WhatsApp e e-mail: nada de moldura em outro
  // site (clickjacking do botao de pagamento) e HTTPS sempre, mesmo quem digitar http://.
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Postback de venda da Hotmart -> API de Conversoes do Meta.
hotmartWebhook.registrar(app, express);

// Inscricoes da lista VIP da Black Friday -> planilha BF_out_LS_26 (Apps Script).
bfLeads.registrar(app, express);

// As paginas sao servidas pelo index.html da pasta, sempre revalidado (no-cache,
// como o express.static faz com HTML/JS/CSS la embaixo): sem isto o sendFile manda
// "public, max-age=0", que alguns navegadores ainda reaproveitam no voltar/offline.
function enviarPagina(pasta) {
  const arquivo = path.join(__dirname, 'public', pasta, 'index.html');
  return (req, res) => res.sendFile(arquivo, { headers: { 'Cache-Control': 'no-cache' } });
}

// Pagina de vendas: serve o arquivo direto, sem redirecionar, para o link do
// anuncio funcionar com ou sem a barra final. Os arquivos dela usam caminho
// absoluto, entao carregam nos dois casos.
const LP = '/igps_set_lp_26-ingresso';
app.get(LP, enviarPagina('igps_set_lp_26-ingresso'));

// Versao B, rodando o lote 2 (R$ 9,90) ao mesmo tempo que a A. Ela usa as imagens e os .js
// da pasta da A, entao existe um arquivo so de cada coisa: o que muda de uma para a outra
// e apenas preco, rotulo do lote e a oferta do checkout.
const LP_B = '/igps_set_lp_26-ingresso-b';
app.get(LP_B, enviarPagina('igps_set_lp_26-ingresso-b'));

// Versao C: R$ 3,00 com desconto que expira 24 h depois da primeira visita. Tambem usa as
// imagens e os .js da pasta da A.
const LP_C = '/igps_set_lp_26-ingresso-c';
app.get(LP_C, enviarPagina('igps_set_lp_26-ingresso-c'));

// Pagina de obrigado: mesma ideia, serve direto com ou sem a barra final.
const TY = '/igps_set_lp_26-obrigado';
app.get(TY, enviarPagina('igps_set_lp_26-obrigado'));

// Captacao gratuita da Black Friday (lista VIP do vitalicio), oferta abre em 26/10 as 20h.
// O Express compara rota sem diferenciar maiuscula de minuscula: abre tambem como
// /bf_out_ls_26-inscricao-a. A pasta continua bf_out_ls_26-inscricao e as imagens ficam em
// /bf_out_ls_26-inscricao/img/ e sao pedidas por caminho absoluto.
const BF = '/BF_out_LS_26-inscricao-a';
app.get(BF, enviarPagina('bf_out_ls_26-inscricao'));

// Versao B da captacao (layout do modelo "vitalicio", coluna unica), no ar junto com a A para o
// teste A/B. Mesmo formulario, mesma API e mesma obrigada; as capas e a Izabel vem da pasta da A.
const BF_B = '/BF_out_LS_26-inscricao-b';
app.get(BF_B, enviarPagina('bf_out_ls_26-inscricao-b'));

// Obrigada da lista VIP: botao e redirecionamento para o grupo do WhatsApp e contagem ate 26/10 20h.
const BF_TY = '/BF_out_LS_26-obrigada';
app.get(BF_TY, enviarPagina('bf_out_ls_26-obrigada'));

// Obrigada da versao B: para onde a captacao B manda. Mesmo grupo, Pixel e contagem da obrigada A.
const BF_TY_B = '/BF_out_LS_26-obrigada-b';
app.get(BF_TY_B, enviarPagina('bf_out_ls_26-obrigada-b'));

// Pagina de pagamento pendente (Pix aguardando confirmacao).
const WAIT = '/igps_set_lp_26-aguardando-pagamento';
app.get(WAIT, enviarPagina('igps_set_lp_26-aguardando-pagamento'));

// Calculadora de medicacao. O endereco divulgado tem acento (/calculo-de-medicação-calculadora) e o
// navegador manda os acentos codificados (%C3%A7%C3%A3o), entao a comparacao e feita com o caminho
// decodificado e sem acentos: abre com ou sem acento, com ou sem a barra final. Os arquivos dela
// ficam numa pasta sem acento e sao pedidos por caminho absoluto.
const CALC = '/calculo-de-medicacao-calculadora';
const enviarCalc = enviarPagina('calculo-de-medicacao-calculadora');
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  let caminho;
  try {
    caminho = decodeURIComponent(req.path);
  } catch {
    return next();
  }
  caminho = caminho.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\/+$/, '');
  if (caminho === CALC) return enviarCalc(req, res);
  next();
});

// Enderecos antigos continuam levando para as paginas novas, com a query junto: um anuncio ou QR
// antigo com UTM (/gps?utm_content=...) nao pode chegar na pagina sem campanha.
function comQuery(req, destino) {
  const i = req.originalUrl.indexOf('?');
  return i === -1 ? destino : destino + req.originalUrl.slice(i);
}
app.get('/gps', (req, res) => res.redirect(301, comQuery(req, LP)));
app.get('/obrigado', (req, res) => res.redirect(301, comQuery(req, TY)));

// Lista das provas (prints de alunas) que existem em public/igps_set_lp_26-ingresso/provas/:
// 1.jpg ... 20.jpg, em ordem. As tres versoes da pagina de venda pedem esta lista so quando a secao
// chega perto da tela, em vez de tentar as 20 imagens uma a uma.
const PROVAS = path.join(__dirname, 'public', 'igps_set_lp_26-ingresso', 'provas');
app.get('/igps_set_lp_26-ingresso/provas.json', (req, res) => {
  fs.readdir(PROVAS, (erro, arquivos) => {
    const lista = (erro ? [] : arquivos)
      .map((nome) => /^([1-9]|1[0-9]|20)\.jpg$/.exec(nome))
      .filter(Boolean)
      .map((m) => Number(m[1]))
      .sort((a, b) => a - b)
      .map((n) => `/igps_set_lp_26-ingresso/provas/${n}.jpg`);
    res.setHeader('Cache-Control', 'no-cache');
    res.json(lista);
  });
});

app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    setHeaders(res, filePath) {
      // O mime do Express nao conhece AVIF e mandaria application/octet-stream (com o nosniff
      // acima, ha navegador que recusa a imagem).
      if (/\.avif$/i.test(filePath)) res.setHeader('Content-Type', 'image/avif');
      if (/[\\/]fonts[\\/][^\\/]+-v\d+\.woff2$/i.test(filePath)) {
        // Fontes com versao no nome (-v1): o arquivo nunca muda, fonte nova ganha nome novo.
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return;
      }
      if (/\.(html|js|css)$/i.test(filePath)) {
        // HTML, JS e CSS sempre revalidados (o ETag evita baixar de novo o que nao mudou):
        // com campanha no ar, correcao de copy, do pre-formulario ou de link de checkout
        // entra na hora, sem ninguem ficar preso a um script velho no cache.
        res.setHeader('Cache-Control', 'no-cache');
      } else if (/\.(jpg|jpeg|png|webp|avif|svg|ico|woff2?)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=2592000');
      }
    },
  })
);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Encerramento limpo quando o Railway faz redeploy
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
