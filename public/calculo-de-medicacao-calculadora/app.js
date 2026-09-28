/* Tela da calculadora. As contas e conferencias ficam em calc.js. */
(function () {
  'use strict';

  var MEDS = window.MEDICAMENTOS.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
  var C = window.CALC;
  var esc = C.esc, fmt = C.fmt;
  var TODAS_VIAS = ['IV', 'IM', 'SC', 'VO'];

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  var med = null;          // medicamento escolhido
  var ultimo = null;       // ultimo resultado desenhado

  // ------------------------------------------------------------------ abas
  var abas = $$('[role="tab"]');
  abas.forEach(function (aba, i) {
    aba.addEventListener('click', function () { abrirAba(aba); });
    aba.addEventListener('keydown', function (ev) {
      var d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
      if (d) { var prox = abas[(i + d + abas.length) % abas.length]; abrirAba(prox); prox.focus(); }
    });
  });
  function abrirAba(aba) {
    abas.forEach(function (a) {
      var sel = a === aba;
      a.setAttribute('aria-selected', sel);
      a.tabIndex = sel ? 0 : -1;
      document.getElementById(a.getAttribute('aria-controls')).hidden = !sel;
    });
  }

  // ------------------------------------------------------------------ eco dos numeros
  // Mostra embaixo do campo como o numero foi lido. Pega "1.500" (ambiguo) antes do calculo.
  function ligarEco(input, eco, unidade) {
    function atualizar() {
      var r = C.lerNumero(input.value);
      eco.classList.toggle('erro', !!r.erro);
      if (r.vazio) eco.textContent = '';
      else if (r.erro) eco.textContent = '⚠ ' + r.erro.charAt(0).toUpperCase() + r.erro.slice(1);
      else eco.textContent = 'lido como: ' + fmt(r.valor, 6) + (unidade ? ' ' + unidade() : '');
      input.setAttribute('aria-invalid', r.erro ? 'true' : 'false');
    }
    input.addEventListener('input', atualizar);
    atualizar();
    return atualizar;
  }

  // ------------------------------------------------------------------ passo 1: medicamento
  var busca = $('#busca'), lista = $('#lista-med');

  function desenharLista() {
    var q = C.norm(busca.value).trim();
    var itens = MEDS.filter(function (m) {
      return !q || C.norm(m.nome + ' ' + m.sinonimos + ' ' + m.classe).indexOf(q) >= 0;
    });
    lista.innerHTML = itens.map(function (m) {
      return '<li><button type="button" data-id="' + m.id + '"><span><span class="nm">' + esc(m.nome) + '</span><span class="cl">' + esc(m.classe) + '</span></span>' +
        (m.mav ? '<span class="tag" title="Medicamento de alta vigilância">MAV</span>' : '') + '</button></li>';
    }).join('') +
      '<li><button type="button" data-id="outro"><span><span class="nm">Outro medicamento (não está na lista)</span><span class="cl">Só faz a conta, sem conferir a dose</span></span></button></li>';
  }
  busca.addEventListener('input', desenharLista);
  lista.addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-id]');
    if (b) escolher(b.getAttribute('data-id'));
  });

  function escolher(id) {
    med = id === 'outro' ? { id: 'outro' } : MEDS.filter(function (m) { return m.id === id; })[0];
    $('#busca-area').hidden = true;
    var box = $('#med-escolhido');
    box.hidden = false;
    if (med.id === 'outro') {
      box.innerHTML = '<div class="med-sel"><div class="topo-sel"><div><h3>Outro medicamento</h3><div class="cl">Sem faixa de dose: a calculadora só faz a conta.</div></div>' +
        '<button type="button" class="btn-link" id="trocar">Trocar</button></div></div>';
    } else {
      var proib = med.viaProibida ? Object.keys(med.viaProibida).map(function (v) { return '<li>⛔ ' + esc(med.viaProibida[v]) + '</li>'; }).join('') : '';
      box.innerHTML = '<div class="med-sel"><div class="topo-sel"><div><h3>' + esc(med.nome) + (med.mav ? ' <span class="tag">MAV</span>' : '') + '</h3>' +
        '<div class="cl">' + esc(med.classe) + '</div></div><button type="button" class="btn-link" id="trocar">Trocar</button></div>' +
        (proib ? '<ul class="proib">' + proib + '</ul>' : '') + '</div>';
    }
    $('#trocar').addEventListener('click', trocar);
    montarPrescricao();
    $('#form').hidden = false;
    limparResultado();
    $('#idade').focus();
  }

  function trocar() {
    med = null;
    $('#med-escolhido').hidden = true;
    $('#busca-area').hidden = false;
    $('#form').hidden = true;
    limparResultado();
    busca.value = '';
    desenharLista();
    busca.focus();
  }

  // ------------------------------------------------------------------ passo 3: prescricao (muda com o medicamento)
  function opcoes(lista, sel) {
    return lista.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === sel ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
  }

  function montarPrescricao() {
    var h = '';
    if (med.id === 'outro') {
      h += '<label for="outro-nome">Nome do medicamento</label><input type="text" id="outro-nome" autocomplete="off">' +
        '<span class="rot">Concentração do rótulo</span>' +
        '<div class="linha"><input type="text" class="g" id="outro-qtd" inputmode="decimal" aria-label="Quantidade no rótulo" placeholder="Ex.: 500">' +
        '<select class="p" id="outro-un" aria-label="Unidade">' + opcoes([['mg', 'mg'], ['g', 'g'], ['mcg', 'mcg'], ['UI', 'UI'], ['mEq', 'mEq']]) + '</select></div>' +
        '<span class="eco" id="eco-outro-qtd"></span>' +
        '<label for="outro-ml">em quantos mL</label><input type="text" id="outro-ml" inputmode="decimal" placeholder="Ex.: 2">' +
        '<span class="eco" id="eco-outro-ml"></span>';
    } else if (med.faixas.length > 1) {
      h += '<label for="faixa">Indicação</label><select id="faixa">' + opcoes(med.faixas.map(function (f, i) { return [String(i), f.nome]; })) + '</select>';
    }
    h += '<span class="rot" id="rot-via">Via</span><div class="chips" id="vias" role="radiogroup" aria-labelledby="rot-via"></div>';
    h += '<span class="rot" id="rot-dose">Dose prescrita</span><div class="linha" role="group" aria-labelledby="rot-dose">' +
      '<input type="text" class="g" id="dose" inputmode="decimal" autocomplete="off" aria-label="Dose prescrita" aria-describedby="eco-dose">' +
      '<select class="p" id="dose-un" aria-label="Unidade da dose"></select></div><span class="eco" id="eco-dose" aria-live="polite"></span>' +
      '<p class="ajuda" id="ref-dose"></p>';
    h += '<label for="freq">Frequência</label><select id="freq">' + opcoes([['', 'Selecione…'], ['unica', 'Dose única / agora'], ['4', 'De 4 em 4 h'], ['6', 'De 6 em 6 h'],
      ['8', 'De 8 em 8 h'], ['12', 'De 12 em 12 h'], ['24', '1x ao dia (24/24 h)'], ['semanal', 'Semanal ou intervalo maior']]) + '</select>';
    if (med.id !== 'outro') {
      h += '<label for="apres">Apresentação que você tem em mãos</label><select id="apres"></select><p class="ajuda" id="apres-nota"></p>';
      h += '<div id="c-volfinal" hidden><label for="volfinal">Volume final após reconstituir (mL)</label>' +
        '<input type="text" id="volfinal" inputmode="decimal"><span class="eco" id="eco-volfinal"></span><p class="ajuda" id="volfinal-ajuda"></p></div>';
      h += '<div id="c-gotas" hidden><label for="gotasml">Gotas por mL <span class="opc">(opcional, está na bula)</span></label>' +
        '<input type="text" id="gotasml" inputmode="decimal" placeholder="Ex.: 20"><span class="eco" id="eco-gotasml"></span></div>';
    }
    h += '<div id="c-iv" hidden><span class="rot" id="rot-modo">Como vai administrar na veia?</span><div class="chips" role="radiogroup" aria-labelledby="rot-modo">' +
      '<label><input type="radio" name="modo" value="direta" checked><span id="modo-direta-txt">IV direta (bolus lento)</span></label>' +
      '<label><input type="radio" name="modo" value="diluida"><span>Diluída no soro / infusão</span></label></div>' +
      '<div id="c-inf" hidden>' +
      '<label for="soro">Volume do soro para diluir (mL)</label><input type="text" id="soro" inputmode="decimal" placeholder="Ex.: 100"><span class="eco" id="eco-soro"></span>' +
      '<div class="checks"><label><input type="checkbox" id="somar" checked> Somar o volume do medicamento ao do soro</label></div>' +
      '<span class="rot" id="rot-tempo">Tempo de infusão</span><div class="linha" role="group" aria-labelledby="rot-tempo"><input type="text" class="g" id="tempo" inputmode="decimal" aria-label="Tempo">' +
      '<select class="p" id="tempo-un" aria-label="Unidade do tempo"><option value="min">minutos</option><option value="h">horas</option></select></div><span class="eco" id="eco-tempo"></span>' +
      '<span class="rot" id="rot-acesso">Acesso venoso</span><div class="chips" role="radiogroup" aria-labelledby="rot-acesso">' +
      '<label><input type="radio" name="acesso" value="periferico" checked><span>Periférico</span></label>' +
      '<label><input type="radio" name="acesso" value="central"><span>Central</span></label></div>' +
      '</div></div>';
    $('#campos-prescricao').innerHTML = h;

    if (med.id === 'outro') {
      ligarEco($('#outro-qtd'), $('#eco-outro-qtd'), function () { return $('#outro-un').value; });
      ligarEco($('#outro-ml'), $('#eco-outro-ml'), function () { return 'mL'; });
      $('#outro-un').addEventListener('change', atualizarUnidades);
    } else {
      ligarEco($('#volfinal'), $('#eco-volfinal'), function () { return 'mL'; });
      ligarEco($('#gotasml'), $('#eco-gotasml'), function () { return 'gotas/mL'; });
      $('#apres').addEventListener('change', atualizarApresentacao);
      if ($('#faixa')) $('#faixa').addEventListener('change', function () { atualizarVias(); atualizarReferencia(); });
    }
    ligarEco($('#dose'), $('#eco-dose'), function () { return $('#dose-un').value; });
    ligarEco($('#soro'), $('#eco-soro'), function () { return 'mL'; });
    ligarEco($('#tempo'), $('#eco-tempo'), function () { return $('#tempo-un').value === 'h' ? 'h' : 'min'; });
    $('#dose-un').addEventListener('change', function () { $('#dose').dispatchEvent(new Event('input')); });
    $$('input[name="modo"]').forEach(function (r) { r.addEventListener('change', atualizarIV); });

    atualizarUnidades();
    atualizarVias();
    atualizarReferencia();
  }

  function faixaAtual() { return med.faixas ? med.faixas[Number(($('#faixa') || {}).value || 0)] : null; }
  function viaAtual() { var r = $('input[name="via"]:checked'); return r ? r.value : ''; }

  function unidadeBase() {
    if (med.id !== 'outro') return med.unidade;
    var u = $('#outro-un').value;
    return u === 'UI' || u === 'mEq' ? u : 'mg';
  }

  function atualizarUnidades() {
    var base = unidadeBase();
    var atual = $('#dose-un').value;
    var lista = C.UNIDADES_DE[base];
    $('#dose-un').innerHTML = opcoes(lista.map(function (u) { return [u, u]; }), lista.indexOf(atual) >= 0 ? atual : base);
    $('#dose').dispatchEvent(new Event('input'));
  }

  function atualizarVias() {
    var vias = med.id === 'outro' ? TODAS_VIAS : faixaAtual().vias;
    var atual = viaAtual();
    $('#vias').innerHTML = vias.map(function (v) {
      return '<label><input type="radio" name="via" value="' + v + '"' + (v === atual || vias.length === 1 ? ' checked' : '') + '><span>' + esc(C.VIA_TEXTO[v]) + '</span></label>';
    }).join('');
    $$('input[name="via"]').forEach(function (r) { r.addEventListener('change', function () { atualizarApresentacoes(); atualizarIV(); }); });
    atualizarApresentacoes();
    atualizarIV();
  }

  function atualizarApresentacoes() {
    if (med.id === 'outro') return;
    var via = viaAtual();
    var sel = $('#apres');
    var antes = sel.value;
    var ops = med.apresentacoes.map(function (a, i) { return [String(i), a]; }).filter(function (p) { return !via || p[1].vias.indexOf(via) >= 0; });
    sel.innerHTML = (ops.length > 1 ? '<option value="">Selecione…</option>' : '') +
      ops.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === antes ? ' selected' : '') + '>' + esc(p[1].nome) + '</option>'; }).join('');
    if (!via) sel.innerHTML = '<option value="">Escolha a via primeiro</option>';
    atualizarApresentacao();
  }

  function atualizarApresentacao() {
    if (med.id === 'outro') return;
    var ap = med.apresentacoes[$('#apres').value];
    var via = viaAtual();
    var ehPo = ap && ap.tipo === 'po';
    $('#c-volfinal').hidden = !ehPo;
    $('#c-gotas').hidden = !(ap && ap.gotas);
    $('#apres-nota').textContent = ap && ap.nota ? ap.nota : '';
    if (ehPo) {
      var rec = ap.reconst[via] || ap.reconst[Object.keys(ap.reconst)[0]];
      $('#volfinal').value = rec.volFinal ? String(rec.volFinal).replace('.', ',') : '';
      $('#volfinal').dispatchEvent(new Event('input'));
      $('#volfinal-ajuda').textContent = 'Diluente: ' + rec.diluente + '. ' + (rec.volFinal ? 'Valor sugerido pela bula; ajuste se o seu fabricante for diferente.' : 'Necessário só se a dose for parte do frasco.');
    }
  }

  function atualizarIV() {
    var via = viaAtual();
    var ehVeia = via === 'IV' || via === 'IO';
    $('#c-iv').hidden = !ehVeia;
    var exige = med.infusao && med.infusao.exigeDiluicao;
    var rDireta = $('input[name="modo"][value="direta"]');
    rDireta.disabled = !!exige;
    $('#modo-direta-txt').textContent = exige ? 'IV direta — proibido para este medicamento' : 'IV direta (bolus lento)';
    if (exige) $('input[name="modo"][value="diluida"]').checked = true;
    var modo = ($('input[name="modo"]:checked') || {}).value;
    $('#c-inf').hidden = !(ehVeia && modo === 'diluida');
  }

  function atualizarReferencia() {
    var p = $('#ref-dose');
    if (med.id === 'outro') { p.textContent = ''; return; }
    var f = faixaAtual();
    var t = [];
    if (f.adulto) t.push('Adulto: ' + f.adulto.texto);
    if (f.ped) t.push('Criança: ' + f.ped.texto);
    p.textContent = t.join(' · ');
  }

  // ------------------------------------------------------------------ calcular
  ligarEco($('#idade'), $('#eco-idade'), function () { return $('#idade-un').value; });
  ligarEco($('#peso'), $('#eco-peso'), function () { return 'kg'; });
  $('#idade-un').addEventListener('change', function () { $('#idade').dispatchEvent(new Event('input')); });

  // Qualquer mudanca depois do calculo esconde o resultado: nunca fica na tela um numero de outra conta.
  $('#form').addEventListener('input', resultadoVelho);
  $('#form').addEventListener('change', resultadoVelho);
  function resultadoVelho() {
    if (!ultimo) return;
    ultimo = null;
    $('#resultado').innerHTML = '<div class="erros" style="background:var(--ambar-f);border-color:var(--ambar-b)"><b style="color:var(--ambar)">Dados alterados.</b> Toque em “Calcular e conferir” de novo.</div>';
  }

  function limparResultado() {
    ultimo = null;
    $('#resultado').innerHTML = '';
    $('#erros').hidden = true;
  }

  function medParaCalculo() {
    if (med.id !== 'outro') return med;
    var nome = $('#outro-nome').value.trim() || 'Medicamento';
    var q = C.lerNumero($('#outro-qtd').value), ml = C.lerNumero($('#outro-ml').value);
    var u = $('#outro-un').value;
    if (q.vazio || q.erro || !(q.valor > 0) || ml.vazio || ml.erro || !(ml.valor > 0)) return { erro: 'Informe a concentração do rótulo (quantidade e mL).' };
    var conc = q.valor * C.FATOR[u] / ml.valor;
    return {
      id: 'outro', nome: esc(nome), classe: '', unidade: unidadeBase(), semRef: true,
      apresentacoes: [{ tipo: 'solucao', nome: fmt(q.valor) + ' ' + u + ' em ' + fmt(ml.valor) + ' mL', conc: conc, vias: TODAS_VIAS }],
      faixas: [{ nome: 'Prescrição', vias: TODAS_VIAS, adulto: null, ped: null }],
      contraindicacoes: [], alertas: ['Consulte a bula: diluição, velocidade, contraindicações e interações.']
    };
  }

  $('#form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var m = medParaCalculo();
    var errosBox = $('#erros');
    if (m.erro) return mostrarErros([m.erro]);
    var cond = {};
    $$('input[name="cond"]:checked').forEach(function (c) { cond[c.value] = true; });
    var entrada = {
      med: m,
      faixaIdx: $('#faixa') ? Number($('#faixa').value) : 0,
      idade: $('#idade').value, idadeUn: $('#idade-un').value,
      peso: $('#peso').value,
      condicoes: cond,
      alergias: $('#alergias').value,
      negaAlergias: $('#nega-alergias').checked,
      via: viaAtual(),
      dose: $('#dose').value, doseUn: $('#dose-un').value,
      freq: $('#freq').value,
      apIdx: med.id === 'outro' ? 0 : ($('#apres').value === '' ? -1 : Number($('#apres').value)),
      volFinal: $('#volfinal') ? $('#volfinal').value : '',
      gotasMl: $('#gotasml') ? $('#gotasml').value : '',
      modoIV: ($('input[name="modo"]:checked') || {}).value,
      soroVol: $('#soro').value, somarVolMed: $('#somar').checked,
      tempo: $('#tempo').value, tempoUn: $('#tempo-un').value,
      acesso: ($('input[name="acesso"]:checked') || {}).value
    };
    var r = C.conferir(entrada);
    if (r.erros.length) return mostrarErros(r.erros);
    errosBox.hidden = true;
    desenharResultado(r);
  });

  function mostrarErros(lista) {
    var box = $('#erros');
    box.innerHTML = '<b>Falta ou está errado:</b><ul>' + lista.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>';
    box.hidden = false;
    $('#resultado').innerHTML = '';
    ultimo = null;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  var SELO = { ok: 'Conferido', atencao: 'Atenção', alto: 'Confirme antes de administrar', bloqueio: 'Pare — não administre' };
  var NIVEL = { bloqueio: 'Pare', alto: 'Alerta', mav: 'Alta vigilância', atencao: 'Atenção', info: 'Informação', ok: 'Conferido' };

  function desenharResultado(r) {
    ultimo = r;
    var d = r.destaque;
    var principal =
      (d ? '<div class="destaque"><div class="r">' + esc(d.rotulo) + '</div><div class="v">' + esc(d.valor) + '</div>' +
        (d.sub ? '<div class="s">' + esc(d.sub) + '</div>' : '') + (d.seringa ? '<div class="ser">Use ' + esc(d.seringa) + '</div>' : '') + '</div>' : '') +
      '<h3 class="sec">Passo a passo</h3><ol class="passos">' + r.passos.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ol>';

    var corpo = r.bloqueado
      ? '<div class="trava"><h3>Cálculo retido por segurança</h3><p>Há um alerta vermelho de <b>parada</b> abaixo. Não administre até resolver com o prescritor e a farmácia.</p>' +
        '<div class="checks"><label><input type="checkbox" id="destravar"> O prescritor confirmou por escrito, ciente deste alerta. Quero ver o cálculo.</label></div></div>' +
        '<div id="principal" hidden>' + principal + '</div>'
      : principal;

    var html =
      '<section class="res n-' + r.nivel + '" aria-labelledby="res-tit">' +
      '<div class="res-topo"><span class="selo">' + SELO[r.nivel] + '</span><h2 id="res-tit">' + r.titulo + '</h2><p>' + esc(r.paciente) + '</p></div>' +
      '<div class="res-corpo">' + corpo +
      '<h3 class="sec">Conferência de segurança</h3><ul class="alertas">' +
      r.alertas.map(function (a) { return '<li class="' + a.nivel + '"><span class="nivel">' + NIVEL[a.nivel] + '</span><b>' + esc(a.titulo) + '</b>' + a.texto + '</li>'; }).join('') + '</ul>' +
      (r.administracao ? '<h3 class="sec">Como administrar</h3><p>' + esc(r.administracao) + '</p>' : '') +
      (r.avisos.length ? '<ul>' + r.avisos.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' : '') +
      '<details' + (r.bloqueado ? '' : ' open') + '><summary>Como a conta foi feita</summary><div class="calc">' + r.calculo.map(function (c) { return '<p>' + c + '</p>'; }).join('') +
      (r.referencia ? '<p><b>Referência:</b> ' + esc(r.referencia) + '</p>' : '') + '</div></details>' +
      (r.contraindicacoes.length ? '<details><summary>Confirme que o paciente NÃO tem (contraindicações)</summary><div class="checks ci">' +
        r.contraindicacoes.map(function (c) { return '<label><input type="checkbox"> ' + esc(c) + '</label>'; }).join('') + '</div></details>' : '') +
      '<details><summary>Checklist dos 9 certos</summary><div class="checks">' +
      ['Paciente certo (2 identificadores)', 'Medicamento certo (rótulo lido 3 vezes)', 'Via certa', 'Hora certa', 'Dose certa (conta conferida)', 'Registro certo (após administrar)', 'Orientação ao paciente', 'Forma farmacêutica certa', 'Resposta: reavaliar efeito e reações']
        .map(function (c) { return '<label><input type="checkbox"> ' + c + '</label>'; }).join('') + '</div></details>' +
      '<div class="btns"><button type="button" class="btn sec" id="copiar">Copiar resumo</button><button type="button" class="btn" id="nova">Nova conferência</button></div>' +
      '</div></section>';

    var alvo = $('#resultado');
    alvo.innerHTML = html;
    if (r.bloqueado) {
      $('#destravar').addEventListener('change', function () { $('#principal').hidden = !this.checked; });
    }
    $('#copiar').addEventListener('click', function () {
      var b = this;
      var ok = function () { b.textContent = 'Copiado ✓'; setTimeout(function () { b.textContent = 'Copiar resumo'; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(r.resumo).then(ok, function () { b.textContent = 'Não deu para copiar'; });
    });
    $('#nova').addEventListener('click', function () {
      $('#form').reset();
      trocar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    alvo.focus({ preventScroll: true });
    alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ------------------------------------------------------------------ ferramentas
  var FERR = {
    regra: function (v, f) {
      var tipos = { mg: 'm', g: 'm', mcg: 'm', UI: 'UI', mEq: 'mEq' };
      if (tipos[f.udose.value] !== tipos[f.utenho.value]) return erro('As unidades não combinam (' + f.udose.value + ' × ' + f.utenho.value + ').');
      var dose = v.dose * C.FATOR[f.udose.value], tenho = v.tenho * C.FATOR[f.utenho.value];
      var ml = dose * v.ml / tenho;
      return '<p class="v">' + C.fmtVol(ml) + '</p><p>' + fmt(v.dose) + ' ' + f.udose.value + ' × ' + fmt(v.ml) + ' mL ÷ ' + fmt(v.tenho) + ' ' + f.utenho.value + '</p>' +
        (ml > v.ml * 5 ? '<p class="erro">Mais de 5 frascos/ampolas: confira a dose e a apresentação.</p>' : '');
    },
    gotas: function (v, f) {
      var h = f.ut.value === 'h' ? v.tempo : v.tempo / 60;
      var mlh = v.vol / h;
      return '<p class="v">' + fmt(Math.round(mlh / 3), 0) + ' gotas/min</p><p><b>' + fmt(Math.round(mlh), 0) + ' microgotas/min</b> · <b>' + fmt(mlh, 1) + ' mL/h</b> na bomba</p>' +
        '<p>Conta: ' + fmt(v.vol) + ' mL ÷ (' + fmt(h, 2) + ' h × 3) = ' + fmt(mlh / 3, 1) + ' → arredonde para número inteiro.</p>';
    },
    bomba: function (v, f) {
      var u = f.udose.value, porKg = u.indexOf('/kg') >= 0;
      if (porKg && !(v.peso > 0)) return erro('Informe o peso: a dose é por kg.');
      var uq = f.uqtd.value;
      if ((u.indexOf('UI') === 0) !== (uq === 'UI')) return erro('A unidade da dose e a da solução não combinam.');
      var conc = v.qtd / v.vol; // mg/mL ou UI/mL
      var porHora; // na unidade da solucao
      var d = v.dose * (porKg ? v.peso : 1);
      if (u.indexOf('mcg') === 0) porHora = d / 1000 * 60;
      else porHora = d;
      var mlh = porHora / conc;
      return '<p class="v">' + fmt(mlh, 1) + ' mL/h</p><p>Concentração: ' + fmt(conc * (uq === 'mg' ? 1000 : 1)) + (uq === 'mg' ? ' mcg/mL' : ' UI/mL') + '</p>' +
        '<p>Conta: ' + fmt(v.dose) + ' ' + u + (porKg ? ' × ' + fmt(v.peso) + ' kg' : '') + (u.indexOf('/min') > 0 ? ' × 60 min' : '') + ' ÷ concentração = ' + fmt(mlh, 2) + ' mL/h</p>' +
        (mlh > 500 ? '<p class="erro">Vazão muito alta: confira dose, unidade e concentração.</p>' : mlh < 0.5 ? '<p class="erro">Vazão muito baixa: confira dose, unidade e concentração.</p>' : '');
    },
    soro: function (v) {
      if (!(v.cf > v.ci)) return erro('A concentração desejada precisa ser maior que a atual.');
      if (!(v.ca > v.cf)) return erro('A ampola precisa ser mais concentrada que o soro desejado.');
      var x = v.vol * (v.cf - v.ci) / (v.ca - v.ci);
      var amp = x / 10;
      return '<p class="v">' + C.fmtVol(x) + '</p><p>1) Retire <b>' + C.fmtVol(x) + '</b> do frasco de SG ' + fmt(v.ci) + '%.<br>2) Adicione <b>' + C.fmtVol(x) + '</b> de glicose ' + fmt(v.ca) + '% (≈ ' + fmt(amp, 1) + ' ampolas de 10 mL).<br>3) Fica ' + fmt(v.vol) + ' mL de SG ' + fmt(v.cf) + '%.</p>' +
        '<p>Conta: ' + fmt(v.vol) + ' × (' + fmt(v.cf) + ' − ' + fmt(v.ci) + ') ÷ (' + fmt(v.ca) + ' − ' + fmt(v.ci) + ')</p>' +
        (v.cf > 12.5 ? '<p class="erro">Acima de 12,5%: em geral só por acesso central.</p>' : '');
    },
    pct: function (v) {
      return '<p class="v">' + fmt(v.pct * 10) + ' mg/mL</p><p>' + fmt(v.pct) + '% = ' + fmt(v.pct) + ' g em 100 mL = ' + fmt(v.pct * 10) + ' mg em 1 mL</p>';
    },
    insulina: function (v, f) {
      var conc = Number(f.conc.value);
      var ml = v.ui / conc;
      return '<p class="v">' + fmt(ml, 3) + ' mL</p><p>' + fmt(v.ui) + ' UI ÷ ' + conc + ' UI/mL</p>' +
        (conc !== 100 ? '<p class="erro">Insulinas U-200 e U-300 são só para caneta: nunca aspire com seringa.</p>' : '<p>Na seringa de insulina U-100, aspire direto <b>' + fmt(v.ui, 1) + ' UI</b> (não precisa converter).</p>') +
        (v.ui > 50 ? '<p class="erro">Dose alta: confira a prescrição.</p>' : '');
    }
  };

  function erro(t) { return '<p class="erro">' + esc(t) + '</p>'; }

  $$('form[data-ferr]').forEach(function (form) {
    var tipo = form.getAttribute('data-ferr');
    var saida = $('.ferr-saida', form);
    $$('input[type="text"]', form).forEach(function (inp) {
      var eco = $('[data-eco="' + inp.name + '"]', form);
      if (eco) ligarEco(inp, eco);
    });
    function calcular() {
      var v = {}, falta = false, ruim = null;
      $$('input[type="text"]', form).forEach(function (inp) {
        var r = C.lerNumero(inp.value);
        if (r.erro) ruim = r.erro;
        else if (r.vazio) { if (!(tipo === 'bomba' && inp.name === 'peso')) falta = true; }
        else v[inp.name] = r.valor;
      });
      if (ruim) { saida.innerHTML = erro('Corrija o número marcado.'); return; }
      if (falta) { saida.innerHTML = '<p class="ajuda">Preencha os campos para ver o resultado.</p>'; return; }
      var zero = Object.keys(v).some(function (k) { return k !== 'ci' && !(v[k] > 0); });
      if (zero) { saida.innerHTML = erro('Os valores precisam ser maiores que zero.'); return; }
      saida.innerHTML = FERR[tipo](v, form.elements);
    }
    form.addEventListener('input', calcular);
    form.addEventListener('change', calcular);
    form.addEventListener('submit', function (ev) { ev.preventDefault(); });
    calcular();
  });

  desenharLista();
})();
