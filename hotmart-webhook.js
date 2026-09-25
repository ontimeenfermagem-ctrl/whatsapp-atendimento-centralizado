// Recebe o postback de venda da Hotmart e manda o evento Purchase para a API
// de Conversoes do Meta.
//
// Variaveis de ambiente (cadastrar no Railway, em Variables):
//   HOTMART_HOTTOK  - o hottok que a Hotmart mostra na tela do webhook
//   META_CAPI_TOKEN - token de acesso gerado no Gerenciador de Eventos do Meta
//   META_PIXEL_ID   - opcional, ja vem com o pixel da Izabel
//
// Sem HOTMART_HOTTOK a rota recusa tudo, para ninguem de fora conseguir
// inventar vendas no pixel.

const crypto = require('crypto');

const PIXEL_ID = process.env.META_PIXEL_ID || '538380380948773';
const CAPI_TOKEN = process.env.META_CAPI_TOKEN || '';
const HOTTOK = process.env.HOTMART_HOTTOK || '';
const SOURCE_URL = 'https://io.escolaenfermagemdevalor.com.br/igps_set_lp_26-ingresso';

// A Hotmart reenvia o mesmo postback quando nao recebe resposta. Guardamos os
// codigos ja processados para a mesma venda nao contar duas vezes.
const jaEnviadas = new Set();
function novaVenda(codigo) {
  if (!codigo) return true;
  if (jaEnviadas.has(codigo)) return false;
  jaEnviadas.add(codigo);
  if (jaEnviadas.size > 5000) jaEnviadas.delete(jaEnviadas.values().next().value);
  return true;
}

// O Meta so aceita dado pessoal em hash.
function hash(valor) {
  if (!valor) return undefined;
  return crypto.createHash('sha256').update(String(valor).trim().toLowerCase()).digest('hex');
}

function hashTelefone(telefone, ddi) {
  if (!telefone) return undefined;
  const digitos = `${ddi || ''}${telefone}`.replace(/\D/g, '');
  return digitos ? crypto.createHash('sha256').update(digitos).digest('hex') : undefined;
}

function primeiro(...valores) {
  return valores.find((v) => v !== undefined && v !== null && v !== '');
}

// A Hotmart tem formatos diferentes por versao de webhook. Lemos os dois.
function lerVenda(corpo) {
  const d = corpo.data || corpo;
  const compra = d.purchase || {};
  const comprador = d.buyer || d.subscriber || {};
  const preco = compra.price || compra.full_price || {};

  return {
    evento: corpo.event || corpo.status || '',
    codigo: primeiro(compra.transaction, d.transaction, corpo.transaction),
    valor: Number(primeiro(preco.value, compra.price, 0)) || 0,
    moeda: primeiro(preco.currency_value, preco.currency_code, 'BRL'),
    email: comprador.email,
    telefone: primeiro(
      comprador.checkout_phone,
      comprador.phone,
      comprador.phone_number
    ),
    ddi: primeiro(comprador.checkout_phone_code, comprador.phone_local_code),
    nome: comprador.name,
  };
}

async function enviarAoMeta(venda) {
  const nome = (venda.nome || '').trim().split(/\s+/);

  const evento = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    // O mesmo codigo da transacao vira o id do evento: se a venda chegar por
    // dois caminhos com este id, o Meta junta em vez de somar.
    event_id: venda.codigo,
    action_source: 'website',
    event_source_url: SOURCE_URL,
    user_data: {
      em: hash(venda.email) ? [hash(venda.email)] : undefined,
      ph: hashTelefone(venda.telefone, venda.ddi) ? [hashTelefone(venda.telefone, venda.ddi)] : undefined,
      fn: nome[0] ? [hash(nome[0])] : undefined,
      ln: nome.length > 1 ? [hash(nome[nome.length - 1])] : undefined,
    },
    custom_data: {
      currency: venda.moeda,
      value: venda.valor,
      content_name: 'Imersao GPS do Plantao Sem Medo',
    },
  };

  const resposta = await fetch(
    `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(CAPI_TOKEN)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [evento] }),
    }
  );

  const texto = await resposta.text();
  if (!resposta.ok) throw new Error(`Meta respondeu ${resposta.status}: ${texto}`);
  return texto;
}

// Eventos da Hotmart que contam como venda concluida.
const EVENTOS_DE_VENDA = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'APPROVED', 'COMPLETE'];

function registrar(app, express) {
  app.post('/webhook/hotmart', express.json({ limit: '1mb' }), async (req, res) => {
    const tokenRecebido =
      req.get('X-HOTMART-HOTTOK') || req.get('hottok') || (req.body && req.body.hottok) || '';

    if (!HOTTOK) {
      console.error('[hotmart] HOTMART_HOTTOK nao cadastrado: postback recusado.');
      return res.status(503).json({ erro: 'webhook ainda nao configurado' });
    }
    if (tokenRecebido !== HOTTOK) {
      console.warn('[hotmart] hottok invalido, postback ignorado.');
      return res.status(401).json({ erro: 'hottok invalido' });
    }

    const venda = lerVenda(req.body || {});

    if (!EVENTOS_DE_VENDA.includes(String(venda.evento).toUpperCase())) {
      console.log(`[hotmart] evento ${venda.evento} recebido, nao e venda aprovada.`);
      return res.status(200).json({ ok: true, ignorado: venda.evento });
    }

    if (!novaVenda(venda.codigo)) {
      console.log(`[hotmart] venda ${venda.codigo} ja enviada, repetida ignorada.`);
      return res.status(200).json({ ok: true, repetida: true });
    }

    if (!CAPI_TOKEN) {
      console.error('[hotmart] META_CAPI_TOKEN nao cadastrado: venda nao enviada ao Meta.');
      return res.status(200).json({ ok: true, enviado: false });
    }

    try {
      await enviarAoMeta(venda);
      console.log(`[hotmart] venda ${venda.codigo} enviada ao Meta: ${venda.moeda} ${venda.valor}`);
      res.status(200).json({ ok: true, enviado: true });
    } catch (erro) {
      // Devolvemos 200 de proposito: a Hotmart ja entregou o dado, e reenviar
      // nao resolve erro de token. O problema fica no log do Railway.
      jaEnviadas.delete(venda.codigo);
      console.error(`[hotmart] falha ao enviar ao Meta: ${erro.message}`);
      res.status(200).json({ ok: true, enviado: false });
    }
  });

  // Conferencia rapida pelo navegador, sem expor token nenhum.
  app.get('/webhook/hotmart', (req, res) => {
    // Diagnostico: so os NOMES das variaveis parecidas com as nossas, nunca o
    // conteudo delas. Serve para achar erro de digitacao no painel do Railway.
    // Pode sair daqui depois que as duas chaves estiverem valendo.
    const nomesParecidos = Object.keys(process.env)
      .filter((k) => /HOTMART|HOTTOK|META|PIXEL|CAPI/i.test(k))
      .sort();

    res.status(200).json({
      rota: 'ativa',
      hottok_cadastrado: Boolean(HOTTOK),
      token_meta_cadastrado: Boolean(CAPI_TOKEN),
      pixel: PIXEL_ID,
      nomes_encontrados: nomesParecidos,
      total_de_variaveis: Object.keys(process.env).length,
    });
  });
}

module.exports = { registrar };
