// Recebe as inscricoes da lista VIP da Black Friday (/BF_out_LS_26-inscricao-a) e grava
// na planilha BF_out_LS_26, pelo Apps Script em apps-script/bf_out_ls_26.gs.
//
// Variaveis de ambiente (Railway):
//   BF_SHEETS_URL   - a URL /exec da implantacao do Apps Script
//   BF_SHEETS_TOKEN - o token que a funcao "configurar" do script mostra
//
// A validacao e a mesma da tela (lead-rules.js, o arquivo que a pagina tambem carrega).
// Se a planilha falhar ou nao estiver configurada, a pessoa segue normalmente para o
// grupo e o lead sai inteiro no log com a etiqueta BF_LEAD_NAO_GRAVADO, para ser
// recuperado depois: a inscricao nunca trava por causa da planilha.

require('./public/igps_set_lp_26-ingresso/js/lead-rules.js');
const L = globalThis.EVLeadRules;

const SHEETS_URL = process.env.BF_SHEETS_URL || '';
const SHEETS_TOKEN = process.env.BF_SHEETS_TOKEN || '';
const TIMEOUT_MS = 10000;

const RASTREIO = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'dispositivo', 'page_url'];

// Freio simples contra robo: no maximo 8 envios por IP a cada 10 minutos.
const JANELA_MS = 10 * 60 * 1000;
const MAX_POR_JANELA = 8;
const envios = new Map();

function excedeuLimite(ip) {
  const agora = Date.now();
  const recentes = (envios.get(ip) || []).filter((t) => agora - t < JANELA_MS);
  recentes.push(agora);
  envios.set(ip, recentes);
  if (envios.size > 5000) {
    for (const [chave, lista] of envios) {
      if (!lista.some((t) => agora - t < JANELA_MS)) envios.delete(chave);
    }
  }
  return recentes.length > MAX_POR_JANELA;
}

function texto(valor, max) {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : '';
}

async function gravarNaPlanilha(lead) {
  if (!SHEETS_URL || !SHEETS_TOKEN) throw new Error('BF_SHEETS_URL/BF_SHEETS_TOKEN nao configurados');
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    // O Apps Script responde 302 para googleusercontent.com; o fetch segue sozinho.
    const resp = await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lead, token: SHEETS_TOKEN }),
      redirect: 'follow',
      signal: controle.signal,
    });
    const corpo = await resp.json().catch(() => null);
    if (!resp.ok || !corpo || corpo.ok !== true) {
      throw new Error(`planilha respondeu ${resp.status} ${JSON.stringify(corpo)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

function registrar(app, express) {
  if (!SHEETS_URL || !SHEETS_TOKEN) {
    console.warn('[bf-leads] BF_SHEETS_URL/BF_SHEETS_TOKEN ausentes: inscricoes da Black Friday vao so para o log');
  }

  app.post('/api/bf_out_ls_26/lead', express.json({ limit: '8kb' }), async (req, res) => {
    const b = req.body && typeof req.body === 'object' ? req.body : {};

    // Campo escondido da pagina: gente nao ve, robo preenche. Responde ok e nao grava.
    if (texto(b.site, 200)) return res.json({ ok: true });
    if (excedeuLimite(req.ip)) return res.status(429).json({ ok: false, erro: 'Muitas tentativas. Espere alguns minutos.' });

    const erros = {};
    const codNome = L.nameError(b.nome);
    const codWhats = L.phoneError(b.whatsapp);
    const codEmail = L.emailError(b.email);
    if (codNome) erros.nome = L.message('name', codNome);
    if (codWhats) erros.whatsapp = L.message('phone', codWhats);
    if (codEmail) erros.email = L.message('email', codEmail);
    if (Object.keys(erros).length) return res.status(422).json({ ok: false, erros });

    const lead = {
      nome: L.formatName(b.nome),
      email: L.normalizeEmail(b.email),
      whatsapp: L.formatPhone(L.normalizePhoneDigits(b.whatsapp)),
    };
    for (const campo of RASTREIO) lead[campo] = texto(b[campo], campo === 'page_url' ? 2048 : 300);

    try {
      await gravarNaPlanilha(lead);
    } catch (erro) {
      console.error('BF_LEAD_NAO_GRAVADO', JSON.stringify(lead), String(erro && erro.message));
    }
    res.json({ ok: true });
  });
}

module.exports = { registrar };
