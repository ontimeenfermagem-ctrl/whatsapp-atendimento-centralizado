/*
 * Base de medicamentos da calculadora.
 *
 * Os numeros aqui NAO sao doses recomendadas: servem para CONFERIR a prescricao e pegar erro
 * (virgula, zero a mais, mg x g, via errada). Fontes: bulas ANVISA, Guia Farmaceutico HSL,
 * ISMP Brasil, PALS/ACLS e protocolos do Ministerio da Saude. Revisado em set/2026.
 *
 * Cada faixa de dose (adulto / ped) tem:
 *   porKg   true = valores por kg
 *   min/max faixa usual (fora dela = atencao)
 *   lim     maximo por dose (acima = alerta vermelho)
 *   limAbs  maximo absoluto por dose quando porKg (nunca passar a dose de adulto)
 *   limDia / limDiaAbs  maximo em 24 h (por kg se porKg / absoluto)
 * ped: null = nao existe faixa pediatrica validada aqui (a tela avisa).
 *
 * Apresentacoes: conc = unidade da droga por mL. Po: total do frasco e reconstituicao por via;
 * volFinal = volume depois de reconstituir (o po ocupa espaco), editavel na tela.
 *
 * infusao: exigeDiluicao (IV direto bloqueado), taxaMaxMin (unid/min, IV direta ou infusao),
 * tempoMin (min), maxConcPerif / maxConcCentral (unid/mL), taxaMaxHoraPerif/Central (unid/h),
 * pedTaxaMaxKgH (unid/kg/h).
 */
(function () {
  'use strict';

  window.MEDICAMENTOS = [
    {
      id: 'dipirona',
      nome: 'Dipirona sódica',
      sinonimos: 'metamizol novalgina anador',
      classe: 'Analgésico e antitérmico',
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Ampola 500 mg/mL — 2 mL (1 g)', conc: 500, vol: 2, vias: ['IV', 'IM'] },
        { tipo: 'solucao', nome: 'Gotas 500 mg/mL (VO)', conc: 500, vias: ['VO'], gotas: true },
        { tipo: 'solido', nome: 'Comprimido 500 mg', qtd: 500, vias: ['VO'], sulcado: true },
        { tipo: 'solido', nome: 'Comprimido 1 g', qtd: 1000, vias: ['VO'], sulcado: true }
      ],
      faixas: [{
        nome: 'Dor / febre',
        vias: ['IV', 'IM', 'VO'],
        adulto: { min: 500, max: 1000, lim: 2500, limDia: 5000,
          texto: 'Usual 500 mg a 1 g até 4x/dia. Bula injetável: até 2,5 g por dose e 5 g/dia; muitos protocolos limitam a 1 g/dose e 4 g/dia.' },
        ped: { porKg: true, min: 10, max: 25, lim: 25, limAbs: 1000, limDia: 100, limDiaAbs: 4000,
          texto: '10 a 25 mg/kg/dose, até 4x/dia.' }
      }],
      infusao: { taxaMaxMin: 500 },
      administracao: {
        IV: 'IV direta MUITO lenta: no máximo 1 mL (500 mg) por minuto, com o paciente deitado. Pode diluir em SF 0,9% ou SG 5%. Aplicação rápida causa hipotensão e choque.',
        IM: 'IM profunda (ventroglúteo ou dorsoglúteo). Pode causar dor local.',
        VO: 'Pode ser dada com ou sem alimento.'
      },
      restricoes: [
        { se: function (c) { return c.idadeDias < 90 || (c.peso != null && c.peso < 5); }, nivel: 'bloqueio',
          titulo: 'Contraindicada abaixo de 3 meses ou de 5 kg',
          texto: 'A bula não permite dipirona em lactentes com menos de 3 meses ou menos de 5 kg.' },
        { se: function (c) { return c.idadeDias >= 90 && c.idadeDias < 365 && c.via === 'IV'; }, nivel: 'alto',
          titulo: 'Lactente de 3 a 11 meses: bula indica só via IM',
          texto: 'Nessa faixa a bula não recomenda a via IV. Confirme com o prescritor.' }
      ],
      contraindicacoes: [
        'Alergia a dipirona ou outras pirazolonas (ex.: propifenazona, fenilbutazona)',
        'Asma ou urticária desencadeada por analgésicos/AINEs',
        'Agranulocitose ou alteração da medula óssea (atual ou prévia)',
        'Deficiência de G6PD',
        'Porfiria hepática aguda intermitente',
        'Hipotensão ou instabilidade hemodinâmica (via IV)',
        'Último trimestre da gestação'
      ],
      condicoes: {
        gestante: { nivel: 'alto', texto: 'Evitar no 1º trimestre e contraindicada no 3º trimestre (fechamento do canal arterial fetal).' },
        lactante: { nivel: 'atencao', texto: 'Passa para o leite: a bula orienta não amamentar por 48 h após a dose.' },
        renal: { nivel: 'atencao', texto: 'Insuficiência renal: evitar doses altas e repetidas.' },
        hepatica: { nivel: 'atencao', texto: 'Insuficiência hepática: evitar doses altas e repetidas.' }
      },
      alergiaTermos: ['dipirona', 'metamizol', 'novalgina', 'pirazol'],
      alertas: ['Verifique a PA antes (via IV).', 'Observe sinais de reação alérgica: urticária, falta de ar, queda da PA.']
    },

    {
      id: 'paracetamol',
      nome: 'Paracetamol',
      sinonimos: 'acetaminofeno tylenol',
      classe: 'Analgésico e antitérmico',
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Gotas 200 mg/mL (VO)', conc: 200, vias: ['VO'], gotas: true },
        { tipo: 'solucao', nome: 'Suspensão 32 mg/mL (160 mg/5 mL)', conc: 32, vias: ['VO'] },
        { tipo: 'solido', nome: 'Comprimido 500 mg', qtd: 500, vias: ['VO'], sulcado: true },
        { tipo: 'solido', nome: 'Comprimido 750 mg', qtd: 750, vias: ['VO'], sulcado: true }
      ],
      faixas: [{
        nome: 'Dor / febre',
        vias: ['VO'],
        adulto: { min: 500, max: 1000, lim: 1000, limDia: 4000,
          texto: '500 mg a 1 g a cada 4–6 h. Máximo 4 g/dia (2–3 g em hepatopatas, etilistas e desnutridos).' },
        ped: { porKg: true, min: 10, max: 15, lim: 15, limAbs: 1000, limDia: 75, limDiaAbs: 4000,
          texto: '10 a 15 mg/kg/dose a cada 4–6 h, no máximo 5 doses e 75 mg/kg em 24 h.' }
      }],
      administracao: { VO: 'Gotas: confira na bula do fabricante quantas gotas formam 1 mL antes de converter.' },
      restricoes: [],
      contraindicacoes: ['Alergia ao paracetamol', 'Insuficiência hepática grave ou hepatite ativa'],
      condicoes: {
        hepatica: { nivel: 'alto', texto: 'Hepatopatia: dose máxima menor (em geral 2–3 g/dia). Confirme com o prescritor.' },
        renal: { nivel: 'atencao', texto: 'Insuficiência renal grave: aumentar o intervalo entre doses (mínimo 6/6 h).' }
      },
      alergiaTermos: ['paracetamol', 'acetaminofen', 'tylenol'],
      alertas: ['SOME todo paracetamol do dia: antigripais e analgésicos combinados também têm paracetamol. Superdose causa lesão do fígado sem sintomas no início.']
    },

    {
      id: 'ceftriaxona',
      nome: 'Ceftriaxona',
      sinonimos: 'rocefin triaxin cefalosporina',
      classe: 'Antibiótico (cefalosporina de 3ª geração)',
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'po', nome: 'Frasco-ampola 1 g (pó)', total: 1000, vias: ['IV', 'IM'],
          reconst: {
            IV: { diluente: '10 mL de água destilada', vol: 10, volFinal: 10 },
            IM: { diluente: '3,5 mL de lidocaína 1% (diluente próprio da apresentação IM)', vol: 3.5, volFinal: 4 }
          },
          nota: 'Volume final aproximado. Depois de reconstituir, confira o volume real na seringa.' },
        { tipo: 'po', nome: 'Frasco-ampola 500 mg (pó)', total: 500, vias: ['IV', 'IM'],
          reconst: {
            IV: { diluente: '5 mL de água destilada', vol: 5, volFinal: 5 },
            IM: { diluente: '2 mL de lidocaína 1% (diluente próprio da apresentação IM)', vol: 2, volFinal: 2.2 }
          },
          nota: 'Volume final aproximado. Depois de reconstituir, confira o volume real na seringa.' }
      ],
      faixas: [{
        nome: 'Infecções (geral)',
        vias: ['IV', 'IM'],
        adulto: { min: 1000, max: 2000, lim: 2000, limDia: 4000, texto: '1 a 2 g a cada 12–24 h. Máximo 4 g/dia.' },
        ped: { porKg: true, min: 25, max: 100, lim: 100, limAbs: 2000, limDia: 100, limDiaAbs: 4000,
          texto: '50 a 75 mg/kg/dia (1x/dia ou dividido 12/12 h); meningite 100 mg/kg/dia. Máx. 4 g/dia.' }
      }],
      infusao: { minutosIVDireta: 2 },
      administracao: {
        IV: 'IV direta lenta em 2–4 min, ou diluída em 50–100 mL de SF 0,9% ou SG 5% em 30 min (neonatos: 60 min).',
        IM: 'IM profunda (ventroglúteo/dorsoglúteo). Até 1 g por local.'
      },
      restricoes: [
        { se: function (c) { return c.idadeDias < 28; }, nivel: 'alto',
          titulo: 'Recém-nascido: cuidado especial',
          texto: 'Contraindicada em neonatos com icterícia (hiperbilirrubinemia) e em prematuros. NUNCA dar junto com soluções que tenham cálcio (nem em Y) em menores de 28 dias: forma precipitado fatal.' }
      ],
      contraindicacoes: [
        'Alergia a cefalosporinas',
        'Reação grave (anafilaxia) a penicilinas — risco de reação cruzada',
        'Neonato com icterícia ou prematuro',
        'Alergia à lidocaína (se usar o diluente IM)'
      ],
      condicoes: {
        hepatica: { nivel: 'atencao', texto: 'Insuficiência hepática E renal juntas: máximo 2 g/dia.' },
        renal: { nivel: 'atencao', texto: 'Insuficiência hepática E renal juntas: máximo 2 g/dia.' }
      },
      alergiaTermos: ['ceftriax', 'cefalospor', 'cefalex', 'cefazol', 'cefepim', 'rocefin'],
      alergiaCruzada: ['penicil', 'amoxi', 'ampicil', 'benzetacil', 'betalact'],
      alertas: [
        'O diluente com LIDOCAÍNA é só para IM. Nunca aplique na veia.',
        'Incompatível com Ringer lactato e qualquer solução com cálcio: não misture e não passe no mesmo acesso.'
      ]
    },

    {
      id: 'amoxicilina',
      nome: 'Amoxicilina',
      sinonimos: 'amoxil penicilina',
      classe: 'Antibiótico (penicilina)',
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Suspensão 250 mg/5 mL (50 mg/mL)', conc: 50, vias: ['VO'] },
        { tipo: 'solucao', nome: 'Suspensão 500 mg/5 mL (100 mg/mL)', conc: 100, vias: ['VO'] },
        { tipo: 'solido', nome: 'Cápsula 500 mg', qtd: 500, vias: ['VO'], sulcado: false }
      ],
      faixas: [{
        nome: 'Infecções (geral)',
        vias: ['VO'],
        adulto: { min: 250, max: 1000, lim: 1000, limDia: 4000, texto: '500 mg a cada 8 h (até 1 g a cada 8 h em infecções graves).' },
        ped: { porKg: true, min: 8, max: 45, lim: 45, limAbs: 1000, limDia: 90, limDiaAbs: 4000,
          texto: '25 a 50 mg/kg/dia dividido 8/8 h; dose alta (otite, pneumonia) 80–90 mg/kg/dia dividido 12/12 h.' }
      }],
      administracao: { VO: 'Suspensão: reconstituir com água filtrada até a marca do frasco, agitar antes de cada dose e medir com seringa dosadora (não use colher de cozinha).' },
      restricoes: [],
      contraindicacoes: ['Alergia a penicilinas ou a qualquer betalactâmico', 'Mononucleose infecciosa (alto risco de exantema)'],
      condicoes: { renal: { nivel: 'atencao', texto: 'Insuficiência renal grave: aumentar intervalo (ClCr < 30).' } },
      alergiaTermos: ['penicil', 'amoxi', 'ampicil', 'benzetacil', 'betalact'],
      alertas: ['Suspensão reconstituída: geladeira e validade curta (em geral 7–14 dias, veja o rótulo).']
    },

    {
      id: 'benzatina',
      nome: 'Penicilina G benzatina',
      sinonimos: 'benzetacil benzilpenicilina benzatina',
      classe: 'Antibiótico (penicilina de depósito)',
      unidade: 'UI',
      apresentacoes: [
        { tipo: 'po', nome: 'Frasco-ampola 1.200.000 UI (pó)', total: 1200000, vias: ['IM'],
          reconst: { IM: { diluente: '4 mL de água destilada', vol: 4, volFinal: 4.8 } },
          nota: 'Com 4 mL de AD o volume final fica ~4,8 mL (o pó ocupa espaço). Confira na bula do seu fabricante.' },
        { tipo: 'po', nome: 'Frasco-ampola 600.000 UI (pó)', total: 600000, vias: ['IM'],
          reconst: { IM: { diluente: '2 mL de água destilada (conferir bula)', vol: 2, volFinal: null } },
          nota: 'Informe o volume final real após reconstituir para doses parciais.' }
      ],
      faixas: [{
        nome: 'Sífilis / febre reumática / faringite',
        vias: ['IM'],
        adulto: { min: 1200000, max: 2400000, lim: 2400000, limDia: 2400000,
          texto: '1.200.000 a 2.400.000 UI IM (sífilis: 2.400.000 UI = 1.200.000 UI em cada glúteo).' },
        ped: { porKg: true, min: 20000, max: 60000, lim: 75000, limAbs: 2400000, limDia: 75000, limDiaAbs: 2400000,
          texto: 'Febre reumática: < 20 kg 600.000 UI; ≥ 20 kg 1.200.000 UI. Sífilis: 50.000 UI/kg (máx. 2.400.000 UI).' }
      }],
      administracao: {
        IM: 'SOMENTE IM profunda, ventroglúteo ou dorsoglúteo. Aspire antes de injetar e injete lentamente. Doses acima de 1.200.000 UI: dividir em dois locais. Agulha calibrosa (suspensão espessa).'
      },
      restricoes: [],
      viaProibida: { IV: 'NUNCA IV: a suspensão causa embolia, parada cardíaca e morte.', SC: 'Nunca SC: necrose.' },
      contraindicacoes: ['Alergia a penicilinas (qualquer uma)', 'História de anafilaxia a betalactâmicos'],
      condicoes: {},
      alergiaTermos: ['penicil', 'amoxi', 'ampicil', 'benzetacil', 'betalact'],
      alertas: [
        'Mantenha o paciente em observação por 30 minutos após a aplicação (risco de anafilaxia).',
        'Tenha adrenalina e material de emergência à mão.'
      ]
    },

    {
      id: 'cristalina',
      nome: 'Penicilina G cristalina',
      sinonimos: 'benzilpenicilina potassica cristalina',
      classe: 'Antibiótico (penicilina)',
      unidade: 'UI',
      apresentacoes: [
        { tipo: 'po', nome: 'Frasco-ampola 5.000.000 UI (pó)', total: 5000000, vias: ['IV', 'IM'],
          reconst: { IV: { diluente: '8 mL de água destilada', vol: 8, volFinal: 10 }, IM: { diluente: '8 mL de água destilada', vol: 8, volFinal: 10 } },
          nota: '8 mL de AD + 2 mL do pó = 10 mL, ou seja, 500.000 UI por mL.' }
      ],
      faixas: [{
        nome: 'Infecções graves / sífilis congênita / neurossífilis',
        vias: ['IV', 'IM'],
        adulto: { min: 1000000, max: 4000000, lim: 5000000, limDia: 24000000, texto: '1 a 4 milhões UI a cada 4 h. Máximo 24 milhões UI/dia.' },
        ped: { porKg: true, min: 25000, max: 100000, lim: 100000, limAbs: 4000000, limDia: 400000, limDiaAbs: 24000000,
          texto: '100.000 a 400.000 UI/kg/dia divididos a cada 4–6 h. Sífilis congênita: 50.000 UI/kg/dose.' }
      }],
      infusao: { tempoMin: 30 },
      administracao: {
        IV: 'Diluir a dose em 50–100 mL de SF 0,9% ou SG 5% e infundir em 30–60 min.',
        IM: 'IM profunda; dolorosa. Prefira a via IV quando houver acesso.'
      },
      restricoes: [],
      contraindicacoes: ['Alergia a penicilinas (qualquer uma)'],
      condicoes: { renal: { nivel: 'alto', texto: 'Insuficiência renal: ajustar dose. Cada milhão de UI tem ~1,7 mEq de potássio: risco de hipercalemia.' } },
      alergiaTermos: ['penicil', 'amoxi', 'ampicil', 'benzetacil', 'betalact'],
      alertas: ['Não confunda com a benzatina: a cristalina vai na veia, a benzatina NUNCA.', 'Use logo depois de reconstituir; siga a estabilidade da bula/CCIH.']
    },

    {
      id: 'ondansetrona',
      nome: 'Ondansetrona',
      sinonimos: 'zofran vonau nausedron',
      classe: 'Antiemético',
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Ampola 2 mg/mL — 2 mL (4 mg)', conc: 2, vol: 2, vias: ['IV', 'IM'] },
        { tipo: 'solucao', nome: 'Ampola 2 mg/mL — 4 mL (8 mg)', conc: 2, vol: 4, vias: ['IV', 'IM'] },
        { tipo: 'solido', nome: 'Comprimido 4 mg', qtd: 4, vias: ['VO'], sulcado: false },
        { tipo: 'solido', nome: 'Comprimido 8 mg', qtd: 8, vias: ['VO'], sulcado: false }
      ],
      faixas: [{
        nome: 'Náuseas e vômitos',
        vias: ['IV', 'IM', 'VO'],
        adulto: { min: 4, max: 8, lim: 16, limDia: 32, texto: '4 a 8 mg a cada 8–12 h. Nunca mais que 16 mg IV em dose única (risco de arritmia).' },
        ped: { porKg: true, min: 0.1, max: 0.15, lim: 0.15, limAbs: 4, limDia: 0.45, limDiaAbs: 24,
          texto: '0,1 a 0,15 mg/kg/dose (máx. 4 mg por dose).' }
      }],
      infusao: { minutosIVDireta: 0.5 },
      administracao: {
        IV: 'IV direta lenta em pelo menos 30 segundos (melhor 2–5 min) ou diluída em 50 mL de SF 0,9% em 15 min.',
        IM: 'IM: no máximo 4 mg por aplicação.',
        VO: 'Pode dar com ou sem alimento.'
      },
      restricoes: [
        { se: function (c) { return c.idadeDias < 30; }, nivel: 'alto', titulo: 'Menor de 1 mês', texto: 'Uso em recém-nascidos não está estabelecido na bula.' }
      ],
      contraindicacoes: ['Uso de apomorfina (hipotensão grave)', 'Síndrome do QT longo congênito', 'Alergia à ondansetrona'],
      condicoes: { hepatica: { nivel: 'alto', texto: 'Insuficiência hepática moderada/grave: máximo 8 mg/dia.' } },
      alergiaTermos: ['ondansetron', 'zofran', 'vonau'],
      alertas: ['Cuidado em cardiopatas, hipocalemia ou uso de outras drogas que prolongam o QT.']
    },

    {
      id: 'metoclopramida',
      nome: 'Metoclopramida',
      sinonimos: 'plasil',
      classe: 'Antiemético / procinético',
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Ampola 5 mg/mL — 2 mL (10 mg)', conc: 5, vol: 2, vias: ['IV', 'IM'] },
        { tipo: 'solucao', nome: 'Gotas 4 mg/mL (VO)', conc: 4, vias: ['VO'], gotas: true },
        { tipo: 'solido', nome: 'Comprimido 10 mg', qtd: 10, vias: ['VO'], sulcado: true }
      ],
      faixas: [{
        nome: 'Náuseas e vômitos',
        vias: ['IV', 'IM', 'VO'],
        adulto: { min: 5, max: 10, lim: 10, limDia: 30, texto: '10 mg até 3x/dia. Máximo 30 mg/dia e 5 dias de uso.' },
        ped: { porKg: true, min: 0.1, max: 0.15, lim: 0.15, limAbs: 10, limDia: 0.5, limDiaAbs: 30,
          texto: '0,1 a 0,15 mg/kg/dose até 3x/dia (máx. 0,5 mg/kg/dia). Contraindicada em menores de 1 ano.' }
      }],
      infusao: { minutosIVDireta: 3 },
      administracao: {
        IV: 'IV direta lenta em pelo menos 3 minutos (rápida causa ansiedade e agitação).',
        IM: 'IM.',
        VO: '30 minutos antes das refeições.'
      },
      restricoes: [
        { se: function (c) { return c.idadeDias < 365; }, nivel: 'bloqueio', titulo: 'Contraindicada em menores de 1 ano',
          texto: 'Alto risco de reações extrapiramidais (movimentos involuntários) em lactentes.' },
        { se: function (c) { return c.anos >= 1 && c.anos < 18; }, nivel: 'atencao', titulo: 'Criança/adolescente',
          texto: 'Maior risco de reação extrapiramidal. Use só se prescrito e observe o paciente.' }
      ],
      contraindicacoes: [
        'Hemorragia, obstrução ou perfuração gastrointestinal',
        'Feocromocitoma',
        'Epilepsia',
        'Doença de Parkinson ou uso de levodopa',
        'Discinesia tardia por neurolépticos no passado',
        'Metemoglobinemia'
      ],
      condicoes: {
        renal: { nivel: 'atencao', texto: 'Insuficiência renal: reduzir a dose (em geral pela metade).' },
        hepatica: { nivel: 'atencao', texto: 'Insuficiência hepática grave: reduzir a dose pela metade.' }
      },
      idoso: 'Idosos: maior risco de efeitos extrapiramidais e discinesia tardia; prefira a menor dose.',
      alergiaTermos: ['metoclopramid', 'plasil'],
      alertas: ['Suspenda e avise se aparecer torção de pescoço, olhos virados ou movimentos involuntários.']
    },

    {
      id: 'dexametasona',
      nome: 'Dexametasona (fosfato)',
      sinonimos: 'decadron corticoide',
      classe: 'Corticoide',
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Ampola 4 mg/mL — 2,5 mL (10 mg)', conc: 4, vol: 2.5, vias: ['IV', 'IM'] },
        { tipo: 'solucao', nome: 'Ampola 2 mg/mL — 1 mL', conc: 2, vol: 1, vias: ['IV', 'IM'] },
        { tipo: 'solucao', nome: 'Elixir 0,1 mg/mL (0,5 mg/5 mL)', conc: 0.1, vias: ['VO'] },
        { tipo: 'solido', nome: 'Comprimido 4 mg', qtd: 4, vias: ['VO'], sulcado: true }
      ],
      faixas: [{
        nome: 'Uso geral',
        vias: ['IV', 'IM', 'VO'],
        adulto: { min: 0.5, max: 10, lim: 20, texto: 'Dose muito variável (0,5 a 10 mg; edema cerebral até 10–20 mg). Protocolos específicos podem usar mais.' },
        ped: { porKg: true, min: 0.1, max: 0.6, lim: 0.6, limAbs: 16, texto: 'Crupe/asma: 0,15 a 0,6 mg/kg (máx. 16 mg).' }
      }],
      infusao: { minutosIVDireta: 1 },
      administracao: {
        IV: 'IV direta lenta (1–2 min) ou diluída em SF/SG. Rápido demais causa ardor e coceira perineal.',
        IM: 'IM profunda.',
        VO: 'Junto com alimento (protege o estômago).'
      },
      restricoes: [],
      contraindicacoes: ['Infecção fúngica sistêmica', 'Alergia à dexametasona', 'Vacina de vírus vivo recente (se dose imunossupressora)'],
      condicoes: {},
      alergiaTermos: ['dexametason', 'decadron'],
      alertas: ['Eleva a glicemia: monitore em diabéticos.', 'Não suspenda de forma abrupta após uso prolongado.']
    },

    {
      id: 'furosemida',
      nome: 'Furosemida',
      sinonimos: 'lasix diuretico',
      classe: 'Diurético de alça',
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Ampola 10 mg/mL — 2 mL (20 mg)', conc: 10, vol: 2, vias: ['IV', 'IM'] },
        { tipo: 'solido', nome: 'Comprimido 40 mg', qtd: 40, vias: ['VO'], sulcado: true }
      ],
      faixas: [{
        nome: 'Edema / congestão',
        vias: ['IV', 'IM', 'VO'],
        adulto: { min: 20, max: 80, lim: 200, texto: '20 a 40 mg IV (até 80 mg). Doses maiores só com prescrição explícita (ex.: insuficiência renal).' },
        ped: { porKg: true, min: 0.5, max: 1, lim: 2, limAbs: 40, limDia: 6, texto: '0,5 a 1 mg/kg/dose (máx. 2 mg/kg/dose e 6 mg/kg/dia).' }
      }],
      infusao: { taxaMaxMin: 4 },
      administracao: {
        IV: 'IV direta lenta: no máximo 4 mg por minuto (rápido demais causa surdez — ototoxicidade).',
        IM: 'IM apenas se não houver acesso venoso.',
        VO: 'De manhã (para o paciente não urinar à noite).'
      },
      restricoes: [],
      contraindicacoes: ['Anúria (não urina)', 'Hipocalemia ou hiponatremia grave', 'Desidratação/hipovolemia', 'Coma hepático', 'Alergia a furosemida ou sulfonamidas'],
      condicoes: {},
      alergiaTermos: ['furosemid', 'lasix', 'sulfa'],
      alertas: ['Confira PA e, se possível, potássio antes.', 'Controle diurese e balanço hídrico.']
    },

    {
      id: 'tramadol',
      nome: 'Tramadol',
      sinonimos: 'tramal opioide',
      classe: 'Analgésico opioide',
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Ampola 50 mg/mL — 1 mL (50 mg)', conc: 50, vol: 1, vias: ['IV', 'IM', 'SC'] },
        { tipo: 'solucao', nome: 'Ampola 50 mg/mL — 2 mL (100 mg)', conc: 50, vol: 2, vias: ['IV', 'IM', 'SC'] },
        { tipo: 'solido', nome: 'Cápsula 50 mg', qtd: 50, vias: ['VO'], sulcado: false }
      ],
      faixas: [{
        nome: 'Dor moderada a intensa',
        vias: ['IV', 'IM', 'SC', 'VO'],
        adulto: { min: 50, max: 100, lim: 100, limDia: 400, texto: '50 a 100 mg a cada 4–6 h. Máximo 400 mg/dia (idosos > 75 anos: 300 mg/dia).' },
        ped: { porKg: true, min: 1, max: 2, lim: 2, limAbs: 100, limDia: 8, limDiaAbs: 400, texto: '1 a 2 mg/kg/dose (uso pediátrico restrito).' }
      }],
      infusao: { minutosIVDireta: 3 },
      administracao: {
        IV: 'Preferir diluído em 100 mL de SF 0,9% em 15–30 min (menos náusea). IV direta só muito lenta (2–3 min).',
        IM: 'IM.',
        SC: 'SC.'
      },
      restricoes: [
        { se: function (c) { return c.anos < 1; }, nivel: 'bloqueio', titulo: 'Contraindicado em menores de 1 ano', texto: 'Não usar em lactentes.' },
        { se: function (c) { return c.anos >= 1 && c.anos < 12; }, nivel: 'alto', titulo: 'Menor de 12 anos',
          texto: 'Risco de depressão respiratória grave; agências internacionais contraindicam abaixo de 12 anos. Só com prescrição pediátrica explícita.' },
        { se: function (c) { return c.anos >= 75 && c.dia > 300; }, nivel: 'alto', titulo: 'Idoso acima de 75 anos', texto: 'Dose diária acima de 300 mg.' }
      ],
      contraindicacoes: [
        'Uso de IMAO (ou nos últimos 14 dias)',
        'Epilepsia não controlada',
        'Intoxicação aguda por álcool, hipnóticos, opioides ou psicotrópicos',
        'Insuficiência respiratória grave'
      ],
      condicoes: {
        renal: { nivel: 'alto', texto: 'ClCr < 30: intervalo de 12 h e máximo 200 mg/dia.' },
        hepatica: { nivel: 'alto', texto: 'Cirrose: intervalo de 12 h.' },
        gestante: { nivel: 'alto', texto: 'Evitar na gestação (abstinência neonatal).' },
        lactante: { nivel: 'alto', texto: 'Evitar na amamentação.' }
      },
      idoso: 'Idosos: risco de confusão, queda e convulsão; > 75 anos máximo 300 mg/dia.',
      alergiaTermos: ['tramadol', 'tramal'],
      alertas: ['Risco de síndrome serotoninérgica com antidepressivos (ISRS, tricíclicos).', 'Pode causar náusea e tontura: levante o paciente com cuidado.']
    },

    {
      id: 'morfina',
      nome: 'Morfina',
      sinonimos: 'dimorf opioide',
      classe: 'Analgésico opioide',
      mav: true,
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Ampola 10 mg/mL — 1 mL', conc: 10, vol: 1, vias: ['IV', 'IM', 'SC'] },
        { tipo: 'solucao', nome: 'Ampola 1 mg/mL — 2 mL', conc: 1, vol: 2, vias: ['IV', 'IM', 'SC'] },
        { tipo: 'solucao', nome: 'Ampola 0,2 mg/mL — 1 mL', conc: 0.2, vol: 1, vias: ['IV', 'IM', 'SC'] }
      ],
      faixas: [{
        nome: 'Dor intensa',
        vias: ['IV', 'IM', 'SC'],
        adulto: { min: 1, max: 10, lim: 15, texto: 'IV: 1 a 4 mg titulando a cada 5–15 min; IM/SC 5 a 10 mg a cada 4 h. Paciente virgem de opioide: começar baixo.' },
        ped: { porKg: true, min: 0.05, max: 0.1, lim: 0.2, limAbs: 10, texto: '0,05 a 0,1 mg/kg/dose IV a cada 2–4 h.' }
      }],
      infusao: { minutosIVDireta: 4 },
      administracao: {
        IV: 'Diluir antes (ex.: 1 mL de 10 mg/mL + 9 mL de SF = 1 mg/mL) e aplicar lentamente em 4–5 min.',
        IM: 'IM.',
        SC: 'SC.'
      },
      restricoes: [
        { se: function (c) { return c.idadeDias < 28; }, nivel: 'alto', titulo: 'Recém-nascido', texto: 'Neonatos são muito sensíveis (0,025–0,05 mg/kg). Confirme com o protocolo neonatal.' }
      ],
      contraindicacoes: ['Depressão respiratória', 'Asma aguda grave', 'Íleo paralítico', 'Traumatismo craniano / hipertensão intracraniana (sem ventilação controlada)', 'Uso de IMAO'],
      condicoes: {
        renal: { nivel: 'alto', texto: 'Insuficiência renal: metabólitos acumulam — reduzir dose e aumentar intervalo.' },
        hepatica: { nivel: 'alto', texto: 'Insuficiência hepática: reduzir dose.' }
      },
      idoso: 'Idosos: começar com 25–50% da dose de adulto.',
      antidoto: 'Naloxona 0,4 mg/mL (depressão respiratória).',
      alergiaTermos: ['morfin', 'dimorf', 'opioid', 'opiac'],
      alertas: ['Antes: FR, SpO₂ e nível de consciência. Depois: reavaliar em 15–30 min.', 'FR < 12 ou sonolência excessiva: pare e chame o médico. Naloxona à mão.']
    },

    {
      id: 'insulina-regular',
      nome: 'Insulina regular (humana)',
      sinonimos: 'insulina r rapida novolin humulin',
      classe: 'Hipoglicemiante',
      mav: true,
      unidade: 'UI',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Frasco 100 UI/mL (U-100) — 10 mL', conc: 100, vol: 10, vias: ['SC', 'IV'], insulina: true }
      ],
      faixas: [{
        nome: 'Correção / esquema prescrito',
        vias: ['SC', 'IV'],
        adulto: { min: 1, max: 20, lim: 50, texto: 'Dose é individual (esquema/escala da prescrição). Os limites aqui só pegam erro de digitação.' },
        ped: { porKg: true, min: 0.05, max: 0.2, lim: 0.5, limAbs: 20, texto: 'Dose individual. Em cetoacidose a infusão é 0,05–0,1 UI/kg/h por protocolo.' }
      }],
      administracao: {
        SC: 'SC com seringa de insulina (em UI) ou caneta. Rodízio de locais (abdome, braço, coxa).',
        IV: 'IV só a REGULAR, em geral em bomba (ex.: 100 UI em 100 mL de SF = 1 UI/mL), com glicemia capilar de hora em hora.'
      },
      restricoes: [],
      contraindicacoes: ['Hipoglicemia no momento', 'Alergia à insulina'],
      condicoes: {},
      alergiaTermos: ['insulin'],
      alertas: [
        'SEMPRE meça a glicemia capilar antes.',
        'Use seringa de INSULINA (graduada em UI) — nunca seringa comum de mL.',
        'Nunca escreva "U" para unidades: "10U" já foi lido como 100.',
        'Hipoglicemia: tenha glicose 50% disponível.'
      ]
    },

    {
      id: 'insulina-nph',
      nome: 'Insulina NPH (humana)',
      sinonimos: 'insulina n intermediaria novolin humulin',
      classe: 'Hipoglicemiante',
      mav: true,
      unidade: 'UI',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Frasco 100 UI/mL (U-100) — 10 mL', conc: 100, vol: 10, vias: ['SC'], insulina: true }
      ],
      faixas: [{
        nome: 'Dose prescrita',
        vias: ['SC'],
        adulto: { min: 2, max: 40, lim: 80, texto: 'Dose individual conforme prescrição. Limites apenas para pegar erro de digitação.' },
        ped: { porKg: true, min: 0.1, max: 0.5, lim: 1, limAbs: 40, texto: 'Dose individual conforme endocrinologista.' }
      }],
      administracao: { SC: 'Somente SC. Rolar o frasco entre as mãos (não agitar) até ficar leitoso por igual.' },
      viaProibida: { IV: 'NPH NUNCA vai na veia (é suspensão).', IM: 'NPH não é IM.' },
      restricoes: [],
      contraindicacoes: ['Hipoglicemia no momento', 'Alergia à insulina'],
      condicoes: {},
      alergiaTermos: ['insulin'],
      alertas: [
        'Meça a glicemia capilar antes.',
        'Mistura NPH + Regular na mesma seringa: aspire primeiro a REGULAR (transparente), depois a NPH (leitosa).',
        'Use seringa de insulina (em UI).'
      ]
    },

    {
      id: 'heparina',
      nome: 'Heparina sódica',
      sinonimos: 'heparina nao fracionada hnf liquemine',
      classe: 'Anticoagulante',
      mav: true,
      unidade: 'UI',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Ampola SC 5.000 UI/0,25 mL (20.000 UI/mL)', conc: 20000, vol: 0.25, vias: ['SC'] },
        { tipo: 'solucao', nome: 'Frasco 5.000 UI/mL — 5 mL (25.000 UI)', conc: 5000, vol: 5, vias: ['IV', 'SC'] }
      ],
      faixas: [
        {
          nome: 'Profilaxia de trombose (SC)',
          vias: ['SC'],
          adulto: { min: 5000, max: 5000, lim: 7500, limDia: 15000, texto: '5.000 UI SC a cada 8 ou 12 h.' },
          ped: null
        },
        {
          nome: 'Tratamento — bolus IV (protocolo)',
          vias: ['IV'],
          adulto: { porKg: true, min: 60, max: 80, lim: 80, limAbs: 10000, texto: 'Bolus 60–80 UI/kg (máx. ~10.000 UI) seguido de infusão contínua por protocolo e TTPa.' },
          ped: null
        }
      ],
      administracao: {
        SC: 'SC no abdome (2 cm longe do umbigo). Não aspire e não massageie o local.',
        IV: 'Bolus IV e depois bomba de infusão. Dupla checagem da programação.'
      },
      viaProibida: { IM: 'NUNCA IM: hematoma.' },
      restricoes: [],
      contraindicacoes: ['Sangramento ativo', 'Plaquetopenia grave ou plaquetopenia induzida por heparina (HIT) prévia', 'Alergia à heparina', 'AVC hemorrágico recente'],
      condicoes: {},
      antidoto: 'Sulfato de protamina.',
      alergiaTermos: ['heparin'],
      alertas: [
        'Existem frascos de concentrações muito diferentes (5.000 UI/mL e 20.000 UI/mL): confira o rótulo duas vezes.',
        'Verifique plaquetas e TTPa conforme protocolo. Observe sangramentos.'
      ]
    },

    {
      id: 'enoxaparina',
      nome: 'Enoxaparina',
      sinonimos: 'clexane heparina baixo peso',
      classe: 'Anticoagulante (heparina de baixo peso)',
      mav: true,
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Seringa 20 mg/0,2 mL', conc: 100, vol: 0.2, vias: ['SC'] },
        { tipo: 'solucao', nome: 'Seringa 40 mg/0,4 mL', conc: 100, vol: 0.4, vias: ['SC'] },
        { tipo: 'solucao', nome: 'Seringa 60 mg/0,6 mL', conc: 100, vol: 0.6, vias: ['SC'] },
        { tipo: 'solucao', nome: 'Seringa 80 mg/0,8 mL', conc: 100, vol: 0.8, vias: ['SC'] },
        { tipo: 'solucao', nome: 'Seringa 100 mg/1 mL', conc: 100, vol: 1, vias: ['SC'] }
      ],
      faixas: [
        {
          nome: 'Profilaxia',
          vias: ['SC'],
          adulto: { min: 20, max: 40, lim: 40, limDia: 80, texto: '40 mg SC 1x/dia (20 mg se ClCr < 30).' },
          ped: null
        },
        {
          nome: 'Tratamento',
          vias: ['SC'],
          adulto: { porKg: true, min: 1, max: 1.5, lim: 1.5, limDia: 2, texto: '1 mg/kg a cada 12 h ou 1,5 mg/kg 1x/dia (ClCr < 30: 1 mg/kg 1x/dia).' },
          ped: null
        }
      ],
      administracao: { SC: 'SC na lateral do abdome, alternando lados. Não retire a bolha de ar da seringa pronta, não aspire e não massageie.' },
      viaProibida: { IM: 'NUNCA IM: hematoma.' },
      restricoes: [],
      contraindicacoes: ['Sangramento ativo', 'Plaquetopenia induzida por heparina (HIT)', 'Alergia a heparinas', 'Punção/cateter peridural recente (conferir intervalo de segurança)'],
      condicoes: { renal: { nivel: 'alto', texto: 'ClCr < 30: dose precisa ser reduzida.' } },
      antidoto: 'Sulfato de protamina (reversão parcial).',
      alergiaTermos: ['enoxaparin', 'clexane', 'heparin'],
      alertas: ['Observe sangramento (gengiva, urina, fezes, hematomas).', 'Se a dose for menor que a seringa, despreze o excesso ANTES de aplicar, com a seringa na vertical.']
    },

    {
      id: 'kcl',
      nome: 'Cloreto de potássio 19,1%',
      sinonimos: 'kcl potassio',
      classe: 'Eletrólito concentrado',
      mav: true,
      unidade: 'mEq',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Ampola 19,1% — 10 mL (2,56 mEq/mL = 25,6 mEq)', conc: 2.56, vol: 10, vias: ['IV'] }
      ],
      faixas: [{
        nome: 'Reposição de potássio',
        vias: ['IV'],
        adulto: { min: 10, max: 40, lim: 40, texto: 'Dose por bolsa em geral 10–40 mEq, sempre diluída.' },
        ped: { porKg: true, min: 0.5, max: 1, lim: 1, limAbs: 40, texto: '0,5 a 1 mEq/kg por reposição (máx. 40 mEq), em 1–2 h no mínimo.' }
      }],
      infusao: {
        exigeDiluicao: true,
        maxConcPerif: 0.04, maxConcPerifAlta: 0.08, maxConcCentral: 0.2,
        taxaMaxHoraPerif: 10, taxaMaxHoraCentral: 20, pedTaxaMaxKgH: 0.5,
        unidadeConc: 'mEq/L', fatorConc: 1000
      },
      administracao: { IV: 'SEMPRE diluído em SF 0,9% (ou SG 5%) e em bomba de infusão. Homogeneizar bem a bolsa (inverter várias vezes).' },
      viaProibida: { IM: 'Não é IM.', SC: 'Não é SC.' },
      restricoes: [],
      contraindicacoes: ['Hipercalemia (potássio alto)', 'Insuficiência renal grave / anúria sem controle', 'Uso de poupadores de potássio sem controle de K'],
      condicoes: { renal: { nivel: 'alto', texto: 'Insuficiência renal: alto risco de hipercalemia. Exige potássio sérico recente.' } },
      alergiaTermos: [],
      alertas: [
        'NUNCA IV direto (em bolus/push): causa parada cardíaca.',
        'Tenha potássio sérico recente e, acima de 10 mEq/h, monitor cardíaco.',
        'Dor/queimação no acesso = concentração alta: avise.'
      ]
    },

    {
      id: 'glicose50',
      nome: 'Glicose 50%',
      sinonimos: 'glicose hipertonica dextrose sg 50 hipoglicemia',
      classe: 'Solução hipertônica',
      mav: true,
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Ampola 50% — 10 mL (500 mg/mL = 5 g)', conc: 500, vol: 10, vias: ['IV'] }
      ],
      faixas: [{
        nome: 'Hipoglicemia',
        vias: ['IV'],
        adulto: { min: 10000, max: 25000, lim: 25000, texto: 'Hipoglicemia: 10 a 25 g (20 a 50 mL de glicose 50%) IV lenta. Repetir conforme glicemia.' },
        ped: { porKg: true, min: 200, max: 500, lim: 500, limAbs: 25000, texto: '0,2 a 0,5 g/kg — em crianças use glicose 10% (2 a 5 mL/kg).' }
      }],
      infusao: { minutosIVDireta: 2 },
      administracao: { IV: 'IV lenta em veia calibrosa, conferindo o retorno venoso (extravasamento causa necrose). Lave o acesso com SF depois.' },
      viaProibida: { IM: 'Nunca IM.', SC: 'Nunca SC: necrose.' },
      restricoes: [
        { se: function (c) { return c.anos < 12; }, nivel: 'alto', titulo: 'Criança: não use a 50% pura',
          texto: 'Muito irritante para veia de criança. Use glicose 10% (dilua: 1 parte de 50% + 4 de AD = 10%).' }
      ],
      contraindicacoes: ['Hiperglicemia', 'Hemorragia intracraniana (cautela)'],
      condicoes: {},
      alergiaTermos: [],
      alertas: ['Confirme a hipoglicemia com glicemia capilar antes e repita 15 min depois.', 'Paciente consciente e que engole: prefira açúcar por boca.']
    },

    {
      id: 'adrenalina',
      nome: 'Adrenalina (epinefrina)',
      sinonimos: 'epinefrina drenalin',
      classe: 'Vasopressor / emergência',
      mav: true,
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Ampola 1 mg/mL — 1 mL (1:1.000)', conc: 1, vol: 1, vias: ['IV', 'IO', 'IM'] }
      ],
      faixas: [
        {
          nome: 'Parada cardíaca (IV/IO)',
          vias: ['IV', 'IO'],
          adulto: { min: 1, max: 1, lim: 1, texto: '1 mg IV/IO a cada 3–5 min.' },
          ped: { porKg: true, min: 0.01, max: 0.01, lim: 0.01, limAbs: 1, texto: '0,01 mg/kg (0,1 mL/kg da solução diluída 0,1 mg/mL), máx. 1 mg, a cada 3–5 min.' }
        },
        {
          nome: 'Anafilaxia (IM)',
          vias: ['IM'],
          adulto: { min: 0.3, max: 0.5, lim: 0.5, texto: '0,3 a 0,5 mg IM (vasto lateral da coxa), pode repetir a cada 5–15 min.' },
          ped: { porKg: true, min: 0.01, max: 0.01, lim: 0.01, limAbs: 0.5, texto: '0,01 mg/kg IM, máx. 0,3 mg (criança) e 0,5 mg (adolescente).' }
        }
      ],
      administracao: {
        IV: 'PCR adulto: 1 mg sem diluir + 20 mL de SF em bolus e elevar o membro. PCR criança: diluir 1 mL + 9 mL de SF (0,1 mg/mL).',
        IO: 'Mesma dose da via IV.',
        IM: 'IM no vasto lateral da coxa, SEM diluir.'
      },
      restricoes: [
        { se: function (c) { return c.via === 'IV' && c.faixa && /Anafil/.test(c.faixa.nome); }, nivel: 'bloqueio', titulo: 'Anafilaxia é IM', texto: 'Adrenalina 1 mg/mL em bolus IV em paciente com pulso causa arritmia e AVC.' }
      ],
      contraindicacoes: ['Em emergência (PCR/anafilaxia) não há contraindicação absoluta'],
      condicoes: {},
      alergiaTermos: [],
      alertas: ['Em PCR ou anafilaxia, não atrase a dose: chame ajuda e siga o protocolo.', 'Confira a dose em voz alta com a equipe (comunicação em alça fechada).']
    },

    {
      id: 'amiodarona',
      nome: 'Amiodarona',
      sinonimos: 'ancoron atlansil antiarritmico',
      classe: 'Antiarrítmico',
      mav: true,
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Ampola 50 mg/mL — 3 mL (150 mg)', conc: 50, vol: 3, vias: ['IV', 'IO'] }
      ],
      faixas: [
        {
          nome: 'Parada cardíaca (FV/TV sem pulso)',
          vias: ['IV', 'IO'],
          adulto: { min: 150, max: 300, lim: 300, texto: '1ª dose 300 mg em bolus; 2ª dose 150 mg.' },
          ped: { porKg: true, min: 5, max: 5, lim: 5, limAbs: 300, texto: '5 mg/kg em bolus (máx. 300 mg), pode repetir até 15 mg/kg.' }
        },
        {
          nome: 'Arritmia com pulso (ataque)',
          vias: ['IV'],
          adulto: { min: 150, max: 150, lim: 300, texto: '150 mg em 100 mL de SG 5% em 10 min; depois manutenção em bomba (1 mg/min por 6 h).' },
          ped: { porKg: true, min: 5, max: 5, lim: 5, limAbs: 300, texto: '5 mg/kg em 20–60 min.' }
        }
      ],
      infusao: { maxConcPerif: 2 },
      administracao: {
        IV: 'Diluir em SG 5% (preferência). Infusões longas acima de 2 mg/mL: acesso central (flebite).',
        IO: 'Mesma dose da via IV.'
      },
      restricoes: [],
      contraindicacoes: ['Bradicardia sinusal ou bloqueio AV sem marca-passo', 'Doença de tireoide', 'Alergia a iodo ou à amiodarona', 'Gestação'],
      condicoes: { gestante: { nivel: 'alto', texto: 'Contraindicada na gestação (fora da PCR).' } },
      alergiaTermos: ['amiodaron', 'ancoron', 'iodo'],
      alertas: ['Fora da PCR: monitor cardíaco e PA durante a infusão (hipotensão e bradicardia).']
    },

    {
      id: 'diclofenaco',
      nome: 'Diclofenaco sódico',
      sinonimos: 'voltaren cataflam aine anti-inflamatorio',
      classe: 'Anti-inflamatório (AINE)',
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Ampola 25 mg/mL — 3 mL (75 mg)', conc: 25, vol: 3, vias: ['IM'] },
        { tipo: 'solido', nome: 'Comprimido 50 mg', qtd: 50, vias: ['VO'], sulcado: false }
      ],
      faixas: [{
        nome: 'Dor / inflamação',
        vias: ['IM', 'VO'],
        adulto: { min: 50, max: 75, lim: 75, limDia: 150, texto: 'IM: 75 mg 1x/dia (no máximo 2 dias). Máximo 150 mg/dia.' },
        ped: null
      }],
      administracao: { IM: 'IM profunda no quadrante superior externo do glúteo (ventroglúteo/dorsoglúteo), lentamente. Alterne o lado se repetir.', VO: 'Com alimento.' },
      viaProibida: { IV: 'Esta ampola não é para IV direta.', SC: 'Nunca SC: necrose.' },
      restricoes: [
        { se: function (c) { return c.anos < 18; }, nivel: 'alto', titulo: 'Menor de 18 anos', texto: 'O diclofenaco injetável não é indicado para crianças e adolescentes.' }
      ],
      contraindicacoes: ['Úlcera ou sangramento gastrointestinal', 'Asma/urticária por AINE', 'Insuficiência renal, hepática ou cardíaca grave', 'Pós-operatório de revascularização (ponte de safena)', '3º trimestre da gestação', 'Dengue suspeita ou confirmada'],
      condicoes: {
        gestante: { nivel: 'alto', texto: 'Evitar na gestação; contraindicado no 3º trimestre.' },
        renal: { nivel: 'alto', texto: 'AINE piora a função renal.' },
        hepatica: { nivel: 'alto', texto: 'Contraindicado na insuficiência hepática grave.' }
      },
      idoso: 'Idosos: maior risco de sangramento gástrico e lesão renal.',
      alergiaTermos: ['diclofenac', 'voltaren', 'cataflam', 'aine', 'anti-inflamat'],
      alertas: ['Pergunte sobre dengue: AINE aumenta o risco de sangramento.']
    },

    {
      id: 'cetoprofeno',
      nome: 'Cetoprofeno',
      sinonimos: 'profenid aine anti-inflamatorio',
      classe: 'Anti-inflamatório (AINE)',
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'po', nome: 'Frasco-ampola IV 100 mg (pó)', total: 100, vias: ['IV'],
          reconst: { IV: { diluente: 'diluente/AD conforme a bula do fabricante', vol: null, volFinal: null } },
          nota: 'Use o frasco inteiro diluído em 100–150 mL de SF 0,9% ou SG 5%.' },
        { tipo: 'solucao', nome: 'Ampola IM 50 mg/mL — 2 mL (100 mg)', conc: 50, vol: 2, vias: ['IM'] }
      ],
      faixas: [{
        nome: 'Dor / inflamação',
        vias: ['IV', 'IM'],
        adulto: { min: 100, max: 100, lim: 100, limDia: 300, texto: '100 mg a cada 8–12 h. Máximo 300 mg/dia.' },
        ped: null
      }],
      infusao: { exigeDiluicao: true, tempoMin: 20 },
      administracao: {
        IV: 'Diluir em 100–150 mL de SF 0,9% ou SG 5% e infundir em pelo menos 20 minutos. Proteger da luz.',
        IM: 'IM profunda no glúteo.'
      },
      restricoes: [
        { se: function (c) { return c.anos < 15; }, nivel: 'alto', titulo: 'Menor de 15 anos', texto: 'Não recomendado abaixo de 15 anos.' }
      ],
      contraindicacoes: ['Úlcera ou sangramento gastrointestinal', 'Asma/urticária por AINE', 'Insuficiência renal, hepática ou cardíaca grave', '3º trimestre da gestação', 'Dengue suspeita ou confirmada'],
      condicoes: {
        gestante: { nivel: 'alto', texto: 'Evitar na gestação; contraindicado no 3º trimestre.' },
        renal: { nivel: 'alto', texto: 'AINE piora a função renal.' },
        hepatica: { nivel: 'alto', texto: 'Cautela na insuficiência hepática.' }
      },
      idoso: 'Idosos: maior risco de sangramento gástrico e lesão renal.',
      alergiaTermos: ['cetoprofen', 'profenid', 'aine', 'anti-inflamat'],
      alertas: ['Pergunte sobre dengue: AINE aumenta o risco de sangramento.']
    },

    {
      id: 'omeprazol',
      nome: 'Omeprazol IV',
      sinonimos: 'losec protetor gastrico',
      classe: 'Inibidor de bomba de prótons',
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'po', nome: 'Frasco-ampola 40 mg (pó) + diluente 10 mL', total: 40, vias: ['IV'],
          reconst: { IV: { diluente: '10 mL do diluente próprio que acompanha', vol: 10, volFinal: 10 } },
          nota: '40 mg em 10 mL = 4 mg/mL.' }
      ],
      faixas: [{
        nome: 'Proteção gástrica / úlcera',
        vias: ['IV'],
        adulto: { min: 20, max: 40, lim: 80, limDia: 160, texto: '40 mg 1x/dia (hemorragia digestiva: 80 mg em bolus e depois infusão por protocolo).' },
        ped: { porKg: true, min: 0.5, max: 1, lim: 1, limAbs: 40, texto: '0,5 a 1 mg/kg 1x/dia (máx. 40 mg).' }
      }],
      infusao: { minutosIVDireta: 2.5 },
      administracao: { IV: 'IV direta lenta em no mínimo 2,5 min (até 4 mL/min), ou diluído em 100 mL de SF/SG 5% em 20–30 min.' },
      restricoes: [],
      contraindicacoes: ['Alergia ao omeprazol ou benzimidazóis', 'Uso de nelfinavir/atazanavir'],
      condicoes: {},
      alergiaTermos: ['omeprazol', 'prazol'],
      alertas: ['Use apenas o diluente que acompanha o frasco para a IV direta.']
    },

    {
      id: 'escopolamina',
      nome: 'Escopolamina (butilbrometo)',
      sinonimos: 'buscopan hioscina antiespasmodico',
      classe: 'Antiespasmódico',
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Ampola 20 mg/mL — 1 mL (Buscopan simples)', conc: 20, vol: 1, vias: ['IV', 'IM', 'SC'] },
        { tipo: 'solido', nome: 'Drágea 10 mg', qtd: 10, vias: ['VO'], sulcado: false }
      ],
      faixas: [{
        nome: 'Cólica / espasmo',
        vias: ['IV', 'IM', 'SC', 'VO'],
        adulto: { min: 10, max: 40, lim: 40, limDia: 100, texto: '20 a 40 mg até 3–5x/dia. Máximo 100 mg/dia.' },
        ped: { porKg: true, min: 0.3, max: 0.6, lim: 0.6, limAbs: 20, limDia: 1.5, limDiaAbs: 100, texto: '0,3 a 0,6 mg/kg/dose (máx. 1,5 mg/kg/dia).' }
      }],
      infusao: { minutosIVDireta: 1 },
      administracao: { IV: 'IV direta lenta (1 min) ou diluída em SF/SG.', IM: 'IM.', SC: 'SC.' },
      restricoes: [],
      contraindicacoes: ['Glaucoma de ângulo fechado', 'Miastenia gravis', 'Megacólon', 'Taquiarritmia', 'Hiperplasia de próstata com retenção urinária', 'Íleo paralítico'],
      condicoes: {},
      alergiaTermos: ['escopolamin', 'buscopan', 'hioscin'],
      alertas: ['Buscopan COMPOSTO tem dipirona junto (2,5 g na ampola de 5 mL): confira qual está na mão e as alergias/contraindicações da dipirona.', 'Pode causar taquicardia e boca seca.']
    },

    {
      id: 'midazolam',
      nome: 'Midazolam',
      sinonimos: 'dormonid dormire benzodiazepinico sedativo',
      classe: 'Sedativo (benzodiazepínico)',
      mav: true,
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Ampola 5 mg/mL — 3 mL (15 mg)', conc: 5, vol: 3, vias: ['IV', 'IM'] },
        { tipo: 'solucao', nome: 'Ampola 5 mg/mL — 10 mL (50 mg)', conc: 5, vol: 10, vias: ['IV', 'IM'] },
        { tipo: 'solucao', nome: 'Ampola 1 mg/mL — 5 mL (5 mg)', conc: 1, vol: 5, vias: ['IV', 'IM'] }
      ],
      faixas: [
        {
          nome: 'Sedação (IV, titulada)',
          vias: ['IV'],
          adulto: { min: 0.5, max: 2.5, lim: 5, texto: '1 a 2,5 mg IV lento, repetir em pequenas doses (idosos: 0,5 a 1 mg).' },
          ped: { porKg: true, min: 0.05, max: 0.1, lim: 0.2, limAbs: 6, texto: '0,05 a 0,1 mg/kg IV (máx. total 6 mg em < 6 anos; 10 mg em 6–12 anos).' }
        },
        {
          nome: 'Crise convulsiva (IM)',
          vias: ['IM'],
          adulto: { min: 10, max: 10, lim: 10, texto: '10 mg IM (> 40 kg).' },
          ped: { porKg: true, min: 0.2, max: 0.2, lim: 0.2, limAbs: 10, texto: '0,2 mg/kg IM (13–40 kg: 5 mg; > 40 kg: 10 mg).' }
        }
      ],
      infusao: { minutosIVDireta: 2 },
      administracao: {
        IV: 'IV lenta (≥ 2 min por dose), com oxímetro. Pode diluir em SF para facilitar a titulação.',
        IM: 'IM profunda (vasto lateral ou deltoide em crianças maiores).'
      },
      restricoes: [],
      contraindicacoes: ['Alergia a benzodiazepínicos', 'Glaucoma de ângulo fechado', 'Insuficiência respiratória grave (sem suporte ventilatório)', 'Miastenia gravis', 'Choque'],
      condicoes: {
        gestante: { nivel: 'alto', texto: 'Evitar, sobretudo no fim da gestação.' },
        hepatica: { nivel: 'alto', texto: 'Insuficiência hepática: efeito prolongado, reduzir dose.' }
      },
      idoso: 'Idosos: muito sensíveis — comece com 0,5–1 mg e espere o efeito antes de repetir.',
      antidoto: 'Flumazenil.',
      alergiaTermos: ['midazolam', 'dormonid', 'benzodiazep', 'diazepam'],
      alertas: ['Oxímetro, material de via aérea e ambu à beira-leito.', 'Não confunda as ampolas de 1 mg/mL e 5 mg/mL (5 vezes mais forte).']
    },

    {
      id: 'gentamicina',
      nome: 'Gentamicina',
      sinonimos: 'garamicina aminoglicosideo',
      classe: 'Antibiótico (aminoglicosídeo)',
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'solucao', nome: 'Ampola 40 mg/mL — 2 mL (80 mg)', conc: 40, vol: 2, vias: ['IV', 'IM'] },
        { tipo: 'solucao', nome: 'Ampola 40 mg/mL — 1 mL (40 mg)', conc: 40, vol: 1, vias: ['IV', 'IM'] },
        { tipo: 'solucao', nome: 'Ampola 10 mg/mL — 1 mL (pediátrica)', conc: 10, vol: 1, vias: ['IV', 'IM'] }
      ],
      faixas: [{
        nome: 'Infecções',
        vias: ['IV', 'IM'],
        adulto: { porKg: true, min: 3, max: 7, lim: 7, limDia: 7, texto: '3 a 5 mg/kg/dia (até 7 mg/kg 1x/dia), ajustado pela função renal.' },
        ped: { porKg: true, min: 2.5, max: 7.5, lim: 7.5, limDia: 7.5, texto: '5 a 7,5 mg/kg/dia (1x/dia ou dividido).' }
      }],
      infusao: { exigeDiluicao: true, tempoMin: 30 },
      administracao: { IV: 'Diluir em 50–100 mL de SF 0,9% e infundir em 30–60 min.', IM: 'IM profunda.' },
      restricoes: [],
      contraindicacoes: ['Alergia a aminoglicosídeos', 'Miastenia gravis'],
      condicoes: { renal: { nivel: 'alto', texto: 'Nefrotóxico: dose e intervalo pela função renal (dosar creatinina/nível sérico).' }, gestante: { nivel: 'alto', texto: 'Risco de surdez fetal.' } },
      alergiaTermos: ['gentamic', 'aminoglic', 'amicacin'],
      alertas: ['Nefrotóxica e ototóxica: controle diurese; avise se zumbido ou perda de audição.']
    },

    {
      id: 'vancomicina',
      nome: 'Vancomicina',
      sinonimos: 'vancocina glicopeptideo',
      classe: 'Antibiótico (glicopeptídeo)',
      unidade: 'mg',
      apresentacoes: [
        { tipo: 'po', nome: 'Frasco-ampola 500 mg (pó)', total: 500, vias: ['IV'],
          reconst: { IV: { diluente: '10 mL de água destilada', vol: 10, volFinal: 10 } }, nota: '500 mg em 10 mL = 50 mg/mL (ainda precisa ser diluída).' },
        { tipo: 'po', nome: 'Frasco-ampola 1 g (pó)', total: 1000, vias: ['IV'],
          reconst: { IV: { diluente: '20 mL de água destilada', vol: 20, volFinal: 20 } }, nota: '1 g em 20 mL = 50 mg/mL (ainda precisa ser diluída).' }
      ],
      faixas: [{
        nome: 'Infecções graves',
        vias: ['IV'],
        adulto: { porKg: true, min: 15, max: 20, lim: 30, limAbs: 3000, texto: '15 a 20 mg/kg a cada 8–12 h (ataque até 25–30 mg/kg), guiado por nível sérico.' },
        ped: { porKg: true, min: 10, max: 15, lim: 20, limAbs: 2000, limDia: 80, texto: '15 mg/kg a cada 6 h (40–60 mg/kg/dia).' }
      }],
      infusao: { exigeDiluicao: true, taxaMaxMin: 10, tempoMin: 60, maxConcPerif: 5 },
      administracao: { IV: 'Diluir para no máximo 5 mg/mL (ex.: 1 g em 200–250 mL de SF/SG 5%) e infundir em ≥ 60 min (no máximo 10 mg/min).' },
      viaProibida: { IM: 'Nunca IM: necrose.' },
      restricoes: [],
      contraindicacoes: ['Alergia à vancomicina'],
      condicoes: { renal: { nivel: 'alto', texto: 'Nefrotóxica: dose pela função renal e nível sérico (vale).' } },
      alergiaTermos: ['vancomic'],
      alertas: ['Infusão rápida causa "síndrome do homem vermelho" (vermelhidão, coceira, hipotensão): pare e avise.']
    }
  ];
})();
