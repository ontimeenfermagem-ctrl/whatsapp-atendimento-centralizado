/*
 * Motor da calculadora: sem DOM, so contas e conferencias. A tela (app.js) monta a "entrada"
 * e desenha o que volta daqui. Tudo roda no aparelho: nenhum dado do paciente sai dele.
 */
(function (root) {
  'use strict';

  var FATOR = { mg: 1, g: 1000, mcg: 0.001, UI: 1, mEq: 1 };
  var UNIDADES_DE = { mg: ['mg', 'g', 'mcg'], UI: ['UI'], mEq: ['mEq'] };
  var ORDEM = { bloqueio: 0, alto: 1, mav: 2, atencao: 3, info: 4, ok: 5 };
  var DOSES_DIA = { unica: 1, semanal: 1, '4': 6, '6': 4, '8': 3, '12': 2, '24': 1 };
  var FREQ_TEXTO = { unica: 'dose única', semanal: '1x por semana', '4': 'de 4 em 4 h', '6': 'de 6 em 6 h', '8': 'de 8 em 8 h', '12': 'de 12 em 12 h', '24': '1x ao dia' };
  var VIA_TEXTO = { IV: 'endovenosa (IV)', IM: 'intramuscular (IM)', SC: 'subcutânea (SC)', VO: 'oral (VO)', IO: 'intraóssea (IO)' };

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Le numero digitado no jeito brasileiro. "1,5" = 1,5; "1.200.000" = 1200000.
  // "1.500" e ambiguo (mil e quinhentos ou 1,5?) e e recusado: e exatamente o tipo de erro
  // que da dose 1000 vezes maior.
  function lerNumero(txt) {
    if (txt == null) return { vazio: true };
    var s = String(txt).trim().replace(/\s/g, '');
    if (!s) return { vazio: true };
    if (!/^[0-9.,]+$/.test(s)) return { erro: 'use só números (vírgula para decimais).' };
    var temV = s.indexOf(',') >= 0, temP = s.indexOf('.') >= 0;
    if (temV && temP) {
      if (!/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) return { erro: '"' + txt + '" está confuso. Escreva sem pontos, ex.: 1200000 ou 1,5.' };
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (temV) {
      if (s.split(',').length > 2) return { erro: '"' + txt + '" tem mais de uma vírgula.' };
      s = s.replace(',', '.');
    } else if (temP) {
      var partes = s.split('.');
      if (partes.length > 2) {
        if (!/^\d{1,3}(\.\d{3})+$/.test(s)) return { erro: '"' + txt + '" está confuso. Escreva sem pontos.' };
        s = s.replace(/\./g, '');
      } else if (partes[1] === '000' && partes[0] !== '' && !/^0+$/.test(partes[0])) {
        s = partes[0] + partes[1]; // "600.000": ninguem escreve decimal terminando em ,000
      } else if (partes[1].length === 3 && partes[0] !== '' && !/^0+$/.test(partes[0])) {
        return { erro: '"' + txt + '" é ambíguo: escreva ' + partes[0] + partes[1] + ' (sem ponto) ou ' + partes[0] + ',' + partes[1].replace(/0+$/, '') + ' (com vírgula).' };
      }
    }
    if (s.charAt(0) === '.') s = '0' + s;
    var v = Number(s);
    if (!isFinite(v)) return { erro: 'número inválido.' };
    return { valor: v };
  }

  function fmt(n, dec) {
    if (n == null || !isFinite(n)) return '—';
    if (dec == null) dec = Math.abs(n) < 0.1 ? 4 : Math.abs(n) < 10 ? 2 : 1;
    return n.toLocaleString('pt-BR', { maximumFractionDigits: dec });
  }

  // Mostra a dose com o equivalente ao lado (1.000 mg = 1 g; 0,5 mg = 500 mcg): ajuda a ver erro de unidade.
  function fmtDose(v, un) {
    var t = fmt(v) + ' ' + un;
    if (un === 'mg' && v >= 1000) t += ' (= ' + fmt(v / 1000) + ' g)';
    else if (un === 'mg' && v < 1) t += ' (= ' + fmt(v * 1000) + ' mcg)';
    return t;
  }

  function fmtVol(v) {
    return fmt(v, v < 10 ? 2 : 1) + ' mL';
  }

  function idadeEmDias(valor, un) {
    if (un === 'dias') return valor;
    if (un === 'meses') return valor * 30.4375;
    return valor * 365.25;
  }

  function faixaEtaria(dias) {
    var a = dias / 365.25;
    if (dias < 28) return 'Recém-nascido (neonato)';
    if (dias < 365) return 'Lactente';
    if (a < 12) return 'Criança';
    if (a < 18) return 'Adolescente';
    if (a < 60) return 'Adulto';
    return 'Idoso';
  }

  function idadeTexto(valor, un) {
    var u = un === 'anos' ? (valor === 1 ? 'ano' : 'anos') : un === 'meses' ? (valor === 1 ? 'mês' : 'meses') : (valor === 1 ? 'dia' : 'dias');
    return fmt(valor, 1) + ' ' + u;
  }

  // Peso esperado pela idade (formulas do APLS). Serve so para desconfiar de peso digitado errado.
  function pesoEstimado(dias) {
    var meses = dias / 30.4375, a = dias / 365.25;
    if (meses < 12) return 0.5 * meses + 4;
    if (a <= 5) return 2 * a + 8;
    return 3 * a + 7;
  }

  function faixaTexto(ref, u) {
    if (ref.min == null) return '';
    return (ref.min === ref.max ? fmt(ref.min) : fmt(ref.min) + ' a ' + fmt(ref.max)) + ' ' + u;
  }

  // Seringa pela graduacao: o volume tem que ser medivel nela.
  function seringaPara(vol) {
    if (vol <= 1) return { nome: 'seringa de 1 mL', grad: 0.01 };
    if (vol <= 3) return { nome: 'seringa de 3 mL', grad: 0.1 };
    if (vol <= 5) return { nome: 'seringa de 5 mL', grad: 0.2 };
    if (vol <= 10) return { nome: 'seringa de 10 mL', grad: 0.2 };
    if (vol <= 20) return { nome: 'seringa de 20 mL', grad: 1 };
    return { nome: 'seringa de 60 mL (ou mais de uma seringa)', grad: 1 };
  }

  function conferir(e) {
    var erros = [], alertas = [];
    var m = e.med;
    function alerta(nivel, titulo, texto) { alertas.push({ nivel: nivel, titulo: titulo, texto: texto || '' }); }

    if (!m) return { erros: ['Escolha o medicamento.'] };

    // ---------- Paciente ----------
    var dias = null, ri = lerNumero(e.idade);
    if (ri.vazio) erros.push('Informe a idade do paciente.');
    else if (ri.erro) erros.push('Idade: ' + ri.erro);
    else {
      dias = idadeEmDias(ri.valor, e.idadeUn);
      if (dias > 120 * 365.25) { erros.push('Idade acima de 120 anos: confira a idade e a unidade (dias/meses/anos).'); dias = null; }
    }
    var anos = dias != null ? dias / 365.25 : null;

    var peso = null, rp = lerNumero(e.peso), pesoRuim = false;
    if (!rp.vazio) {
      pesoRuim = true;
      if (rp.erro) erros.push('Peso: ' + rp.erro);
      else if (rp.valor <= 0) erros.push('O peso precisa ser maior que zero.');
      else if (rp.valor > 350) erros.push('Peso acima de 350 kg: você digitou em gramas? Informe em kg (ex.: 3200 g = 3,2 kg).');
      else { peso = rp.valor; pesoRuim = false; }
    }

    var faixa = m.faixas[e.faixaIdx || 0];
    var usaPed = anos != null && (anos < 12 || (anos < 18 && peso != null && peso < 40));
    var ref = m.semRef ? null : (usaPed ? faixa.ped : faixa.adulto);
    if (anos != null && peso == null && !pesoRuim) {
      if (anos < 12) erros.push('Criança: o peso é obrigatório (dose pediátrica é por kg).');
      else if (ref && ref.porKg) erros.push('Este medicamento é dosado por kg: informe o peso.');
    }

    // ---------- Prescricao ----------
    var via = e.via;
    if (!via) erros.push('Escolha a via de administração.');

    var un = m.unidade;
    var dose = null, rd = lerNumero(e.dose);
    if (rd.vazio) erros.push('Informe a dose prescrita.');
    else if (rd.erro) erros.push('Dose: ' + rd.erro);
    else if (rd.valor <= 0) erros.push('A dose precisa ser maior que zero.');
    else if (!(e.doseUn in FATOR) || UNIDADES_DE[un].indexOf(e.doseUn) < 0) erros.push('Escolha a unidade da dose.');
    else dose = rd.valor * FATOR[e.doseUn];

    if (!e.freq || !(e.freq in DOSES_DIA)) erros.push('Escolha a frequência (ou dose única).');

    var ap = m.apresentacoes[e.apIdx];
    if (!ap) erros.push('Escolha a apresentação que você tem em mãos.');
    else if (via && ap.vias.indexOf(via) < 0) erros.push('A apresentação escolhida não serve para a via ' + via + '.');

    var volFinal = null, rec = null;
    if (ap && ap.tipo === 'po') {
      rec = (via && ap.reconst[via]) || ap.reconst[Object.keys(ap.reconst)[0]];
      var rv = lerNumero(e.volFinal);
      if (!rv.vazio) {
        if (rv.erro) erros.push('Volume final: ' + rv.erro);
        else if (rv.valor <= 0) erros.push('O volume final precisa ser maior que zero.');
        else volFinal = rv.valor;
      }
    }

    var gotasMl = null;
    if (ap && ap.gotas) {
      var rg = lerNumero(e.gotasMl);
      if (!rg.vazio) {
        if (rg.erro) erros.push('Gotas por mL: ' + rg.erro);
        else if (rg.valor <= 0 || rg.valor > 60) erros.push('Gotas por mL fora do esperado (em geral 20 a 40): confira na bula.');
        else gotasMl = rg.valor;
      }
    }

    var ehVeia = via === 'IV' || via === 'IO';
    var infusao = null;
    if (ehVeia && e.modoIV === 'diluida') {
      var rs = lerNumero(e.soroVol), rt = lerNumero(e.tempo);
      if (rs.vazio) erros.push('Informe o volume do soro para diluir.');
      else if (rs.erro) erros.push('Volume do soro: ' + rs.erro);
      else if (rs.valor <= 0) erros.push('O volume do soro precisa ser maior que zero.');
      if (rt.vazio) erros.push('Informe o tempo de infusão.');
      else if (rt.erro) erros.push('Tempo: ' + rt.erro);
      else if (rt.valor <= 0) erros.push('O tempo precisa ser maior que zero.');
      if (!rs.vazio && !rs.erro && rs.valor > 0 && !rt.vazio && !rt.erro && rt.valor > 0) {
        infusao = { soro: rs.valor, minutos: e.tempoUn === 'h' ? rt.valor * 60 : rt.valor };
      }
    }

    if (erros.length) return { erros: erros };

    // ---------- Contas ----------
    var dosesDia = DOSES_DIA[e.freq];
    var dia = dose * dosesDia;
    var ctx = { idadeDias: dias, anos: anos, peso: peso, via: via, faixa: faixa, ap: ap, dia: dia, usaPed: usaPed };
    var passos = [];      // o que fazer, em ordem (HTML seguro)
    var calculo = [];     // a conta mostrada passo a passo
    var destaque = null;  // o numero principal
    var vol = null;

    if (ap.tipo === 'solucao') {
      vol = dose / ap.conc;
      calculo.push('Concentração: <b>' + fmt(ap.conc) + ' ' + un + ' em 1 mL</b>.');
      calculo.push('Regra de três: ' + fmt(ap.conc) + ' ' + un + ' — 1 mL · ' + fmt(dose) + ' ' + un + ' — x');
      calculo.push('x = ' + fmt(dose) + ' ÷ ' + fmt(ap.conc) + ' = <b>' + fmtVol(vol) + '</b>');
      if (ap.insulina) {
        destaque = { rotulo: 'Aspire na seringa de insulina', valor: fmt(dose, 1) + ' UI', sub: '= ' + fmtVol(vol) + ' da insulina 100 UI/mL' };
        passos.push('Confira a glicemia capilar antes.');
        passos.push('Use seringa de <b>insulina U-100</b> (graduada em UI) e aspire <b>' + fmt(dose, 1) + ' UI</b>.');
      } else {
        destaque = { rotulo: 'Aspire', valor: fmtVol(vol), sub: 'de ' + ap.nome };
        if (ap.vol) {
          var nAmp = Math.ceil(vol / ap.vol - 1e-9);
          passos.push('Separe <b>' + nAmp + ' ' + (nAmp > 1 ? 'unidades' : 'unidade') + '</b> de ' + ap.nome + '.');
          if (nAmp > 5) alerta('atencao', 'Muitas ampolas (' + nAmp + ')', 'Número alto de ampolas costuma indicar apresentação ou dose errada. Confira a concentração no rótulo.');
        }
        passos.push('Aspire <b>' + fmtVol(vol) + '</b> (' + fmtDose(dose, un) + ').');
      }
    } else if (ap.tipo === 'po') {
      var nFr = Math.ceil(dose / ap.total - 1e-9);
      var frascosInteiros = Math.abs(dose / ap.total - Math.round(dose / ap.total)) < 1e-9;
      passos.push('Separe <b>' + nFr + ' ' + (nFr > 1 ? 'frascos' : 'frasco') + '</b> de ' + ap.nome + '.');
      passos.push('Reconstitua cada frasco com <b>' + esc(rec.diluente) + '</b>' + (volFinal ? ' (volume final: <b>' + fmtVol(volFinal) + '</b>)' : '') + '.');
      if (volFinal) {
        var conc = ap.total / volFinal;
        vol = dose / conc;
        calculo.push('Frasco de ' + fmtDose(ap.total, un) + ' reconstituído fica com ' + fmtVol(volFinal) + ' → <b>' + fmt(conc) + ' ' + un + ' por mL</b>.');
        calculo.push('Regra de três: ' + fmt(ap.total) + ' ' + un + ' — ' + fmt(volFinal) + ' mL · ' + fmt(dose) + ' ' + un + ' — x');
        calculo.push('x = ' + fmt(dose) + ' × ' + fmt(volFinal) + ' ÷ ' + fmt(ap.total) + ' = <b>' + fmtVol(vol) + '</b>');
        destaque = { rotulo: 'Aspire', valor: fmtVol(vol), sub: frascosInteiros ? 'todo o conteúdo de ' + nFr + ' frasco' + (nFr > 1 ? 's' : '') : 'da solução reconstituída (' + fmt(conc) + ' ' + un + '/mL)' };
        passos.push('Aspire <b>' + fmtVol(vol) + '</b> (' + fmtDose(dose, un) + ')' + (frascosInteiros ? ' = todo o conteúdo.' : '.'));
        if (!frascosInteiros) passos.push('Despreze o que sobrar ou guarde conforme a estabilidade da bula/CCIH (identifique data, hora e concentração).');
      } else if (frascosInteiros) {
        destaque = { rotulo: 'Use', valor: nFr + ' frasco' + (nFr > 1 ? 's' : '') + ' inteiro' + (nFr > 1 ? 's' : ''), sub: 'aspire todo o conteúdo reconstituído' };
        calculo.push('A dose (' + fmtDose(dose, un) + ') é exatamente ' + nFr + ' frasco(s) de ' + fmtDose(ap.total, un) + ': aspire tudo.');
        passos.push('Aspire <b>todo o conteúdo</b>.');
      } else {
        return { erros: ['A dose é só parte do frasco: informe o volume final após reconstituir (veja na bula ou meça na seringa).'] };
      }
      if (ap.nota) calculo.push('<i>' + esc(ap.nota) + '</i>');
      if (nFr > 4) alerta('atencao', 'Muitos frascos (' + nFr + ')', 'Confira se a dose e a apresentação estão certas.');
    } else if (ap.tipo === 'solido') {
      var n = dose / ap.qtd;
      destaque = { rotulo: 'Dar', valor: fmt(n, 2) + ' ' + (n === 1 ? 'unidade' : 'unidades'), sub: 'de ' + ap.nome };
      calculo.push(fmt(dose) + ' ' + un + ' ÷ ' + fmt(ap.qtd) + ' ' + un + ' = <b>' + fmt(n, 2) + '</b>');
      passos.push('Dê <b>' + fmt(n, 2) + ' ' + (n === 1 ? 'unidade' : 'unidades') + '</b> de ' + ap.nome + ' (' + fmtDose(dose, un) + ').');
      if (Math.abs(n * 2 - Math.round(n * 2)) > 0.01) alerta('alto', 'Fração de comprimido que não dá para medir', fmt(n, 2) + ' unidade(s) não é uma metade ou inteira. Peça a forma líquida ou confirme a dose.');
      else if (n % 1 !== 0 && !ap.sulcado) alerta('alto', 'Esta forma não deve ser partida', 'Cápsula/drágea/comprimido sem sulco não se divide. Peça outra apresentação.');
      if (n > 4) alerta('atencao', 'Muitas unidades (' + fmt(n, 1) + ')', 'Confira se a apresentação e a dose estão certas.');
    }

    // Volume medivel na seringa (nao vale para comprimido nem insulina, que se mede em UI)
    if (vol != null && !ap.insulina) {
      var ser = seringaPara(vol);
      var arred = Math.round(vol / ser.grad) * ser.grad;
      var dif = Math.abs(arred - vol) / vol;
      destaque.seringa = (via === 'VO' ? 'seringa dosadora ORAL (nunca a de injeção) — ' : '') + ser.nome +' (marca de ' + fmt(ser.grad, 2) + ' em ' + fmt(ser.grad, 2) + ' mL)';
      if (dif > 0.05) alerta('alto', 'Volume não é medível com precisão', fmtVol(vol) + ' na ' + ser.nome + ' vira ' + fmtVol(arred) + ' (' + fmt(dif * 100, 0) + '% de diferença). Use uma seringa menor ou peça diluição à farmácia.');
      else if (dif > 0.02) alerta('atencao', 'Arredondamento na seringa', 'Na ' + ser.nome + ' você vai medir ' + fmtVol(arred) + ' (' + fmt(dif * 100, 0) + '% de diferença da dose exata).');
      if (vol < 0.1) alerta('atencao', 'Volume muito pequeno (' + fmtVol(vol) + ')', 'Erro de uma marquinha já muda muito a dose. Use seringa de 1 mL ou dilua para medir com segurança.');
    }
    if (ap.insulina && Math.abs(dose - Math.round(dose)) > 1e-9) {
      alerta('atencao', 'Meia unidade de insulina', 'Só é possível medir ' + fmt(dose, 1) + ' UI em seringa graduada de 0,5 em 0,5 UI. Confirme com o prescritor.');
    }

    // Gotas (VO)
    if (ap.gotas && vol != null) {
      if (gotasMl) {
        var ng = vol * gotasMl;
        destaque.sub = '= ' + fmtVol(vol) + ' de ' + ap.nome;
        destaque.rotulo = 'Dar';
        destaque.valor = fmt(Math.round(ng), 0) + ' gotas';
        calculo.push(fmtVol(vol) + ' × ' + fmt(gotasMl) + ' gotas/mL = ' + fmt(ng, 1) + ' → <b>' + fmt(Math.round(ng), 0) + ' gotas</b>');
        passos[passos.length - 1] = 'Pingue <b>' + fmt(Math.round(ng), 0) + ' gotas</b> (' + fmtVol(vol) + ', ' + fmtDose(dose, un) + ').';
        delete destaque.seringa;
      } else {
        alerta('info', 'Quer em gotas?', 'Informe quantas gotas formam 1 mL (está na bula do fabricante) para converter. Com seringa dosadora oral, dê ' + fmtVol(vol) + '.');
      }
    }

    // Volume por via
    if (vol != null && !ap.insulina) {
      if (via === 'IM') {
        var limIM = anos < 3 ? 1 : anos < 12 ? 2 : 5;
        if (vol > limIM) alerta('alto', 'Volume grande para uma só aplicação IM', fmtVol(vol) + ' passa do limite de ~' + fmt(limIM) + ' mL por local para ' + (anos < 12 ? 'essa idade' : 'adulto') + '. Divida em dois locais.');
        else if (anos >= 12 && vol > 3) alerta('atencao', 'Volume IM acima de 3 mL', 'Não use o deltoide (até 2 mL). Prefira ventroglúteo ou vasto lateral.');
        else if (anos >= 12 && vol > 2) alerta('info', 'Local da aplicação IM', 'Acima de 2 mL: evite o deltoide.');
      }
      if (via === 'SC' && vol > 1.5) alerta('alto', 'Volume grande para via SC', 'SC costuma aceitar até ~1–1,5 mL por local. Confira a prescrição.');
    }

    // ---------- Via ----------
    if (m.viaProibida && m.viaProibida[via]) alerta('bloqueio', 'Via proibida', m.viaProibida[via]);
    if (faixa.vias.indexOf(via) < 0) alerta('alto', 'Via incomum para esta indicação', 'A via ' + via + ' não é a usual para "' + faixa.nome + '".');

    // ---------- IV: direta ou diluida ----------
    var inf = m.infusao || {};
    var admin = { direta: null, infusao: null };
    if (ehVeia) {
      if (e.modoIV !== 'diluida') {
        if (inf.exigeDiluicao) alerta('bloqueio', 'Proibido IV direto', m.nome + ' precisa ser diluído e infundido. ' + ((m.administracao || {}).IV || ''));
        var tmin = inf.minutosIVDireta || 0;
        if (inf.taxaMaxMin) tmin = Math.max(tmin, dose / inf.taxaMaxMin);
        if (tmin > 0) {
          admin.direta = tmin;
          passos.push('Aplique <b>lentamente, em no mínimo ' + (tmin < 1 ? fmt(tmin * 60, 0) + ' segundos' : fmt(Math.ceil(tmin * 2) / 2, 1) + ' min') + '</b>.');
          if (inf.taxaMaxMin) calculo.push('Velocidade máxima ' + fmt(inf.taxaMaxMin) + ' ' + un + '/min → ' + fmt(dose) + ' ÷ ' + fmt(inf.taxaMaxMin) + ' = ' + fmt(dose / inf.taxaMaxMin, 1) + ' min no mínimo.');
        }
      } else if (infusao) {
        var volTotal = infusao.soro + (e.somarVolMed && vol != null ? vol : 0);
        var horas = infusao.minutos / 60;
        var mlh = volTotal / horas;
        var concF = dose / volTotal;
        var taxaMin = dose / infusao.minutos;
        var taxaH = taxaMin * 60;
        admin.infusao = { volTotal: volTotal, mlh: mlh, gotas: mlh / 3, micro: mlh, concF: concF };
        passos.push('Adicione ao soro de <b>' + fmtVol(infusao.soro) + '</b> e homogeneíze (inverta a bolsa várias vezes). Rotule: nome, dose, hora, quem preparou.');
        passos.push('Infunda em <b>' + (infusao.minutos >= 60 ? fmt(horas, 2) + ' h' : fmt(infusao.minutos, 0) + ' min') + '</b>: bomba a <b>' + fmt(mlh, 1) + ' mL/h</b> ou <b>' + fmt(Math.round(mlh / 3), 0) + ' gotas/min</b> (macrogotas) ou <b>' + fmt(Math.round(mlh), 0) + ' microgotas/min</b>.');
        calculo.push('Volume total: ' + fmtVol(infusao.soro) + (e.somarVolMed && vol != null ? ' + ' + fmtVol(vol) + ' do medicamento' : '') + ' = <b>' + fmtVol(volTotal) + '</b>');
        calculo.push('Vazão: ' + fmt(volTotal, 1) + ' mL ÷ ' + fmt(horas, 2) + ' h = <b>' + fmt(mlh, 1) + ' mL/h</b>');
        calculo.push('Macrogotas (20 gotas/mL): mL/h ÷ 3 = ' + fmt(mlh / 3, 1) + ' → <b>' + fmt(Math.round(mlh / 3), 0) + ' gotas/min</b>');
        calculo.push('Microgotas (60 microgotas/mL): igual ao mL/h → <b>' + fmt(Math.round(mlh), 0) + ' microgotas/min</b>');
        var fc = inf.fatorConc || 1, uc = inf.unidadeConc || (un + '/mL');
        calculo.push('Concentração final: ' + fmt(dose) + ' ' + un + ' ÷ ' + fmt(volTotal, 1) + ' mL = <b>' + fmt(concF * fc) + ' ' + uc + '</b>');

        var perif = e.acesso !== 'central';
        if (perif && inf.maxConcPerif) {
          if (inf.maxConcPerifAlta && concF > inf.maxConcPerifAlta * 1.0001) alerta('alto', 'Concentração alta demais para veia periférica', fmt(concF * fc) + ' ' + uc + ' (limite ~' + fmt(inf.maxConcPerifAlta * fc) + '). Aumente o volume do soro ou use acesso central.');
          else if (concF > inf.maxConcPerif * 1.0001) alerta(inf.maxConcPerifAlta ? 'atencao' : 'alto', 'Concentração acima do recomendado para veia periférica', fmt(concF * fc) + ' ' + uc + ' (recomendado até ' + fmt(inf.maxConcPerif * fc) + '). Risco de flebite e dor.');
        }
        if (!perif && inf.maxConcCentral && concF > inf.maxConcCentral * 1.0001) alerta('alto', 'Concentração acima do limite', fmt(concF * fc) + ' ' + uc + ' (máximo ' + fmt(inf.maxConcCentral * fc) + ' mesmo em acesso central).');
        if (inf.taxaMaxMin && taxaMin > inf.taxaMaxMin * 1.0001) alerta('alto', 'Infusão rápida demais', fmt(taxaMin, 1) + ' ' + un + '/min (máximo ' + fmt(inf.taxaMaxMin) + '). Tempo mínimo: ' + fmt(Math.ceil(dose / inf.taxaMaxMin), 0) + ' min.');
        if (inf.tempoMin && infusao.minutos < inf.tempoMin) alerta('alto', 'Tempo de infusão curto', 'Mínimo recomendado: ' + inf.tempoMin + ' min.');
        var lh = perif ? inf.taxaMaxHoraPerif : inf.taxaMaxHoraCentral;
        if (lh) {
          calculo.push('Velocidade: ' + fmt(dose) + ' ' + un + ' ÷ ' + fmt(horas, 2) + ' h = <b>' + fmt(taxaH, 1) + ' ' + un + '/h</b>');
          if (taxaH > lh * 1.0001) alerta('alto', 'Velocidade acima do máximo', fmt(taxaH, 1) + ' ' + un + '/h em acesso ' + (perif ? 'periférico' : 'central') + ' (máximo ' + fmt(lh) + ' ' + un + '/h). Tempo mínimo: ' + fmt(dose / lh, 1) + ' h.');
          else if (!perif && inf.taxaMaxHoraPerif && taxaH > inf.taxaMaxHoraPerif) alerta('atencao', 'Monitor cardíaco', 'Acima de ' + inf.taxaMaxHoraPerif + ' ' + un + '/h: monitorização cardíaca contínua.');
        }
        if (usaPed && inf.pedTaxaMaxKgH && taxaH / peso > inf.pedTaxaMaxKgH * 1.0001) alerta('alto', 'Velocidade alta para criança', fmt(taxaH / peso, 2) + ' ' + un + '/kg/h (máximo ' + fmt(inf.pedTaxaMaxKgH) + ').');
        if (mlh > 999) alerta('atencao', 'Vazão muito alta', fmt(mlh, 0) + ' mL/h: confira volume e tempo.');
      }
    }

    // ---------- Dose x referencia ----------
    if (m.semRef) {
      alerta('alto', 'Sem conferência de dose', 'Medicamento fora da lista: a calculadora só fez a conta. Ela não sabe se a dose é segura. Confira na bula e com o farmacêutico.');
    } else if (!ref) {
      alerta('alto', 'Sem dose de referência para ' + (usaPed ? 'criança' : 'adulto'), 'Esta ferramenta não tem faixa validada para ' + (usaPed ? 'crianças' : 'adultos') + ' nesta indicação. Só administre com prescrição conferida pelo farmacêutico/protocolo.');
    } else {
      var pk = !!ref.porKg;
      var v = pk ? dose / peso : dose;
      var u = pk ? un + '/kg' : un;
      var tol = pk ? 1.05 : 1.0001;
      var n0 = alertas.length;
      var txtDose = fmt(v) + ' ' + u + ' por dose';
      var txtFaixa = ref.min != null ? ' Faixa usual: ' + faixaTexto(ref, u) + '.' : '';
      if (ref.max && v >= ref.max * 10) alerta('bloqueio', 'Dose 10 vezes (ou mais) acima do usual', 'Prescrito: ' + txtDose + '.' + txtFaixa + ' Quase sempre é vírgula no lugar errado, zero a mais ou unidade trocada (mg × g × mcg). Não administre.');
      else if (ref.lim && v > ref.lim * tol) alerta('alto', 'Acima da dose máxima', 'Prescrito: ' + txtDose + '. Máximo: ' + fmt(ref.lim) + ' ' + u + '.' + txtFaixa);
      else if (ref.max && v > ref.max * tol) alerta('atencao', 'Acima da faixa usual', 'Prescrito: ' + txtDose + '.' + txtFaixa + ' Não passa do máximo, mas confirme a indicação.');
      if (ref.min && v <= ref.min / 10) alerta('alto', 'Dose 10 vezes abaixo do usual', 'Prescrito: ' + txtDose + '.' + txtFaixa + ' Pode ser vírgula ou unidade trocada.');
      else if (ref.min && v < ref.min / tol) alerta('atencao', 'Abaixo da faixa usual', 'Prescrito: ' + txtDose + '.' + txtFaixa + ' Risco de subdose: confirme.');
      if (pk && ref.limAbs && dose > ref.limAbs * 1.0001) alerta('alto', 'Passa da dose máxima absoluta', fmtDose(dose, un) + ' por dose. Máximo absoluto: ' + fmtDose(ref.limAbs, un) + ' (nem pelo peso pode passar disso).');
      if (ref.limDia) {
        var vd = pk ? dia / peso : dia;
        if (vd > ref.limDia * tol) alerta('alto', 'Total de 24 h acima do máximo', FREQ_TEXTO[e.freq] + ' dá ' + fmt(vd) + ' ' + u + ' por dia. Máximo: ' + fmt(ref.limDia) + ' ' + u + '/dia.');
      }
      if (ref.limDiaAbs && dia > ref.limDiaAbs * 1.0001) alerta('alto', 'Total de 24 h acima do máximo absoluto', FREQ_TEXTO[e.freq] + ' dá ' + fmtDose(dia, un) + ' por dia. Máximo: ' + fmtDose(ref.limDiaAbs, un) + '.');
      if (alertas.length === n0) {
        alerta('ok', 'Dose dentro da faixa de referência', txtDose + (dosesDia > 1 ? ' · ' + fmt(pk ? dia / peso : dia) + ' ' + u + ' em 24 h' : '') + '.');
      }
      calculo.unshift('Dose prescrita: <b>' + fmtDose(dose, un) + '</b>' + (pk ? ' ÷ ' + fmt(peso) + ' kg = <b>' + fmt(v) + ' ' + u + '</b>' : '') +
        (dosesDia > 1 ? ' · ' + FREQ_TEXTO[e.freq] + ' = ' + fmtDose(dia, un) + ' em 24 h' : ''));
    }
    if (usaPed && anos >= 12) alerta('info', 'Conferido com dose pediátrica', 'Adolescente com menos de 40 kg: dose por kg.');
    if (!usaPed && anos != null && anos < 18) alerta('info', 'Conferido como adulto', peso == null ? 'Adolescente sem peso informado: informe o peso para conferir por kg se tiver menos de 40 kg.' : 'Adolescente com 40 kg ou mais.');

    // ---------- Paciente: idade, peso, condicoes, alergias ----------
    if (m.mav) alerta('mav', 'Medicamento de alta vigilância (MAV)', 'Dupla checagem independente: outra pessoa refaz o cálculo sozinha, sem ver o seu, antes de administrar.' + (m.antidoto ? ' Antídoto: ' + m.antidoto : ''));
    (m.restricoes || []).forEach(function (r) { if (r.se(ctx)) alerta(r.nivel, r.titulo, r.texto); });
    if (dias < 28 && !m.semRef) alerta('alto', 'Recém-nascido', 'Doses e intervalos neonatais são diferentes e dependem da idade gestacional. Esta calculadora não valida doses neonatais: confirme com o protocolo da neonatologia/farmácia.');
    if (anos >= 60 && m.idoso) alerta('atencao', 'Paciente idoso', m.idoso);

    if (peso != null) {
      if (anos < 13) {
        var est = pesoEstimado(dias);
        if (peso > est * 2 || peso < est * 0.5) alerta('atencao', 'Peso incomum para a idade', faixaEtaria(dias) + ' de ' + idadeTexto(ri.valor, e.idadeUn) + ' costuma pesar perto de ' + fmt(est, 0) + ' kg. Confira se o peso está em kg e se a idade está certa.');
      } else if (peso < 30 || peso > 200) {
        alerta('atencao', 'Peso incomum', fmt(peso) + ' kg: confira se o peso está certo e em kg.');
      }
    }

    var NOMES_COND = { gestante: 'Gestante', lactante: 'Amamentando', renal: 'Insuficiência renal', hepatica: 'Insuficiência hepática' };
    Object.keys(NOMES_COND).forEach(function (k) {
      if (!e.condicoes || !e.condicoes[k]) return;
      var c = (m.condicoes || {})[k];
      if (c) alerta(c.nivel, NOMES_COND[k], c.texto);
      else alerta('info', NOMES_COND[k], 'Sem alerta específico cadastrado. Confira na bula.');
    });

    var al = norm(e.alergias);
    if (al.trim()) {
      var bate = function (lista) { return (lista || []).some(function (t) { return al.indexOf(norm(t)) >= 0; }); };
      if (bate(m.alergiaTermos) || (m.semRef && al.indexOf(norm(m.nome).slice(0, 5)) >= 0)) {
        alerta('bloqueio', 'Paciente relatou alergia a este medicamento ou à classe', 'Informado: "' + esc(e.alergias) + '". Não administre. Comunique o prescritor.');
      } else if (bate(m.alergiaCruzada)) {
        alerta('alto', 'Possível alergia cruzada', 'Informado: "' + esc(e.alergias) + '". Há risco de reação cruzada com ' + m.nome + '. Confirme com o prescritor antes.');
      } else {
        alerta('info', 'Alergias informadas', '"' + esc(e.alergias) + '": confira se não há relação com ' + m.nome + ' ou com os componentes da fórmula.');
      }
    } else if (!e.negaAlergias) {
      alerta('atencao', 'Alergias não informadas', 'Pergunte ao paciente/acompanhante sobre alergias antes de administrar.');
    }

    alertas.sort(function (a, b) { return ORDEM[a.nivel] - ORDEM[b.nivel]; });
    var pior = alertas.length ? alertas[0].nivel : 'ok';
    if (pior === 'mav' || pior === 'info') pior = alertas.some(function (a) { return a.nivel === 'atencao'; }) ? 'atencao' : 'ok';

    var paciente = faixaEtaria(dias) + ' · ' + idadeTexto(ri.valor, e.idadeUn) + (peso != null ? ' · ' + fmt(peso) + ' kg' : '');
    var titulo = m.nome + ' ' + fmtDose(dose, un) + ' · ' + via + ' · ' + FREQ_TEXTO[e.freq];

    var resumo = [
      'CONFERÊNCIA DE MEDICAÇÃO — ' + titulo,
      'Paciente: ' + paciente,
      'Apresentação: ' + ap.nome,
      destaque ? destaque.rotulo + ': ' + destaque.valor + (destaque.sub ? ' (' + destaque.sub + ')' : '') : '',
      admin.infusao ? 'Infusão: ' + fmt(admin.infusao.mlh, 1) + ' mL/h = ' + fmt(Math.round(admin.infusao.gotas), 0) + ' gotas/min' : '',
      alertas.filter(function (a) { return a.nivel !== 'ok' && a.nivel !== 'info'; }).map(function (a) { return '! ' + a.titulo; }).join('\n'),
      'Ferramenta de apoio: não substitui prescrição, bula nem dupla checagem.'
    ].filter(Boolean).join('\n');

    return {
      erros: [],
      nivel: pior,
      bloqueado: alertas.some(function (a) { return a.nivel === 'bloqueio'; }),
      titulo: titulo,
      paciente: paciente,
      destaque: destaque,
      passos: passos,
      calculo: calculo,
      alertas: alertas,
      referencia: ref ? ref.texto : null,
      administracao: (m.administracao || {})[via] || null,
      contraindicacoes: m.contraindicacoes || [],
      avisos: m.alertas || [],
      resumo: resumo.replace(/<[^>]+>/g, '')
    };
  }

  root.CALC = {
    lerNumero: lerNumero,
    conferir: conferir,
    fmt: fmt,
    fmtDose: fmtDose,
    fmtVol: fmtVol,
    norm: norm,
    esc: esc,
    FATOR: FATOR,
    UNIDADES_DE: UNIDADES_DE,
    VIA_TEXTO: VIA_TEXTO
  };
})(window);
