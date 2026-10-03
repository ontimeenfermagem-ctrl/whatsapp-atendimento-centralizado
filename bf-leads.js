// Recebe as inscricoes da lista VIP da Black Friday (/BF_out_LS_26-inscricao-a) e grava
// na planilha BF_out_LS_26, pelo Apps Script em apps-script/bf_out_ls_26.gs.
//
// Variaveis de ambiente (Railway):
//   BF_SHEETS_URL   - a URL /exec da implantacao do Apps Script
//   BF_SHEETS_TOKEN - o token que a funcao "configurar" do script mostra
//   BF_WEBHOOK_URL  - opcional: webhook do n8n que recebe cada inscricao. Vazio = o padrao abaixo
//                     (black-outubro-26); "off" desliga.
//   BF_PAINEL_URL   - opcional: o POST /api/inscricao do repo paginas, que grava a inscricao para a
//                     aba "Black Friday — lista VIP" do /painel. Vazio = o padrao abaixo; "off" desliga.
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

const WEBHOOK_PADRAO = 'https://n8n.tecnicadevalor.com.br/webhook/black-outubro-26';
const WEBHOOK_ENV = String(process.env.BF_WEBHOOK_URL || '').trim();
const WEBHOOK_URL = WEBHOOK_ENV.toLowerCase() === 'off' ? '' : WEBHOOK_ENV || WEBHOOK_PADRAO;
// Tres tentativas: na hora, 3 s e 10 s depois. Um n8n reiniciando nao faz o lead sumir; o que
// ainda assim nao chegar sai no log com a etiqueta BF_N8N_NAO_ENVIADO.
const ESPERAS_N8N_MS = [0, 3000, 10000];

// O painel do repo paginas (lp.escolaenfermagemdevalor.com.br/painel) recebe a inscricao pela
// mesma API do pre-formulario do GPS, com a pagina "bf-out-ls-26" do js/checkout-config.js de la
// (captacao gratuita: grava sem checkout). Quem manda e ESTE servidor, e nao o navegador: nada muda
// na pagina, e bloqueador de anuncio nao derruba o envio.
const PAINEL_PADRAO = 'https://lp.escolaenfermagemdevalor.com.br/api/inscricao';
const PAINEL_ENV = String(process.env.BF_PAINEL_URL || '').trim();
const PAINEL_URL = PAINEL_ENV.toLowerCase() === 'off' ? '' : PAINEL_ENV || PAINEL_PADRAO;
const PAGINA_PAINEL = 'bf-out-ls-26';
// O paginas aceita 240 inscricoes por minuto por IP, e todas saem daqui (um IP so). Num pico, quem
// passar recebe 429 e tenta de novo mais tarde: as esperas vao ate ~4 min, o que espalha o pico.
// Recusa de contato (422) nao se repete. O que nao chegar sai no log com BF_PAINEL_NAO_ENVIADO.
const ESPERAS_PAINEL_MS = [0, 3000, 10000, 30000, 60000, 120000];

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

// Qual versao da captacao mandou o lead (teste A/B): sai do caminho do page_url que a pagina envia.
// Qualquer coisa que nao seja a B conta como A, a pagina original.
function variante(pageUrl) {
  let caminho = '';
  try {
    caminho = new URL(pageUrl).pathname;
  } catch {
    return 'a';
  }
  return /^\/bf_out_ls_26-inscricao-b\/?$/i.test(caminho) ? 'b' : 'a';
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

function payloadN8n(lead) {
  const digitos = L.normalizePhoneDigits(lead.whatsapp);
  return {
    evento: 'inscricao_bf_out_ls_26',
    pagina: { id: 'bf_out_ls_26', variante: variante(lead.page_url), rota: `/BF_out_LS_26-inscricao-${variante(lead.page_url)}` },
    inscrito_em: new Date().toISOString(),
    lead: {
      nome: lead.nome,
      primeiro_nome: lead.nome.split(' ')[0] || '',
      email: lead.email,
      whatsapp: lead.whatsapp,
      whatsapp_digits: digitos,
      whatsapp_internacional: digitos ? `55${digitos}` : '',
    },
    utm: {
      utm_source: lead.utm_source || null,
      utm_medium: lead.utm_medium || null,
      utm_campaign: lead.utm_campaign || null,
      utm_content: lead.utm_content || null,
      utm_term: lead.utm_term || null,
    },
    rastreio: { dispositivo: lead.dispositivo || null, page_url: lead.page_url || null },
  };
}

// Sem await de quem chama: o n8n nunca atrasa a ida da pessoa para a pagina de obrigada.
async function avisarN8n(lead) {
  if (!WEBHOOK_URL) return;
  const corpo = JSON.stringify(payloadN8n(lead));
  for (let i = 0; i < ESPERAS_N8N_MS.length; i += 1) {
    if (ESPERAS_N8N_MS[i]) await new Promise((ok) => setTimeout(ok, ESPERAS_N8N_MS[i]).unref());
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
    try {
      const resp = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: corpo,
        signal: controle.signal,
      });
      if (resp.ok) return;
      console.error(`[bf-leads] n8n respondeu ${resp.status} (tentativa ${i + 1} de ${ESPERAS_N8N_MS.length})`);
    } catch (erro) {
      console.error(`[bf-leads] falha ao avisar o n8n (tentativa ${i + 1} de ${ESPERAS_N8N_MS.length}): ${erro && erro.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  console.error('BF_N8N_NAO_ENVIADO', corpo);
}

function payloadPainel(lead) {
  return {
    pagina: PAGINA_PAINEL,
    contato: { nome: lead.nome, whatsapp: lead.whatsapp, email: lead.email },
    rastreio: {
      utm_source: lead.utm_source || null,
      utm_medium: lead.utm_medium || null,
      utm_campaign: lead.utm_campaign || null,
      utm_content: lead.utm_content || null,
      utm_term: lead.utm_term || null,
      dispositivo: lead.dispositivo || null,
      page_url: lead.page_url || null,
    },
  };
}

// Sem await de quem chama, como o n8n: o painel nunca atrasa a ida para a pagina de obrigada.
async function avisarPainel(lead) {
  if (!PAINEL_URL) return;
  const corpo = JSON.stringify(payloadPainel(lead));
  for (let i = 0; i < ESPERAS_PAINEL_MS.length; i += 1) {
    if (ESPERAS_PAINEL_MS[i]) await new Promise((ok) => setTimeout(ok, ESPERAS_PAINEL_MS[i]).unref());
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
    try {
      const resp = await fetch(PAINEL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: corpo,
        signal: controle.signal,
      });
      if (resp.ok) return;
      const resposta = (await resp.text().catch(() => '')).slice(0, 300);
      // 429 (pico) e 5xx (deploy, banco fora) passam; o resto e recusa e nao muda tentando de novo.
      if (resp.status !== 429 && resp.status < 500) {
        console.error('BF_PAINEL_RECUSOU', resp.status, resposta, corpo);
        return;
      }
      console.error(`[bf-leads] painel respondeu ${resp.status} (tentativa ${i + 1} de ${ESPERAS_PAINEL_MS.length})`);
    } catch (erro) {
      console.error(`[bf-leads] falha ao gravar no painel (tentativa ${i + 1} de ${ESPERAS_PAINEL_MS.length}): ${erro && erro.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  console.error('BF_PAINEL_NAO_ENVIADO', corpo);
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

    // O n8n e o painel recebem em paralelo com a planilha; a resposta para a pagina nao espera por eles.
    avisarN8n(lead).catch((erro) => console.error('[bf-leads] erro inesperado no aviso ao n8n:', erro && erro.message));
    avisarPainel(lead).catch((erro) => console.error('[bf-leads] erro inesperado na gravacao do painel:', erro && erro.message));

    try {
      await gravarNaPlanilha(lead);
    } catch (erro) {
      console.error('BF_LEAD_NAO_GRAVADO', JSON.stringify(lead), String(erro && erro.message));
    }
    res.json({ ok: true });
  });
}

module.exports = { registrar, payloadN8n, payloadPainel };
