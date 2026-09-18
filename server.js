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
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/gps', (req, res) => res.redirect(301, '/gps/'));
app.get('/obrigado', (req, res) => res.redirect(301, '/obrigado/'));

app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    setHeaders(res, filePath) {
      if (/\.(html)$/i.test(filePath)) {
        // HTML sempre revalidado: mudancas de copy entram no ar na hora
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
