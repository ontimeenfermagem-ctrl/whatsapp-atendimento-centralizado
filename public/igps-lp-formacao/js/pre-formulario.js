/*
 * pre-formulario.js — a Ficha dos Presentes da antecipação da Formação Enfermagem de Valor 2.0
 * (/igps-lp-formacao): o pop-up de nome, WhatsApp e e-mail que abre nos botões da página.
 *
 * É o pré-formulário da venda da Imersão GPS (/igps_set_lp_26-ingresso/js/pre-formulario.js),
 * COPIADO, e não compartilhado: aquele está vendendo, e o que muda aqui não pode mexer lá. Mesmo
 * fluxo e mesmas regras: o POST vai para o /api/inscricao do paginas (lp.escolaenfermagemdevalor.
 * com.br, por CORS, sem cookie, com o JSON em text/plain para não haver preflight), que grava a
 * ficha com as UTMs na aba "Formação EV 2.0 — antecipação" do /painel.
 *
 * Quem manda no link, na UTM que vira sck e na régua do e-mail é EVCheckout (a cópia do
 * checkout-config.js do paginas que a venda do GPS já carrega, entrada "formacao-ev"); quem manda
 * na validação é EVLeadRules (a cópia do lead-rules.js). São os mesmos arquivos que o servidor de
 * lá usa para validar e gravar: a tela e a gravação nunca discordam.
 *
 * O que muda em relação ao do GPS:
 *
 *   1. As UTMs são SÓ as da URL aberta agora: nada de campanha guardada no aparelho. Quem volta
 *      sem UTM vai sem UTM (o paginas também grava a campanha do último envio, em bloco).
 *   2. Enquanto a "formacao-ev" não tiver link de checkout no config (EVCheckout.temCheckout), a
 *      ficha só CAPTA: grava e mostra "Ficha recebida" no próprio pop-up, e a pessoa fica na
 *      página. Com o link no config (e a cópia trazida para cá), o mesmo envio segue para o
 *      checkout da Hotmart já preenchido, como no GPS.
 *   3. Os botões são os [data-cta] da página (href="#" enquanto não há checkout).
 *
 * Princípio que guia tudo: NADA pode travar a pessoa. Se o paginas demorar mais de 3,5 s, cair ou
 * responder erro, a ficha vai de novo por sendBeacon e a pessoa segue (para o "Ficha recebida" ou
 * para o checkout montado aqui mesmo). A única resposta que segura a pessoa é o 422 de contato
 * inválido.
 */
(function () {
  "use strict";

  const L = window.EVLeadRules;
  const C = window.EVCheckout;
  // Sem as regras (arquivo que não carregou), os botões ficam como estão no HTML.
  if (!L || !C) return;

  const pagina = C.paginaPorId("formacao-ev");

  /* ================================================================== */
  /* Constantes                                                          */
  /* ================================================================== */

  /** O visitante tem o mesmo nome de chave das páginas do paginas (lá o id vale entre páginas). */
  const CHAVE_VISITANTE = "ev_pesquisa_visitante";
  /** Quem já preencheu neste aparelho: os campos voltam preenchidos. */
  const CHAVE_INSCRICAO = "ev_formacao_inscricao_v1";

  /** Esperou mais que isto pelo paginas? Segue sem a resposta (e a ficha vai de novo por beacon). */
  const TIMEOUT_MS = 3500;
  /** O contato lembrado no aparelho vale por 24 h (computador do posto é de todo mundo). */
  const CONTATO_VALE_MS = 24 * 60 * 60 * 1000;
  /** Com checkout: depois de tantos envios recusados aqui na tela, aparece "Ir direto para o pagamento". */
  const RECUSAS_PARA_SAIDA = 2;

  const CAMPANHA = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"];
  const TETO = { page_url: 2048, referrer: 2048, fbclid: 1000, gclid: 1000 };
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const CHAVE_MENSAGEM = { nome: "name", whatsapp: "phone", email: "email" };
  const ORDEM = ["nome", "whatsapp", "email"];

  /** A UTM que vira sck (nesta página, o utm_content: o criativo do anúncio). */
  const SCK = pagina ? C.sckDaPagina(pagina) : "utm_content";
  /** Só .com e .com.br, como na venda do GPS (a régua vem do checkout-config). */
  const REGUA_EMAIL = { somenteComBr: Boolean(pagina && pagina.emailSomenteComBr === true) };
  /** Com link no config, a ficha leva ao checkout; sem, ela só capta (ver o topo). */
  const COM_CHECKOUT = Boolean(pagina && C.temCheckout(pagina));
  /** Os botões da página que abrem a ficha. */
  const BOTOES = Array.from(document.querySelectorAll("a[data-cta]"));

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
      // Cheio ou bloqueado: a ficha funciona igual, só não lembra da pessoa.
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
  /* Rastreio: só o desta visita                                         */
  /* ================================================================== */

  function texto(valor, campo) {
    if (valor == null) return null;
    // O corte (aqui ou no rastreioDaUrl) pode partir um emoji ao meio, e meio emoji derruba o
    // encodeURIComponent que monta o link do checkout: a metade solta sai.
    const limpo = String(valor)
      .trim()
      .slice(0, TETO[campo] || 500)
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, (par) => (par.length === 2 ? par : ""));
    return limpo || null;
  }

  function dispositivo() {
    const largura = window.innerWidth || document.documentElement.clientWidth || 0;
    if (largura < 768) return "mobile";
    if (largura < 1024) return "tablet";
    return "desktop";
  }

  // SÓ a campanha da URL aberta agora (UTMs, fbclid e gclid). Nada é guardado no aparelho, ao
  // contrário da venda do GPS: quem volta depois sem UTM chega sem UTM.
  const CAMPANHA_DESTA_VISITA = C.rastreioDaUrl(window.location.search);

  function rastreioAtual() {
    const dados = {
      // Sem o #: âncora não diz nada sobre a origem.
      page_url: texto(window.location.origin + window.location.pathname + window.location.search, "page_url"),
      referrer: texto(document.referrer, "referrer"),
      dispositivo: dispositivo()
    };
    for (const campo of CAMPANHA) {
      const valor = CAMPANHA_DESTA_VISITA[campo];
      dados[campo] = typeof valor === "string" ? texto(valor, campo) : null;
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
  // Só faz efeito quando a página tiver botões com o link do checkout. Roda antes de tudo o que
  // envolve o pop-up: se algo abaixo falhar, o clique no botão ainda leva a campanha até o checkout.

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
  /* Pixel (a página ainda não tem: sem fbq, nada acontece)              */
  /* ================================================================== */

  function pixel(tipo, evento, dados, idEvento) {
    if (typeof window.fbq !== "function") return;
    try {
      // eventID deixa a Meta juntar este evento com o mesmo evento vindo do servidor, se um dia vier.
      if (idEvento) window.fbq(tipo, evento, dados || {}, { eventID: idEvento });
      else if (dados) window.fbq(tipo, evento, dados);
      else window.fbq(tipo, evento);
    } catch {
      // Bloqueador de anúncio não pode atrapalhar a ficha.
    }
  }

  /** O valor do InitiateCheckout sai do botão (data-valor="698.98"), quando houver checkout. */
  function valorDoBotao(link) {
    const valor = Number.parseFloat(String((link && link.getAttribute("data-valor")) || "").replace(",", "."));
    return Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : null;
  }

  function initiateCheckout(link, idEvento) {
    const valor = valorDoBotao(link);
    pixel("track", "InitiateCheckout", valor ? { value: valor, currency: "BRL" } : { currency: "BRL" }, idEvento);
  }

  /**
   * Quando o pop-up não pode ser usado, o botão segue o próprio link (com checkout, já com as
   * UTMs do passo 1) e o Pixel ainda fica sabendo de quem vai ao checkout.
   */
  function saidaDireta() {
    if (COM_CHECKOUT) {
      for (const link of BOTOES) link.addEventListener("click", () => initiateCheckout(link));
    }
    // O formulário não é usado: um envio nativo faria GET com nome, WhatsApp e e-mail na URL.
    const formulario = document.getElementById("pf-form");
    if (formulario) formulario.addEventListener("submit", (evento) => evento.preventDefault());
  }

  /* ================================================================== */
  /* 2. A ficha                                                          */
  /* ================================================================== */

  if (!pagina) return saidaDireta();

  const dialogo = $("pre-formulario");
  const form = $("pf-form");
  const ficha = $("pf-ficha");
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
  // A tela de "Ficha recebida" (captação, sem checkout).
  const pronto = {
    caixa: $("pf-pronto"),
    titulo: $("pf-pronto-titulo"),
    whatsapp: $("pf-pronto-whatsapp"),
    corrigir: $("pf-pronto-corrigir"),
    voltar: $("pf-pronto-voltar")
  };
  const API = form ? String(form.getAttribute("data-api") || "").trim() : "";
  // Opcionais, e só com checkout: sem eles o pop-up funciona igual, só sem a saída "Ir direto
  // para o pagamento".
  const saida = { caixa: $("pf-direto"), link: $("pf-direto-link") };

  // Qualquer peça faltando, ou navegador sem <dialog>: não intercepta nada, e o botão segue o
  // próprio link (com checkout, já com as UTMs do passo 1).
  const pecas = [dialogo, form, ficha, titulo, fechar, status, botao, botaoTexto, sugestao.caixa, sugestao.valor, sugestao.sim, sugestao.nao];
  // Sem checkout, a tela de "Ficha recebida" é obrigatória: é ela que diz à pessoa que deu certo.
  if (!COM_CHECKOUT) pecas.push(pronto.caixa, pronto.titulo, pronto.whatsapp, pronto.corrigir, pronto.voltar);
  if (pecas.some((peca) => !peca) || ORDEM.some((campo) => !campos[campo])) return saidaDireta();
  if (typeof dialogo.showModal !== "function" || !/^https?:\/\/[^/\s]+/i.test(API)) return saidaDireta();

  const ROTULO_BOTAO = botaoTexto.textContent.trim() || (COM_CHECKOUT ? "Continuar para o pagamento" : "Enviar minha ficha");
  const ROTULO_ENVIANDO = COM_CHECKOUT ? "Abrindo o pagamento…" : "Enviando sua ficha…";
  const PONTEIRO_FINO = Boolean(window.matchMedia && window.matchMedia("(pointer: fine)").matches);

  function anunciar(mensagem) {
    if (!avisoVivo) return;
    avisoVivo.textContent = "";
    window.setTimeout(() => {
      avisoVivo.textContent = mensagem;
    }, 30);
  }

  function focar(elemento) {
    try {
      elemento.focus({ preventScroll: true });
    } catch {
      elemento.focus();
    }
  }

  /* ------------------------------------------------------------------ estado */

  /** O botão que abriu o pop-up: o foco volta para ele, e (com checkout) o link ORIGINAL dele vai no envio. */
  let abertoPor = null;
  let abriuUmaVez = false;
  let tentouEnviar = false;
  let enviando = false;
  let indo = false; // já saiu para o checkout: fechar o pop-up não mexe mais no foco
  let emailDispensado = ""; // e-mail que a pessoa confirmou estar certo apesar da sugestão
  let whatsappAnterior = "";
  let leadRastreado = false;
  let recusas = 0; // envios barrados pela validação da tela ou pelo 422 do servidor
  let recebida = false; // sem checkout: a ficha desta visita já foi recebida
  let abertoEm = 0; // quando o pop-up abriu: o toque no fundo só fecha depois de 450 ms
  let recusaDoEmail = null; // { email, mensagem }: o e-mail que o servidor recusou (domínio sem caixa)

  /* ------------------------------------------------------------------ abrir e fechar */

  function primeiroCampoParaPreencher() {
    for (const campo of ORDEM) {
      const grupo = form.querySelector(`[data-campo="${campo}"]`);
      if (!campos[campo].value.trim() || (grupo && grupo.classList.contains("tem-erro"))) return campos[campo];
    }
    return null;
  }

  // A conexão com o paginas (o envio da ficha), e com a Hotmart quando houver checkout, abre
  // quando o pop-up abre, e não na carga da página, onde só disputaria banda com o topo.
  let conectou = false;
  function preconectar() {
    if (conectou) return;
    conectou = true;
    try {
      const destinos = [[new URL(API).origin, true]];
      if (COM_CHECKOUT) destinos.push(["https://pay.hotmart.com", false]);
      for (const [href, cors] of destinos) {
        const link = document.createElement("link");
        link.rel = "preconnect";
        link.href = href;
        if (cors) link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      }
    } catch {
      // Sem preconnect, o envio funciona igual (só sem a conexão adiantada).
    }
  }

  /** A tela do formulário ou a de "Ficha recebida"; o nome do pop-up para o leitor de tela acompanha. */
  function mostrarTela(daFichaRecebida) {
    ficha.hidden = daFichaRecebida;
    pronto.caixa.hidden = !daFichaRecebida;
    dialogo.setAttribute("aria-labelledby", daFichaRecebida ? "pf-pronto-titulo" : "pf-titulo");
    dialogo.setAttribute("aria-describedby", daFichaRecebida ? "pf-pronto-sub" : "pf-sub");
    // A tela nova começa do topo (no celular baixo o cartão rola).
    const rolagem = dialogo.querySelector(".pf-in");
    if (rolagem) rolagem.scrollTop = 0;
  }

  function abrir(link) {
    preconectar();
    try {
      if (!dialogo.open) {
        dialogo.showModal();
        abertoEm = Date.now();
      }
    } catch {
      if (COM_CHECKOUT) initiateCheckout(link);
      return false; // o clique segue o próprio link
    }
    abertoPor = link;
    status.textContent = "";
    if (!abriuUmaVez) {
      abriuUmaVez = true;
      pixel("trackCustom", "abriu_pre_formulario", { pagina: pagina.id });
    }
    // Ficha já recebida: abre no "Ficha recebida". Senão, com mouse, o cursor já fica no primeiro
    // campo vazio; no celular, o foco vai para o título: o teclado não sobe sozinho cobrindo o
    // formulário, e o leitor de tela começa pelo título.
    focar(recebida ? pronto.titulo : (PONTEIRO_FINO && primeiroCampoParaPreencher()) || titulo);
    return true;
  }

  for (const link of BOTOES) {
    link.setAttribute("aria-haspopup", "dialog");
    link.addEventListener("click", (evento) => {
      // Ctrl/Cmd/meio: abre o link em outra aba, como qualquer link.
      if (evento.defaultPrevented || evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
      // Sem checkout o href é "#": mesmo que o pop-up não abra, o toque não joga a página para o topo.
      if (abrir(link) || !COM_CHECKOUT) evento.preventDefault();
    });
  }

  fechar.addEventListener("click", () => dialogo.close());

  // Nos primeiros 450 ms depois de abrir, nenhum clique dentro do pop-up vale: o segundo toque de
  // quem dá dois toques no botão da página caía no fundo ou no X (o pop-up abria e fechava na mesma
  // hora) ou no "Continuar para o pagamento" (ficha vazia, três erros e o teclado subindo).
  dialogo.addEventListener(
    "click",
    (evento) => {
      if (Date.now() - abertoEm >= 450) return;
      evento.preventDefault();
      evento.stopPropagation();
    },
    true
  );

  // Clique no fundo escuro fecha. O toque tem que COMEÇAR no fundo (e depois daqueles 450 ms):
  // quem seleciona o texto de um campo e solta o mouse fora do cartão não pode perder o que digitou.
  let apertouNoFundo = false;
  dialogo.addEventListener("pointerdown", (evento) => {
    apertouNoFundo = evento.target === dialogo && Date.now() - abertoEm > 450;
  });
  dialogo.addEventListener("click", (evento) => {
    if (evento.target === dialogo && apertouNoFundo) dialogo.close();
    apertouNoFundo = false;
  });

  // Esc (evento cancel) e o X fecham pelo próprio <dialog>; o foco volta ao botão que abriu.
  dialogo.addEventListener("close", () => {
    if (indo || !abertoPor) return;
    focar(abertoPor);
  });

  if (!COM_CHECKOUT) {
    pronto.voltar.addEventListener("click", () => dialogo.close());
    // Número errado (o link chega pelo WhatsApp): volta ao formulário, com o que ela mandou, para
    // trocar e enviar de novo.
    pronto.corrigir.addEventListener("click", () => {
      recebida = false;
      mostrarTela(false);
      focar(campos.whatsapp);
    });
  }

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
    // A régua da tela não sabe do domínio sem caixa de entrada (só o servidor consulta): guarda a
    // recusa para ela não sumir no próximo blur com o e-mail igual.
    const recusa = camposErro && typeof camposErro.email === "string" ? camposErro.email : "";
    recusaDoEmail = recusa ? { email: L.normalizeEmail(campos.email.value), mensagem: recusa } : null;
    if (primeiro) campos[primeiro].focus();
    else status.textContent = "Confere os seus dados, por favor.";
  }

  // Quem sai do campo tocando num botão ou link do pop-up (o de enviar, "Ir direto para o
  // pagamento", a sugestão do e-mail) não pode ver o alvo fugir do dedo: mostrar ou tirar um erro
  // no blur empurra o que está embaixo, e o toque cai no vazio. Nesse caso o blur não mexe na tela
  // — o próprio envio valida e mostra tudo. Quem encerra o "apertando" é o CLIQUE, e não um timer.
  let apertandoBotao = false;
  let soltarTimer = 0;
  function soltarBotao() {
    window.clearTimeout(soltarTimer);
    apertandoBotao = false;
  }
  dialogo.addEventListener(
    "pointerdown",
    (evento) => {
      const alvo = evento.target && typeof evento.target.closest === "function" ? evento.target.closest("button, a") : null;
      if (!alvo) return;
      apertandoBotao = true;
      window.clearTimeout(soltarTimer);
      soltarTimer = window.setTimeout(soltarBotao, 1000);
    },
    true
  );
  dialogo.addEventListener("click", soltarBotao, true);
  dialogo.addEventListener("pointercancel", soltarBotao, true);

  for (const campo of ORDEM) {
    campos[campo].addEventListener("blur", () => {
      if (apertandoBotao || !dialogo.open) return;
      if (campos[campo].value.trim() || tentouEnviar) validarCampo(campo);
      if (campo === "email") {
        if (recusaDoEmail && !erroLocal("email") && L.normalizeEmail(campos.email.value) === recusaDoEmail.email) {
          mostrarErro("email", recusaDoEmail.mensagem);
        }
        atualizarSugestao(false);
      }
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
    // aria-disabled, e não disabled: o botão desligado perdia o foco para o <body>, atrás do
    // pop-up, e quem usa teclado ou leitor de tela ficava sem saber o que acontecia. O "enviando"
    // já barra o segundo envio (ver o submit).
    botao.setAttribute("aria-disabled", sim ? "true" : "false");
    botao.setAttribute("aria-busy", sim ? "true" : "false");
    botaoTexto.textContent = sim ? ROTULO_ENVIANDO : ROTULO_BOTAO;
    if (sim) anunciar(ROTULO_ENVIANDO);
  }

  // Voltando do checkout pelo botão "voltar" (inclusive do bfcache): o botão volta a funcionar,
  // e o pop-up continua aberto com o que ela digitou, para conferir e seguir de novo.
  window.addEventListener("pageshow", () => {
    indo = false;
    if (enviando) carregando(false);
  });

  const CABECALHOS = { "Content-Type": "text/plain;charset=UTF-8" };

  /* ------------------------------------------------------------------ rascunho: quem começa e desiste */
  /*
   * O que a pessoa digita ANTES de enviar sobe para o /api/inscricao/parcial do paginas e aparece no
   * painel, na lista "Não terminaram" da aba da Formação, com o WhatsApp pronto para a equipe
   * chamar. É o mesmo rascunho do formulário da Aferição (paginas/js/inscricao.js), e as regras são
   * as dele, em ordem de importância:
   *   1. NADA aqui atrapalha a venda: é disparo sem espera, em try/catch, e o envio de verdade não
   *      depende de resposta nenhuma daqui.
   *   2. Quem envia some da lista: no envio o rascunho desliga (fichaEnviada), e o paginas ainda
   *      esconde o rascunho de quem tem inscrição na página (mesmo aparelho, e-mail ou WhatsApp).
   *   3. Sem rajada: o mesmo conteúdo não sai duas vezes, e entre duas gravações há um intervalo
   *      mínimo. Saindo da página (ou fechando o pop-up), vale na hora, por beacon.
   * Vai como text/plain, como a ficha: sem preflight, e o paginas aceita assim das origens liberadas.
   */
  const API_PARCIAL = API.replace(/\/api\/inscricao\/?$/, "/api/inscricao/parcial");
  /** Parou de digitar por este tempo: o rascunho sobe. */
  const RASCUNHO_ESPERA_MS = 1200;
  /** Duas gravações nunca saem mais perto que isto (a não ser saindo da página). */
  const RASCUNHO_INTERVALO_MS = 2500;
  let rascunhoAssinatura = "";
  let rascunhoEnviadoEm = 0;
  let rascunhoTimer = 0;
  let fichaEnviada = false;
  let ultimoCampo = "";

  function agendarRascunho(ms) {
    window.clearTimeout(rascunhoTimer);
    rascunhoTimer = window.setTimeout(() => salvarRascunho(), ms);
  }

  function mandarRascunho(corpo, saindo) {
    // Saindo, o beacon é o único que o navegador promete entregar (com string, vai como text/plain).
    try {
      if (saindo && navigator.sendBeacon && navigator.sendBeacon(API_PARCIAL, corpo)) return;
    } catch {
      // Beacon recusado (tamanho, webview): tenta o fetch.
    }
    try {
      window
        .fetch(API_PARCIAL, { method: "POST", mode: "cors", credentials: "omit", headers: CABECALHOS, body: corpo, keepalive: true })
        .catch(() => {});
      return;
    } catch {
      // fetch recusado: última tentativa pelo beacon.
    }
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(API_PARCIAL, corpo);
    } catch {
      // Sem jeito de gravar o rascunho. A página continua exatamente igual.
    }
  }

  /** `saindo` = fechando o pop-up ou a página: é a última chance de gravar. */
  function salvarRascunho({ saindo = false } = {}) {
    if (fichaEnviada || API_PARCIAL === API) return;
    window.clearTimeout(rascunhoTimer);
    const nome = campos.nome.value.trim();
    const whatsapp = campos.whatsapp.value.trim();
    const email = campos.email.value.trim();
    // Pop-up em branco (só abriu e fechou): não existe rascunho.
    if (!nome && !whatsapp && !email) return;

    const assinatura = `${nome}|${whatsapp}|${email}|${ultimoCampo}`;
    if (assinatura === rascunhoAssinatura) return;

    const desde = Date.now() - rascunhoEnviadoEm;
    if (!saindo && rascunhoEnviadoEm && desde < RASCUNHO_INTERVALO_MS) {
      agendarRascunho(RASCUNHO_INTERVALO_MS - desde);
      return;
    }

    rascunhoAssinatura = assinatura;
    rascunhoEnviadoEm = Date.now();
    try {
      mandarRascunho(
        JSON.stringify({
          pagina: pagina.id,
          visitante_id: visitanteDoAparelho(),
          contato: { nome, whatsapp, email },
          ultimo_campo: ultimoCampo || null,
          rastreio: rastreioAtual()
        }),
        saindo
      );
    } catch {
      // Nem montar o corpo pode derrubar a página.
    }
  }

  for (const campo of ORDEM) {
    campos[campo].addEventListener("focus", () => {
      ultimoCampo = campo;
    });
    campos[campo].addEventListener("input", () => {
      ultimoCampo = campo;
      // Parou de digitar: o rascunho sobe sozinho, sem esperar a pessoa sair do campo.
      agendarRascunho(RASCUNHO_ESPERA_MS);
    });
    // Saiu do campo: o que está nele já vale como rascunho, mesmo que ela pare aqui.
    campos[campo].addEventListener("blur", () => salvarRascunho());
  }
  // Fechou o pop-up sem enviar, trocou de aba, minimizou ou saiu da página: grava na hora. No
  // celular é no visibilitychange que a página costuma morrer, e não no pagehide; a assinatura
  // impede a gravação dobrada.
  dialogo.addEventListener("close", () => salvarRascunho({ saindo: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") salvarRascunho({ saindo: true });
  });
  window.addEventListener("pagehide", () => salvarRascunho({ saindo: true }));

  /**
   * Com checkout: o link que a API devolve só vale se for o checkout do produto do config (mesmo
   * caminho em pay.hotmart.com). Qualquer outra coisa (API trocada, deploy errado) vira o plano B:
   * a página nunca leva o contato da pessoa para outro endereço.
   */
  const CAMINHO_CHECKOUT = String(pagina.checkout || "").split(/[?#]/)[0].toLowerCase();
  function checkoutConfiavel(url) {
    return typeof url === "string" && Boolean(CAMINHO_CHECKOUT) && url.split(/[?#]/)[0].toLowerCase() === CAMINHO_CHECKOUT;
  }

  /**
   * Pergunta ao paginas, com prazo. O prazo é um Promise.race, e não só o AbortController: em
   * navegador sem abort (ou resposta que trava no meio do corpo), a pessoa segue do mesmo jeito.
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
          // Sem cookie: o paginas não precisa saber de sessão nenhuma para gravar a ficha.
          credentials: "omit",
          // text/plain = "simple request": sem preflight OPTIONS. O paginas aceita o JSON assim só
          // das origens liberadas.
          headers: CABECALHOS,
          body: corpo,
          signal: controle ? controle.signal : undefined
        });
        const dados = await resposta.json().catch(() => null);
        if (resposta.status === 422 && dados && dados.error === "invalid_contact") {
          return { tipo: "contato", campos: dados.campos };
        }
        if (resposta.ok && dados && dados.ok) {
          // Captação: a ficha está gravada, e a resposta vem com checkout null.
          if (!COM_CHECKOUT) return { tipo: "ok", checkout: "" };
          if (checkoutConfiavel(dados.checkout)) return { tipo: "ok", checkout: dados.checkout };
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
   * que é o único tipo que ele consegue mandar para outro site; fetch keepalive é a reserva. O
   * paginas junta pelo contato (página + WhatsApp + e-mail): a mesma ficha não vira duas.
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
      // Sem jeito de avisar.
    }
  }

  function irParaOCheckout(url, idEvento) {
    indo = true;
    initiateCheckout(abertoPor, idEvento);
    // ("Abrindo o pagamento…" já foi anunciado no carregando.) href e não replace: a pessoa pode querer voltar para conferir o que digitou.
    window.location.href = url;
  }

  /** Com checkout, depois de 2 recusas: a saída sem formulário, o link do botão já com as UTMs e o sck. */
  function contarRecusa() {
    recusas += 1;
    if (!COM_CHECKOUT || recusas < RECUSAS_PARA_SAIDA || !saida.caixa || !saida.link) return;
    const destino = (abertoPor && abertoPor.getAttribute("href")) || "";
    if (/^https:\/\/pay\.hotmart\.com\//i.test(destino)) saida.link.setAttribute("href", destino);
    saida.caixa.hidden = false;
  }

  if (COM_CHECKOUT && saida.link) {
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

    // Com checkout: o link ORIGINAL do botão tocado (sem as UTMs do passo 1), de onde o servidor
    // tira só a oferta. Sem checkout não há link nenhum para mandar.
    const base = COM_CHECKOUT ? (abertoPor && abertoPor.getAttribute("data-checkout-base")) || pagina.checkout : "";
    const rastreio = rastreioAtual();
    const idPedido = novoUuid();
    // Quem já foi contada como Lead neste aparelho, com o MESMO contato, não vira Lead de novo ao
    // enviar outra vez (a página pode ter recarregado).
    const anterior = lerJson(CHAVE_INSCRICAO);
    const mesmoContato =
      Boolean(anterior && anterior.inscrito && anterior.contato) &&
      anterior.contato.nome === contato.nome &&
      anterior.contato.whatsapp === contato.whatsapp &&
      anterior.contato.email === contato.email;
    const pedido = { pagina: pagina.id, id: idPedido, visitante_id: visitanteDoAparelho(), contato, rastreio };
    if (base) pedido.checkout = base;
    const corpo = JSON.stringify(pedido);

    // A partir daqui o rascunho desliga: ela TERMINOU, e a saída para o checkout não pode virar um
    // "não terminou" no painel.
    fichaEnviada = true;
    window.clearTimeout(rascunhoTimer);
    carregando(true);

    const resultado = await pedirAoServidor(corpo);
    if (resultado.tipo === "contato") {
      // O servidor recusou o contato: ela continua aqui, corrigindo. O rascunho volta a valer.
      fichaEnviada = false;
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

    if (!COM_CHECKOUT) {
      // Captação: sem a resposta do paginas, a ficha vai de novo por beacon. A pessoa fica na
      // página, com o "Ficha recebida" e o número que ela mandou, para conferir.
      if (resultado.tipo !== "ok") avisarServidor(corpo);
      carregando(false);
      recebida = true;
      pronto.whatsapp.textContent = contato.whatsapp;
      mostrarTela(true);
      focar(pronto.titulo);
      return;
    }

    let destino = resultado.tipo === "ok" ? resultado.checkout : "";
    if (!destino) {
      // Plano B: a mesma URL que o servidor montaria (mesma oferta, UTMs, sck e contato), montada
      // aqui. A venda não espera ninguém.
      try {
        destino = C.urlDoCheckout(pagina, { base, utm: utmDoRastreio(rastreio), contato });
      } catch {
        // Nem um link que não se monta pode prender a pessoa no "Abrindo o pagamento…": vai o link
        // do botão tocado, sem o contato.
        destino = (abertoPor && abertoPor.getAttribute("href")) || pagina.checkout;
      }
      avisarServidor(corpo);
    }

    irParaOCheckout(destino, idPedido);
  });

  // Daqui em diante é este arquivo que cuida do toque nos botões: o script inline do index.html
  // para de segurar. O toque que ele já segurou (dado antes de este arquivo chegar) abre agora.
  window.EVPreFormularioAtivo = true;
  const pedida = window.EVFichaPedida;
  window.EVFichaPedida = null;
  if (pedida && BOTOES.includes(pedida)) abrir(pedida);
})();
