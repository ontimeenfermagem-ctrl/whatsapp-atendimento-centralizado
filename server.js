const express = require('express');
const compression = require('compression');
const path = require('path');

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

// Pagina de obrigado: mesma ideia, serve direto com ou sem a barra final.
const TY = '/igps_set_lp_26-obrigado';
app.get(TY, enviarPagina('igps_set_lp_26-obrigado'));

// Pagina de pagamento pendente (Pix aguardando confirmacao).
const WAIT = '/igps_set_lp_26-aguardando-pagamento';
app.get(WAIT, enviarPagina('igps_set_lp_26-aguardando-pagamento'));

// Enderecos antigos continuam levando para as paginas novas, com a query junto: um anuncio ou QR
// antigo com UTM (/gps?utm_content=...) nao pode chegar na pagina sem campanha.
function comQuery(req, destino) {
  const i = req.originalUrl.indexOf('?');
  return i === -1 ? destino : destino + req.originalUrl.slice(i);
}
app.get('/gps', (req, res) => res.redirect(301, comQuery(req, LP)));
app.get('/obrigado', (req, res) => res.redirect(301, comQuery(req, TY)));

app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    setHeaders(res, filePath) {
      if (/\.(html|js|css)$/i.test(filePath)) {
        // HTML, JS e CSS sempre revalidados (o ETag evita baixar de novo o que nao mudou):
        // com campanha no ar, correcao de copy, do pre-formulario ou de link de checkout
        // entra na hora, sem ninguem ficar preso a um script velho no cache.
        res.setHeader('Cache-Control', 'no-cache');
      } else if (/\.(jpg|jpeg|png|webp|svg|ico|woff2?)$/i.test(filePath)) {
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
