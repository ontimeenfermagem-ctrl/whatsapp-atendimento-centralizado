/*
 * bf_out_ls_26.gs — grava os inscritos da lista VIP da Black Friday (/BF_out_LS_26-inscricao-a) na
 * planilha BF_out_LS_26.
 *
 * Quem chama este script é o servidor (bf-leads.js), nunca o navegador: a página manda o lead para
 * /api/bf_out_ls_26/lead, o servidor valida com a mesma régua da tela e repassa para cá com o TOKEN.
 * Sem o token certo, nada é gravado.
 *
 * Instalação (uma vez só), com a planilha aberta:
 *   1. Extensões > Apps Script. Apague o que estiver lá, cole este arquivo inteiro e salve.
 *   2. Escolha a função "configurar" no menu de cima e clique em Executar. O Google pede
 *      autorização: aceite. Ela cria os cabeçalhos na primeira aba e mostra o TOKEN no registro
 *      de execução.
 *   3. Implantar > Nova implantação > tipo "App da Web". Executar como: Eu. Quem pode acessar:
 *      Qualquer pessoa. Implantar e copiar a URL (termina em /exec).
 *   4. No Railway, variáveis do serviço: BF_SHEETS_URL = a URL do passo 3 e
 *      BF_SHEETS_TOKEN = o token do passo 2.
 *
 * Mudou este arquivo depois? Implantar > Gerenciar implantações > editar > Nova versão. A URL
 * continua a mesma.
 */

const CABECALHOS = [
  "Data/hora",
  "Nome",
  "E-mail",
  "WhatsApp",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "Dispositivo",
  "Página"
];

function aba_() {
  // A primeira aba da planilha (hoje "Página1"): renomear a aba não quebra nada.
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function garantirCabecalhos_(aba) {
  const atual = aba.getRange(1, 1, 1, CABECALHOS.length).getValues()[0];
  if (atual.join("") !== "") return;
  aba.getRange(1, 1, 1, CABECALHOS.length).setValues([CABECALHOS]).setFontWeight("bold");
  aba.setFrozenRows(1);
}

/** Roda uma vez à mão (passo 2): cria os cabeçalhos e o token. */
function configurar() {
  garantirCabecalhos_(aba_());
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty("TOKEN");
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
    props.setProperty("TOKEN", token);
  }
  Logger.log("BF_SHEETS_TOKEN = " + token);
}

// Texto que começa com = + - @ viraria fórmula na planilha: o apóstrofo guarda como texto.
function celula_(valor) {
  const texto = valor == null ? "" : String(valor).slice(0, 500);
  return /^[=+\-@]/.test(texto) ? "'" + texto : texto;
}

function resposta_(dados) {
  return ContentService.createTextOutput(JSON.stringify(dados)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let dados;
  try {
    dados = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (erro) {
    return resposta_({ ok: false, erro: "json" });
  }

  const token = PropertiesService.getScriptProperties().getProperty("TOKEN");
  if (!token || dados.token !== token) return resposta_({ ok: false, erro: "token" });

  // Duas inscrições no mesmo instante não podem cair na mesma linha.
  const trava = LockService.getScriptLock();
  trava.waitLock(10000);
  try {
    const aba = aba_();
    garantirCabecalhos_(aba);
    aba.appendRow([
      new Date(),
      celula_(dados.nome),
      celula_(dados.email),
      celula_(dados.whatsapp),
      celula_(dados.utm_source),
      celula_(dados.utm_medium),
      celula_(dados.utm_campaign),
      celula_(dados.utm_content),
      celula_(dados.utm_term),
      celula_(dados.dispositivo),
      celula_(dados.page_url)
    ]);
  } finally {
    trava.releaseLock();
  }
  return resposta_({ ok: true });
}
