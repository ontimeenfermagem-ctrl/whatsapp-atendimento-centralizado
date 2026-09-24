/*
 * pre-formulario.js — o pré-formulário da página de venda da Imersão GPS (/igps_set_lp_26-ingresso).
 *
 * Adaptado de paginas/js/inscricao.js (a página /viver-de-furo-inscricao do repo paginas), que é o
 * mesmo fluxo pronto: nome, WhatsApp e e-mail -> POST /api/inscricao do paginas -> checkout da
 * Hotmart já preenchido. Duas diferenças: aqui o formulário mora num modal (<dialog>) que abre no
 * lugar do checkout, e a API mora em OUTRO site (lp.escolaenfermagemdevalor.com.br), então o envio
 * é CORS — sem cookie, com o JSON em text/plain para não haver preflight.
 *
 * Quem manda no link, na UTM que vira sck e na régua do e-mail é EVCheckout (js/checkout-config.js,
 * página "imersao-gps"); quem manda na validação é EVLeadRules (js/lead-rules.js). Os dois são
 * CÓPIAS dos arquivos do paginas, os mesmos que o servidor de lá usa para validar e gravar: a tela
 * e a gravação nunca discordam.
 *
 * O que acontece aqui, em ordem:
 *
 *   1. Ao abrir a página, TODO link para pay.hotmart.com ganha as UTMs do primeiro toque e o sck
 *      (= utm_content). É a rede de segurança: se o modal falhar, quem toca no botão chega ao
 *      checkout com a campanha. O href original fica guardado em data-checkout-base.
 *   2. Os botões [data-checkout] abrem o pré-formulário em vez de ir direto. No envio, o POST vai
 *      para o endereço do data-api do formulário; o paginas grava o lead com as UTMs e devolve o
 *      link do checkout. O link ORIGINAL do botão tocado vai junto ("checkout"): é dele que o
 *      servidor tira a oferta (off=), e é isso que deixa trocar de lote mexendo só nos botões.
 *
 * Princípio que guia tudo: NADA pode travar a venda. Se o paginas demorar mais de 3,5 s, cair ou
 * responder erro, a página monta o mesmo link sozinha (EVCheckout.urlDoCheckout), avisa o servidor
 * por sendBeacon e segue para o checkout. A única resposta que segura a pessoa é o 422 de contato
 * inválido. Navegador sem <dialog> (webview muito antigo): o botão vai direto, com as UTMs.
 */
(function () {
  "use strict";

  const L = window.EVLeadRules;
  const C = window.EVCheckout;
  // Sem as regras (arquivo que não carregou), os botões seguem para o link do HTML, sem UTM.
  if (!L || !C) return;

  const pagina = C.paginaPorId("imersao-gps");
  // Daqui em diante é este arquivo que cuida do clique nos botões (e do InitiateCheckout): o script
  // inline do index.html, que dispara o evento enquanto os .js não chegam, para de disparar.
  window.EVPreFormularioAtivo = true;

  /* ================================================================== */
  /* Constantes                                                          */
  /* ================================================================== */

  /** O visitante tem o mesmo nome de chave das páginas do paginas (lá o id vale entre páginas). */
  const CHAVE_VISITANTE = "ev_pesquisa_visitante";
  /** Rastreio de PRIMEIRO toque desta página (bloco inteiro, nunca campo a campo). */
  const CHAVE_RASTREIO = "ev_gps_rastreio_v1";
  /** Quem já preencheu neste aparelho: os campos voltam preenchidos. */
  const CHAVE_INSCRICAO = "ev_gps_inscricao_v1";

  /** Esperou mais que isto pelo paginas? Vai para o checkout montado aqui mesmo. */
  const TIMEOUT_MS = 3500;
  /** O contato lembrado no aparelho vale por 24 h (computador do posto é de todo mundo). */
  const CONTATO_VALE_MS = 24 * 60 * 60 * 1000;
  /** Depois de tantos envios recusados aqui na tela, aparece "Ir direto para o pagamento". */
  const RECUSAS_PARA_SAIDA = 2;

  const CAMPANHA = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"];
  const TETO = { page_url: 2048, referrer: 2048, fbclid: 1000, gclid: 1000 };
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const CHAVE_MENSAGEM = { nome: "name", whatsapp: "phone", email: "email" };
  const ORDEM = ["nome", "whatsapp", "email"];

  /** A UTM que vira sck (nesta página, o utm_content: o criativo do anúncio). */
  const SCK = pagina ? C.sckDaPagina(pagina) : "utm_content";
  /** Só .com e .com.br, como no site da Escola (a régua vem do checkout-config). */
  const REGUA_EMAIL = { somenteComBr: Boolean(pagina && pagina.emailSomenteComBr === true) };

  const $ = (id) => document.getElementById(id);

  /* ================================================================== */
  /* Armazenamento — sempre em try/catch                                 */
  /* ================================================================== */
  // Navegador anônimo do iPhone e alguns webviews jogam exceção só de tocar no localStorage.

  function lerStorage(chave) {
    try {
      return window.localStorage.getItem(chave);
    } catch {
      return null;
    }
  }

  function gravarStorage(chave, valor) {
    try {
      window.localStorage.setItem(chave, valor);
    } catch {
      // Cheio ou bloqueado: a venda funciona igual, só não lembra da pessoa.
    }
  }

  function lerJson(chave) {
    try {
      const bruto = JSON.parse(lerStorage(chave) || "null");
      return bruto && typeof bruto === "object" ? bruto : null;
    } catch {
      return null;
    }
  }

  function gravarJson(chave, valor) {
    try {
      gravarStorage(chave, JSON.stringify(valor));
    } catch {
      // Objeto que não vira JSON não pode derrubar a página.
    }
  }

  /* ================================================================== */
  /* Identificadores                                                     */
  /* ================================================================== */

  function novoUuid() {
    const c = window.crypto;
    try {
      if (c && typeof c.randomUUID === "function") return c.randomUUID();
    } catch {
      // randomUUID só existe em contexto seguro; cai no getRandomValues.
    }
    const bytes = new Uint8Array(16);
    if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
    else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    // Versão 4 e variante RFC 4122, para o servidor aceitar como UUID de verdade.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function visitanteDoAparelho() {
    const guardado = lerStorage(CHAVE_VISITANTE);
    if (guardado && UUID.test(guardado)) return guardado;
    const novo = novoUuid();
    gravarStorage(CHAVE_VISITANTE, novo);
    return novo;
  }

  /* ================================================================== */
  /* Rastreio de primeiro toque                                          */
  /* ================================================================== */

  function texto(valor, campo) {
    if (valor == null) return null;
    const limpo = String(valor).trim().slice(0, TETO[campo] || 500);
    return limpo || null;
  }

  function dispositivo() {
    const largura = window.innerWidth || document.documentElement.clientWidth || 0;
    if (largura < 768) return "mobile";
    if (largura < 1024) return "tablet";
    return "desktop";
  }

  /**
   * A campanha é um BLOCO só: se a primeira visita a esta página trouxe qualquer utm/fbclid/gclid,
   * fica o bloco dela inteiro. Misturar campo a campo creditaria uma campanha do Facebook à bio do
   * Instagram. Mesma regra do inscricao.js e do js/pesquisa.js do paginas.
   */
  function blocoDeCampanha() {
    const daUrl = C.rastreioDaUrl(window.location.search);
    const guardado = lerJson(CHAVE_RASTREIO);
    if (guardado && CAMPANHA.some((campo) => typeof guardado[campo] === "string" && guardado[campo])) return guardado;
    if (CAMPANHA.some((campo) => daUrl[campo])) gravarJson(CHAVE_RASTREIO, daUrl);
    return daUrl;
  }

  // O primeiro toque é registrado AO ABRIR a página, e não no envio: quem chega pelo anúncio,
  // sai e volta direto tem a campanha certa mesmo sem ter preenchido nada da primeira vez.
  const CAMPANHA_DESTA_PESSOA = blocoDeCampanha();

  function rastreioAtual() {
    const bloco = CAMPANHA_DESTA_PESSOA;
    const dados = {
      // Sem o #: âncora (#ingresso) não diz nada sobre a origem.
      page_url: texto(window.location.origin + window.location.pathname + window.location.search, "page_url"),
      referrer: texto(document.referrer, "referrer"),
      dispositivo: dispositivo()
    };
    for (const campo of CAMPANHA) {
      dados[campo] = typeof bloco[campo] === "string" ? texto(bloco[campo], campo) : null;
    }
    return dados;
  }

  /** Só as UTMs, do jeito que montarUrlCheckout espera. */
  function utmDoRastreio(rastreio) {
    const utm = {};
    for (const campo of C.UTMS) if (rastreio[campo]) utm[campo] = rastreio[campo];
    return utm;
  }

  /* ================================================================== */
  /* 1. Todo link da Hotmart já sai com as UTMs e o sck                  */
  /* ================================================================== */
  // Roda antes de tudo o que envolve o modal: se algo abaixo falhar, o clique no botão ainda leva
  // a campanha até o checkout. Só o href muda; o elemento é o mesmo (a guarda do widget da
  // Hotmart, no fim do HTML, segura estes mesmos elementos).

  (function decorarLinks() {
    const utm = utmDoRastreio(rastreioAtual());
    for (const link of document.querySelectorAll('a[href*="pay.hotmart.com"]')) {
      try {
        if (!link.hasAttribute("data-checkout-base")) link.setAttribute("data-checkout-base", link.getAttribute("href") || "");
        const original = link.getAttribute("data-checkout-base");
        const comUtm = C.montarUrlCheckout(original, { utm, sck: SCK });
        if (comUtm && comUtm !== link.getAttribute("href")) link.setAttribute("href", comUtm);
      } catch {
        // Link estranho fica como está: ele ainda leva ao checkout.
      }
    }
  })();

  /* ================================================================== */
  /* Pixel                                                               */
  /* ================================================================== */

  function pixel(tipo, evento, dados, idEvento) {
    if (typeof window.fbq !== "function") return;
    try {
      // eventID deixa a Meta juntar este evento com o mesmo evento vindo do servidor, se um dia vier.
      if (idEvento) window.fbq(tipo, evento, dados || {}, { eventID: idEvento });
      else if (dados) window.fbq(tipo, evento, dados);
      else window.fbq(tipo, evento);
    } catch {
      // Bloqueador de anúncio não pode atrapalhar a venda.
    }
  }

  /** O valor do InitiateCheckout sai do botão (data-valor="5.00"): cada lote diz o seu. */
  function valorDoBotao(link) {
    const valor = Number.parseFloat(String((link && link.getAttribute("data-valor")) || "").replace(",", "."));
    return Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : null;
  }

  function initiateCheckout(link, idEvento) {
    const valor = valorDoBotao(link);
    pixel("track", "InitiateCheckout", valor ? { value: valor, currency: "BRL" } : { currency: "BRL" }, idEvento);
  }

  /**
   * Quando o modal não pode ser usado, o botão vai direto ao checkout (com as UTMs do passo 1) e
   * o Pixel ainda fica sabendo, como antes do pré-formulário.
   */
  function saidaDireta() {
    for (const link of document.querySelectorAll("a[data-checkout]")) {
      link.addEventListener("click", () => initiateCheckout(link));
    }
    // O formulário não é usado: um envio nativo faria GET com nome, WhatsApp e e-mail na URL.
    const formulario = document.getElementById("pf-form");
    if (formulario) formulario.addEventListener("submit", (evento) => evento.preventDefault());
  }

  /* ================================================================== */
  /* 2. O pré-formulário                                                 */
  /* ================================================================== */

  if (!pagina) return saidaDireta();

  const dialogo = $("pre-formulario");
  const form = $("pf-form");
  const titulo = $("pf-titulo");
  const fechar = $("pf-fechar");
  const campos = { nome: $("pf-nome"), whatsapp: $("pf-whatsapp"), email: $("pf-email") };
  const status = $("pf-status");
  const botao = $("pf-ir");
  const botaoTexto = $("pf-ir-texto");
  const avisoVivo = $("pf-aviso");
  const sugestao = {
    caixa: $("pf-sugestao"),
    valor: $("pf-sugestao-valor"),
    sim: $("pf-sugestao-sim"),
    nao: $("pf-sugestao-nao")
  };
  const API = form ? String(form.getAttribute("data-api") || "").trim() : "";
  // Opcionais: sem eles o modal funciona igual, só sem a saída "Ir direto para o pagamento".
  const saida = { caixa: $("pf-direto"), link: $("pf-direto-link") };

  // Qualquer peça faltando, ou navegador sem <dialog>: não intercepta nada, e o botão vai direto
  // para o checkout (já com as UTMs do passo 1).
  const pecas = [dialogo, form, titulo, fechar, status, botao, botaoTexto, sugestao.caixa, sugestao.valor, sugestao.sim, sugestao.nao];
  if (pecas.some((peca) => !peca) || ORDEM.some((campo) => !campos[campo])) return saidaDireta();
  if (typeof dialogo.showModal !== "function" || !/^https?:\/\/[^/\s]+/i.test(API)) return saidaDireta();

  const ROTULO_BOTAO = botaoTexto.textContent.trim() || "Continuar para o pagamento";
  const PONTEIRO_FINO = Boolean(window.matchMedia && window.matchMedia("(pointer: fine)").matches);

  function anunciar(mensagem) {
    if (!avisoVivo) return;
    avisoVivo.textContent = "";
    window.setTimeout(() => {
      avisoVivo.textContent = mensagem;
    }, 30);
  }

  /* ------------------------------------------------------------------ estado */

  /** O botão que abriu o modal: o foco volta para ele, e o link ORIGINAL dele vai no envio. */
  let abertoPor = null;
  let abriuUmaVez = false;
  let tentouEnviar = false;
  let enviando = false;
  let indo = false; // já saiu para o checkout: fechar o modal não mexe mais no foco
  let emailDispensado = ""; // e-mail que a pessoa confirmou estar certo apesar da sugestão
  let whatsappAnterior = "";
  let leadRastreado = false;
  let recusas = 0; // envios barrados pela validação da tela ou pelo 422 do servidor

  /* ------------------------------------------------------------------ abrir e fechar */

  function primeiroCampoParaPreencher() {
    for (const campo of ORDEM) {
      const grupo = form.querySelector(`[data-campo="${campo}"]`);
      if (!campos[campo].value.trim() || (grupo && grupo.classList.contains("tem-erro"))) return campos[campo];
    }
    return null;
  }

  function abrir(link) {
    try {
      if (!dialogo.open) dialogo.showModal();
    } catch {
      initiateCheckout(link);
      return false; // o clique segue para o checkout
    }
    abertoPor = link;
    status.textContent = "";
    if (!abriuUmaVez) {
      abriuUmaVez = true;
      pixel("trackCustom", "abriu_pre_formulario", { pagina: pagina.id });
    }
    // Com mouse, o cursor já fica no primeiro campo vazio. No celular, o foco vai para o título:
    // o teclado não sobe sozinho cobrindo o formulário, e o leitor de tela começa pelo título.
    const alvo = PONTEIRO_FINO ? primeiroCampoParaPreencher() : null;
    try {
      (alvo || titulo).focus({ preventScroll: true });
    } catch {
      (alvo || titulo).focus();
    }
    return true;
  }

  for (const link of document.querySelectorAll("a[data-checkout]")) {
    link.setAttribute("aria-haspopup", "dialog");
    link.addEventListener("click", (evento) => {
      // Ctrl/Cmd/meio: abre o checkout em outra aba, como qualquer link (já com as UTMs).
      if (evento.defaultPrevented || evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
      if (abrir(link)) evento.preventDefault();
    });
  }

  fechar.addEventListener("click", () => dialogo.close());

  // Clique no fundo escuro fecha. O toque tem que COMEÇAR no fundo: quem seleciona o texto de um
  // campo e solta o mouse fora do cartão não pode perder o que digitou.
  let apertouNoFundo = false;
  dialogo.addEventListener("pointerdown", (evento) => {
    apertouNoFundo = evento.target === dialogo;
  });
  dialogo.addEventListener("click", (evento) => {
    if (evento.target === dialogo && apertouNoFundo) dialogo.close();
    apertouNoFundo = false;
  });

  // Esc (evento cancel) e o X fecham pelo próprio <dialog>; o foco volta ao botão que abriu.
  dialogo.addEventListener("close", () => {
    if (indo || !abertoPor) return;
    try {
      abertoPor.focus({ preventScroll: true });
    } catch {
      abertoPor.focus();
    }
  });

  /* ------------------------------------------------------------------ validação */

  function mostrarErro(campo, mensagem) {
    const caixa = $(`pf-erro-${campo}`);
    const grupo = form.querySelector(`[data-campo="${campo}"]`);
    if (caixa) {
      caixa.textContent = mensagem || "";
      caixa.hidden = !mensagem;
    }
    campos[campo].setAttribute("aria-invalid", mensagem ? "true" : "false");
    if (grupo) grupo.classList.toggle("tem-erro", Boolean(mensagem));
  }

  function erroLocal(campo) {
    const valor = campos[campo].value;
    const codigo =
      campo === "nome" ? L.nameError(valor) : campo === "whatsapp" ? L.phoneError(valor) : L.emailError(valor, REGUA_EMAIL);
    return L.message(CHAVE_MENSAGEM[campo], codigo);
  }

  function validarCampo(campo) {
    const mensagem = erroLocal(campo);
    mostrarErro(campo, mensagem);
    return mensagem;
  }

  function atualizarSugestao(destaque) {
    const valor = L.normalizeEmail(campos.email.value);
    const sugerido = valor ? L.suggestEmail(valor) : "";
    const codigo = L.emailError(valor, REGUA_EMAIL);
    if (!sugerido || (valor === emailDispensado && codigo !== "typo")) {
      sugestao.caixa.hidden = true;
      sugestao.caixa.classList.remove("destaque");
      return "";
    }
    sugestao.valor.textContent = sugerido;
    // Com erro de digitação certo (gmail.con), "está certo" não é opção: o e-mail não existe.
    sugestao.nao.hidden = codigo === "typo";
    sugestao.caixa.hidden = false;
    sugestao.caixa.classList.toggle("destaque", Boolean(destaque));
    return sugerido;
  }

  function mostrarErrosDoServidor(camposErro) {
    let primeiro = null;
    for (const campo of ORDEM) {
      const mensagem = camposErro && typeof camposErro[campo] === "string" ? camposErro[campo] : "";
      mostrarErro(campo, mensagem);
      if (mensagem && !primeiro) primeiro = campo;
    }
    if (primeiro) campos[primeiro].focus();
    else status.textContent = "Confere os seus dados, por favor.";
  }

  // Quem sai do campo tocando no botão não pode ver o botão fugir do dedo: mostrar erro no blur
  // empurra o botão para baixo e o toque cai no vazio. Nesse caso o blur não mexe na tela — o
  // próprio envio valida e mostra tudo. Quem encerra o "apertando" é o CLIQUE, e não um timer.
  let apertandoEnviar = false;
  let soltarTimer = 0;
  function soltarEnviar() {
    window.clearTimeout(soltarTimer);
    apertandoEnviar = false;
  }
  botao.addEventListener("pointerdown", () => {
    apertandoEnviar = true;
    window.clearTimeout(soltarTimer);
    soltarTimer = window.setTimeout(soltarEnviar, 1000);
  });
  botao.addEventListener("click", soltarEnviar, true);
  botao.addEventListener("pointercancel", soltarEnviar);

  for (const campo of ORDEM) {
    campos[campo].addEventListener("blur", () => {
      if (apertandoEnviar || !dialogo.open) return;
      if (campos[campo].value.trim() || tentouEnviar) validarCampo(campo);
      if (campo === "email") atualizarSugestao(false);
    });
    campos[campo].addEventListener("input", () => {
      // Corrigiu? O erro some na hora, sem esperar sair do campo.
      if (form.querySelector(`[data-campo="${campo}"]`).classList.contains("tem-erro") && !erroLocal(campo)) {
        mostrarErro(campo, "");
      }
      status.textContent = "";
    });
  }

  // A máscara reescreve o campo inteiro; sem cuidar do cursor, ele pula para o fim e quem corrige um
  // dígito no meio ("(11) 9123|4-5678") digita o novo no fim e fica com um número errado mas válido.
  // Conta quantos DÍGITOS havia antes do cursor e põe o cursor depois do mesmo número de dígitos.
  function posicaoDepoisDeDigitos(texto, quantos) {
    if (quantos <= 0) {
      const primeiro = texto.search(/\d/);
      return primeiro === -1 ? texto.length : primeiro;
    }
    let vistos = 0;
    for (let i = 0; i < texto.length; i += 1) {
      if (/\d/.test(texto[i])) {
        vistos += 1;
        if (vistos === quantos) return i + 1;
      }
    }
    return texto.length;
  }

  campos.whatsapp.addEventListener("input", (evento) => {
    const campo = campos.whatsapp;
    const atual = campo.value;
    const cursor = typeof campo.selectionStart === "number" ? campo.selectionStart : atual.length;
    let noFim = cursor >= atual.length;
    let digitosAntes = atual.slice(0, cursor).replace(/\D/g, "").length;
    let formatado;
    const digitos = atual.replace(/\D/g, "");
    if (atual.length < whatsappAnterior.length && digitos === whatsappAnterior.replace(/\D/g, "")) {
      // Apagou só um separador ("-", ")", espaço): a máscara o poria de volta e a tecla pareceria
      // quebrada. Sai o dígito AO LADO do cursor — antes dele no Backspace, depois dele no Delete —
      // e não o último do número.
      const paraFrente = evento && evento.inputType === "deleteContentForward";
      const indice = paraFrente ? digitosAntes : digitosAntes - 1;
      if (indice >= 0 && indice < digitos.length) {
        formatado = L.formatPhone(digitos.slice(0, indice) + digitos.slice(indice + 1));
        digitosAntes = paraFrente ? digitosAntes : digitosAntes - 1;
      } else {
        formatado = L.formatPhone(digitos);
      }
      noFim = false;
    } else {
      formatado = L.formatPhoneWhileTyping(atual, whatsappAnterior);
    }
    if (formatado !== atual) {
      campo.value = formatado;
      if (!noFim && document.activeElement === campo) {
        const pos = posicaoDepoisDeDigitos(formatado, digitosAntes);
        try {
          campo.setSelectionRange(pos, pos);
        } catch {
          // type=tel aceita setSelectionRange; se o navegador recusar, o cursor fica no fim.
        }
      }
    }
    whatsappAnterior = formatado;
  });

  campos.email.addEventListener("input", () => {
    if (!sugestao.caixa.hidden) atualizarSugestao(false);
  });

  // Enter no nome ou no WhatsApp passa para o próximo campo em vez de enviar pela metade.
  campos.nome.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      campos.whatsapp.focus();
    }
  });
  campos.whatsapp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      campos.email.focus();
    }
  });

  sugestao.sim.addEventListener("click", () => {
    campos.email.value = sugestao.valor.textContent;
    sugestao.caixa.hidden = true;
    sugestao.caixa.classList.remove("destaque");
    validarCampo("email");
    campos.email.focus();
  });

  sugestao.nao.addEventListener("click", () => {
    emailDispensado = L.normalizeEmail(campos.email.value);
    sugestao.caixa.hidden = true;
    sugestao.caixa.classList.remove("destaque");
    botao.focus();
  });

  /* ------------------------------------------------------------------ quem já passou por aqui */

  (function preencherDoAparelho() {
    const guardado = lerJson(CHAVE_INSCRICAO);
    const contato = guardado && typeof guardado.contato === "object" && guardado.contato ? guardado.contato : null;
    if (!contato) return;
    const quando = Date.parse(String(guardado.em || ""));
    const idade = Date.now() - quando;
    // Data no futuro (relógio do aparelho mexido) também não vale: só o que é de até 24 h atrás.
    if (!Number.isFinite(quando) || idade < -60 * 1000 || idade > CONTATO_VALE_MS) {
      // Vencido (ou torto): some do aparelho, para a próxima pessoa do mesmo computador não ver.
      try {
        window.localStorage.removeItem(CHAVE_INSCRICAO);
      } catch {
        // Bloqueado: não preenche, e pronto.
      }
      return;
    }
    if (typeof contato.nome === "string") campos.nome.value = L.normalizeName(contato.nome);
    if (typeof contato.whatsapp === "string") campos.whatsapp.value = L.formatPhone(contato.whatsapp);
    if (typeof contato.email === "string") campos.email.value = L.normalizeEmail(contato.email);
    whatsappAnterior = campos.whatsapp.value;
    // Nada é enviado sozinho: a pessoa confere e toca no botão.
  })();

  /* ------------------------------------------------------------------ envio */

  function carregando(sim) {
    enviando = sim;
    botao.disabled = sim;
    botao.setAttribute("aria-busy", sim ? "true" : "false");
    botaoTexto.textContent = sim ? "Abrindo o pagamento…" : ROTULO_BOTAO;
  }

  // Voltando do checkout pelo botão "voltar" (inclusive do bfcache): o botão volta a funcionar,
  // e o modal continua aberto com o que ela digitou, para conferir e seguir de novo.
  window.addEventListener("pageshow", () => {
    indo = false;
    if (enviando) carregando(false);
  });

  const CABECALHOS = { "Content-Type": "text/plain;charset=UTF-8" };

  /**
   * O link que a API devolve só vale se for o checkout do produto do config (mesmo caminho em
   * pay.hotmart.com). Qualquer outra coisa (API trocada, deploy errado) vira o plano B: a página
   * nunca leva o contato da pessoa para outro endereço.
   */
  const CAMINHO_CHECKOUT = String(pagina.checkout || "").split(/[?#]/)[0].toLowerCase();
  function checkoutConfiavel(url) {
    return typeof url === "string" && Boolean(CAMINHO_CHECKOUT) && url.split(/[?#]/)[0].toLowerCase() === CAMINHO_CHECKOUT;
  }

  /**
   * Pergunta ao paginas, com prazo. O prazo é um Promise.race, e não só o AbortController: em
   * navegador sem abort (ou resposta que trava no meio do corpo), a venda segue do mesmo jeito.
   * Devolve { tipo: "ok", checkout } | { tipo: "contato", campos } | { tipo: "falhou" }.
   */
  async function pedirAoServidor(corpo) {
    const controle = typeof window.AbortController === "function" ? new AbortController() : null;
    let relogio = 0;
    const prazo = new Promise((resolve) => {
      relogio = window.setTimeout(() => {
        try {
          if (controle) controle.abort();
        } catch {
          // abort não suportado: o race já resolveu.
        }
        resolve({ tipo: "falhou" });
      }, TIMEOUT_MS);
    });
    const pedido = (async () => {
      try {
        const resposta = await window.fetch(API, {
          method: "POST",
          mode: "cors",
          // Sem cookie: o paginas não precisa saber de sessão nenhuma para gravar o lead.
          credentials: "omit",
          // text/plain = "simple request": sem preflight OPTIONS, uma ida a menos antes do
          // checkout. O paginas aceita o JSON assim só das origens liberadas.
          headers: CABECALHOS,
          body: corpo,
          signal: controle ? controle.signal : undefined
        });
        const dados = await resposta.json().catch(() => null);
        if (resposta.status === 422 && dados && dados.error === "invalid_contact") {
          return { tipo: "contato", campos: dados.campos };
        }
        if (resposta.ok && dados && dados.ok && checkoutConfiavel(dados.checkout)) {
          return { tipo: "ok", checkout: dados.checkout };
        }
      } catch {
        // Rede caída, CORS recusado, servidor mudo ou prazo estourado: o plano B resolve.
      }
      return { tipo: "falhou" };
    })();
    try {
      return await Promise.race([pedido, prazo]);
    } finally {
      window.clearTimeout(relogio);
    }
  }

  /**
   * Fire-and-forget que sobrevive à troca de página. sendBeacon com STRING vai como text/plain,
   * que é o único tipo que ele consegue mandar para outro site; fetch keepalive é a reserva.
   */
  function avisarServidor(corpo) {
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(API, corpo)) return;
    } catch {
      // Beacon recusado (tamanho, webview): tenta o fetch abaixo.
    }
    try {
      window
        .fetch(API, { method: "POST", mode: "cors", credentials: "omit", headers: CABECALHOS, body: corpo, keepalive: true })
        .catch(() => {});
    } catch {
      // Sem jeito de avisar: a venda vale mais que o registro.
    }
  }

  function irParaOCheckout(url, idEvento) {
    indo = true;
    initiateCheckout(abertoPor, idEvento);
    anunciar("Abrindo o pagamento.");
    // href e não replace: a pessoa pode querer voltar para conferir o que digitou.
    window.location.href = url;
  }

  /** Depois de 2 recusas, a saída sem formulário: o link do botão tocado, já com as UTMs e o sck. */
  function contarRecusa() {
    recusas += 1;
    if (recusas < RECUSAS_PARA_SAIDA || !saida.caixa || !saida.link) return;
    const destino = (abertoPor && abertoPor.getAttribute("href")) || "";
    if (/^https:\/\/pay\.hotmart\.com\//i.test(destino)) saida.link.setAttribute("href", destino);
    saida.caixa.hidden = false;
  }

  if (saida.link) {
    saida.link.addEventListener("click", () => {
      indo = true;
      initiateCheckout(abertoPor);
    });
  }

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (enviando) return;
    tentouEnviar = true;
    status.textContent = "";

    let primeiroErro = null;
    for (const campo of ORDEM) {
      if (validarCampo(campo) && !primeiroErro) primeiroErro = campo;
    }
    if (primeiroErro) {
      // Erro de digitação no e-mail já aparece com a correção pronta, mesmo que o foco vá antes
      // para outro campo com erro.
      if (L.emailError(campos.email.value, REGUA_EMAIL) === "typo") atualizarSugestao(primeiroErro === "email");
      campos[primeiroErro].focus();
      contarRecusa();
      return;
    }

    // Sugestão pendente (gmial.com): antes de seguir a pessoa escolhe corrigir ou manter.
    if (atualizarSugestao(true)) {
      sugestao.sim.focus();
      anunciar(`Você quis dizer ${sugestao.valor.textContent}?`);
      return;
    }

    const contato = {
      nome: L.normalizeName(campos.nome.value),
      whatsapp: L.formatPhone(campos.whatsapp.value),
      email: L.normalizeEmail(campos.email.value)
    };
    // A tela passa a mostrar exatamente o que vai ser enviado (e o que volta se a pessoa voltar).
    campos.nome.value = contato.nome;
    campos.whatsapp.value = contato.whatsapp;
    campos.email.value = contato.email;
    whatsappAnterior = contato.whatsapp;

    // O link ORIGINAL do botão tocado (sem as UTMs do passo 1): o servidor tira dele só a oferta.
    const base = (abertoPor && abertoPor.getAttribute("data-checkout-base")) || pagina.checkout;
    const rastreio = rastreioAtual();
    const idPedido = novoUuid();
    // Quem já foi contada como Lead neste aparelho, com o MESMO contato, não vira Lead de novo ao
    // voltar do checkout e enviar outra vez (a página pode ter recarregado).
    const anterior = lerJson(CHAVE_INSCRICAO);
    const mesmoContato =
      Boolean(anterior && anterior.inscrito && anterior.contato) &&
      anterior.contato.nome === contato.nome &&
      anterior.contato.whatsapp === contato.whatsapp &&
      anterior.contato.email === contato.email;
    const corpo = JSON.stringify({
      pagina: pagina.id,
      id: idPedido,
      visitante_id: visitanteDoAparelho(),
      contato,
      rastreio,
      checkout: base
    });

    carregando(true);

    const resultado = await pedirAoServidor(corpo);
    if (resultado.tipo === "contato") {
      carregando(false);
      mostrarErrosDoServidor(resultado.campos);
      contarRecusa();
      return;
    }

    // O Lead conta depois da resposta: um 422 do servidor (e-mail sem caixa de entrada) não é lead.
    // Se o servidor falhou, conta assim mesmo: o contato passou na mesma régua dele.
    if (!leadRastreado && !mesmoContato) {
      leadRastreado = true;
      pixel("track", "Lead", {}, idPedido);
    }
    gravarJson(CHAVE_INSCRICAO, { inscrito: true, pagina: pagina.id, contato, em: new Date().toISOString() });

    let destino = resultado.tipo === "ok" ? resultado.checkout : "";
    if (!destino) {
      // Plano B: a mesma URL que o servidor montaria (mesma oferta, UTMs, sck e contato), montada
      // aqui. A venda não espera ninguém.
      destino = C.urlDoCheckout(pagina, { base, utm: utmDoRastreio(rastreio), contato });
      avisarServidor(corpo);
    }

    irParaOCheckout(destino, idPedido);
  });
})();
