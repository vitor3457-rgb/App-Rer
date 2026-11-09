/**
 * ============================================================
 *  SERVIDOR DO APP (Google Apps Script)
 *  Funções públicas chamadas pelo celular (google.script.run):
 *    - obterSugestoesDespesa()
 *    - salvarLancamento(dados)
 *    - listarLancamentos(ano, mes)
 *    - excluirLancamento(id)
 *  Funções terminadas em "_" são internas (o celular não consegue chamá-las).
 * ============================================================
 */

/** Colunas da aba de lançamentos, na ordem em que ficam na planilha. */
var COLUNAS = [
  'ID',
  'Data/hora do lançamento',
  'Data de referência',
  'Ano',
  'Mês',
  'Tipo',
  'Categoria',
  'Descrição',
  'Valor',
  'Usuário',
];

/** Posição (começando em 0) de cada coluna. */
var COL = {
  ID: 0,
  DATA_HORA: 1,
  DATA_REF: 2,
  ANO: 3,
  MES: 4,
  TIPO: 5,
  CATEGORIA: 6,
  DESCRICAO: 7,
  VALOR: 8,
  USUARIO: 9,
};

/** Formato de cada coluna na planilha ("@" = texto puro). */
var FORMATOS = [
  '@',
  'dd/mm/yyyy hh:mm:ss',
  'dd/mm/yyyy',
  '0',
  '0',
  '@',
  '@',
  '@',
  '"R$" #,##0.00',
  '@',
];

/** A aba de excluídos repete as colunas e acrescenta quem/quando excluiu. */
var COLUNAS_EXCLUIDOS = COLUNAS.concat(['Excluído em', 'Excluído por']);
var FORMATOS_EXCLUIDOS = FORMATOS.concat(['dd/mm/yyyy hh:mm:ss', '@']);

var TIPO_ENTRADA = 'Entrada';
var TIPO_SAIDA = 'Saída';
var CATEGORIAS_ENTRADA = ['Dízimo', 'Oferta'];
var CATEGORIA_SAIDA = 'Despesa';

var NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Tempo máximo esperando a vez de gravar (2 pessoas ao mesmo tempo). */
var ESPERA_TRAVA_MS = 30000;

// ------------------------------------------------------------
//  Página do app
// ------------------------------------------------------------

/** Abre o app no navegador. */
function doGet() {
  var email = emailUsuarioAtual_();

  if (!usuarioAutorizado_(email)) {
    var negado = HtmlService.createTemplateFromFile('AcessoNegado');
    negado.email = email;
    negado.nomeApp = CONFIG.NOME_APP;
    return prepararPagina_(negado.evaluate());
  }

  var pagina = HtmlService.createTemplateFromFile('Index');
  pagina.nomeApp = CONFIG.NOME_APP;
  pagina.dadosJson = jsonParaHtml_(dadosIniciais_(email));
  return prepararPagina_(pagina.evaluate());
}

/** Título, ícone e ajustes para celular. */
function prepararPagina_(saida) {
  saida.setTitle(CONFIG.NOME_APP);
  // O Google só aceita algumas meta tags; se alguma for recusada, a página abre mesmo assim.
  [
    ['viewport', 'width=device-width, initial-scale=1'],
    ['mobile-web-app-capable', 'yes'],
    ['apple-mobile-web-app-capable', 'yes'],
  ].forEach(function (meta) {
    try {
      saida.addMetaTag(meta[0], meta[1]);
    } catch (e) {
      console.warn('Meta tag recusada (' + meta[0] + '): ' + mensagemDe_(e));
    }
  });
  if (CONFIG.ICONE_URL) {
    saida.setFaviconUrl(CONFIG.ICONE_URL);
  }
  return saida;
}

/** Usado dentro dos arquivos HTML para juntar Estilos e Script. */
function incluir_(nomeArquivo) {
  return HtmlService.createHtmlOutputFromFile(nomeArquivo).getContent();
}

/** Dados enviados junto com a página (evita uma ida extra ao servidor). */
function dadosIniciais_(email) {
  var agora = new Date();
  return {
    email: email,
    nomeApp: CONFIG.NOME_APP,
    anos: anosDisponiveis_(),
    meses: NOMES_MESES,
    categoriasEntrada: CATEGORIAS_ENTRADA,
    sugestoesDespesa: CONFIG.SUGESTOES_DESPESA || [],
    hoje: Utilities.formatDate(agora, CONFIG.FUSO_HORARIO, 'yyyy-MM-dd'),
    tamanhoMaximoDescricao: CONFIG.TAMANHO_MAXIMO_DESCRICAO,
    valorMaximoCentavos: Math.round(CONFIG.VALOR_MAXIMO * 100),
  };
}

/** Transforma um objeto em JSON seguro para colocar dentro de <script>. */
function jsonParaHtml_(objeto) {
  return JSON.stringify(objeto)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// ------------------------------------------------------------
//  Funções chamadas pelo celular
// ------------------------------------------------------------

/**
 * Sugestões de descrição para despesas: as do Config + as mais usadas.
 * Também serve para testar cedo se a pessoa tem acesso à planilha.
 */
function obterSugestoesDespesa() {
  return executar_(function () {
    var contagem = {};
    var nomeOriginal = {};
    var aba = planilha_().getSheetByName(CONFIG.ABA_LANCAMENTOS);
    if (aba && aba.getLastRow() > 1) {
      var linhas = aba.getRange(2, 1, aba.getLastRow() - 1, COLUNAS.length).getValues();
      linhas.forEach(function (linha) {
        if (normalizarTipo_(linha[COL.TIPO]) !== TIPO_SAIDA) return;
        var desc = String(linha[COL.DESCRICAO] || '').trim();
        if (!desc) return;
        var chave = semAcentos_(desc).toLowerCase();
        contagem[chave] = (contagem[chave] || 0) + 1;
        if (!nomeOriginal[chave]) nomeOriginal[chave] = desc;
      });
    }
    var maisUsadas = Object.keys(contagem)
      .sort(function (a, b) { return contagem[b] - contagem[a]; })
      .map(function (chave) { return nomeOriginal[chave]; });

    var resultado = [];
    var vistos = {};
    (CONFIG.SUGESTOES_DESPESA || []).concat(maisUsadas).forEach(function (s) {
      var chave = semAcentos_(s).toLowerCase();
      if (vistos[chave] || resultado.length >= 12) return;
      vistos[chave] = true;
      resultado.push(s);
    });
    return { ok: true, sugestoes: resultado };
  });
}

/**
 * Grava um lançamento.
 * dados = { id, valorCentavos, tipo, categoria, descricao, dataReferencia: 'aaaa-mm-dd' }
 */
function salvarLancamento(dados) {
  return executar_(function (email) {
    var l = validarLancamento_(dados);

    var trava = LockService.getScriptLock();
    pegarTrava_(trava);
    try {
      var aba = garantirAba_(CONFIG.ABA_LANCAMENTOS, COLUNAS, FORMATOS);

      // Anti-duplicação: se este ID já foi gravado (ex.: a pessoa tocou em
      // Salvar de novo porque a internet caiu), não grava outra vez.
      if (encontrarLinhaPorId_(aba, l.id) > 0) {
        return { ok: true, duplicado: true, id: l.id };
      }

      var agora = new Date();
      var linha = [];
      linha[COL.ID] = l.id;
      linha[COL.DATA_HORA] = agora;
      linha[COL.DATA_REF] = l.data;
      linha[COL.ANO] = l.ano;
      linha[COL.MES] = l.mes;
      linha[COL.TIPO] = l.tipo;
      linha[COL.CATEGORIA] = l.categoria;
      linha[COL.DESCRICAO] = l.descricao;
      linha[COL.VALOR] = l.valorCentavos / 100;
      linha[COL.USUARIO] = email;

      escreverNovaLinha_(aba, linha, FORMATOS);
      SpreadsheetApp.flush();
      return { ok: true, duplicado: false, id: l.id };
    } finally {
      trava.releaseLock();
    }
  });
}

/** Lista os lançamentos de um mês (1 a 12) com os totais. */
function listarLancamentos(ano, mes) {
  return executar_(function () {
    ano = Number(ano);
    mes = Number(mes);
    if (anosDisponiveis_().indexOf(ano) === -1) {
      throw erroUsuario_('O ano ' + ano + ' não está disponível no app.');
    }
    if (!(mes >= 1 && mes <= 12) || Math.floor(mes) !== mes) {
      throw erroUsuario_('Mês inválido. Escolha um mês de Janeiro a Dezembro.');
    }

    var itens = [];
    var ss = planilha_();
    var aba = ss.getSheetByName(CONFIG.ABA_LANCAMENTOS);
    if (aba && aba.getLastRow() > 1) {
      var fuso = ss.getSpreadsheetTimeZone() || CONFIG.FUSO_HORARIO;
      var linhas = aba.getRange(2, 1, aba.getLastRow() - 1, COLUNAS.length).getValues();
      linhas.forEach(function (linha) {
        var item = linhaParaItem_(linha, fuso);
        if (item && item.ano === ano && item.mes === mes) itens.push(item);
      });
    }

    // Mais recentes primeiro (data de referência, depois horário do lançamento).
    itens.sort(function (a, b) {
      if (a.dataReferencia !== b.dataReferencia) {
        return a.dataReferencia < b.dataReferencia ? 1 : -1;
      }
      return b.ordemLancamento - a.ordemLancamento;
    });

    return {
      ok: true,
      ano: ano,
      mes: mes,
      nomeMes: NOMES_MESES[mes - 1],
      itens: itens,
      totais: calcularTotais_(itens),
    };
  });
}

/** Exclui um lançamento (uma cópia vai para a aba "Excluidos"). */
function excluirLancamento(id) {
  return executar_(function (email) {
    id = String(id || '').trim();
    if (!id) throw erroUsuario_('Lançamento inválido.');

    var trava = LockService.getScriptLock();
    pegarTrava_(trava);
    try {
      var aba = planilha_().getSheetByName(CONFIG.ABA_LANCAMENTOS);
      var numeroLinha = aba ? encontrarLinhaPorId_(aba, id) : -1;
      if (numeroLinha < 0) {
        throw erroUsuario_(
          'Este lançamento não foi encontrado. Talvez ele já tenha sido excluído ' +
          'por outra pessoa. A lista será atualizada.'
        );
      }

      var valores = aba.getRange(numeroLinha, 1, 1, COLUNAS.length).getValues()[0];
      var abaExcluidos = garantirAba_(CONFIG.ABA_EXCLUIDOS, COLUNAS_EXCLUIDOS, FORMATOS_EXCLUIDOS);
      escreverNovaLinha_(abaExcluidos, valores.concat([new Date(), email]), FORMATOS_EXCLUIDOS);
      aba.deleteRow(numeroLinha);
      SpreadsheetApp.flush();
      return { ok: true, id: id };
    } finally {
      trava.releaseLock();
    }
  });
}

// ------------------------------------------------------------
//  Validação
// ------------------------------------------------------------

/** Confere os dados vindos do celular. Lança erro com mensagem clara se algo estiver errado. */
function validarLancamento_(dados) {
  if (!dados || typeof dados !== 'object') {
    throw erroUsuario_('Não recebi os dados do lançamento. Tente de novo.');
  }

  var id = String(dados.id || '').trim();
  if (!id) {
    id = Utilities.getUuid();
  } else if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) {
    throw erroUsuario_('Identificador do lançamento inválido. Recarregue o app e tente de novo.');
  }

  // Valor (chega em centavos, número inteiro)
  var valorCentavos = Number(dados.valorCentavos);
  if (!isFinite(valorCentavos) || valorCentavos <= 0) {
    throw erroUsuario_('Digite o valor (maior que zero).');
  }
  if (Math.round(valorCentavos) !== valorCentavos) {
    throw erroUsuario_('Valor inválido. Use no máximo 2 casas decimais.');
  }
  if (valorCentavos > Math.round(CONFIG.VALOR_MAXIMO * 100)) {
    throw erroUsuario_('Valor muito alto. O máximo por lançamento é ' +
      formatarReais_(Math.round(CONFIG.VALOR_MAXIMO * 100)) + '.');
  }

  // Tipo e categoria
  var tipo = normalizarTipo_(dados.tipo);
  if (!tipo) throw erroUsuario_('Escolha se é Entrada ou Saída.');

  var categoria;
  var descricao = limparTexto_(dados.descricao);
  if (tipo === TIPO_ENTRADA) {
    categoria = normalizarCategoriaEntrada_(dados.categoria);
    if (!categoria) throw erroUsuario_('Escolha se a entrada é Dízimo ou Oferta.');
  } else {
    categoria = CATEGORIA_SAIDA;
    if (!descricao) {
      throw erroUsuario_('Escreva a descrição da despesa (ex.: aluguel, água, luz).');
    }
  }
  if (descricao.length > CONFIG.TAMANHO_MAXIMO_DESCRICAO) {
    throw erroUsuario_('A descrição está muito longa (máximo de ' +
      CONFIG.TAMANHO_MAXIMO_DESCRICAO + ' letras).');
  }

  // Data de referência (aaaa-mm-dd)
  var textoData = String(dados.dataReferencia || '').trim();
  var partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(textoData);
  if (!partes) throw erroUsuario_('Escolha a data do lançamento.');
  var ano = Number(partes[1]);
  var mes = Number(partes[2]);
  var dia = Number(partes[3]);
  var data = null;
  try {
    data = Utilities.parseDate(textoData, CONFIG.FUSO_HORARIO, 'yyyy-MM-dd');
  } catch (e) {
    data = null;
  }
  if (!data || isNaN(data.getTime()) ||
      Utilities.formatDate(data, CONFIG.FUSO_HORARIO, 'yyyy-MM-dd') !== textoData) {
    throw erroUsuario_('A data ' + dia + '/' + mes + '/' + ano + ' não existe. Confira a data.');
  }
  var anos = anosDisponiveis_();
  if (anos.indexOf(ano) === -1) {
    throw erroUsuario_('A data precisa ser de ' + listarAnos_(anos) + '. ' +
      'Para lançar em ' + ano + ', o ano precisa ser incluído nas configurações do app.');
  }

  return {
    id: id,
    valorCentavos: valorCentavos,
    tipo: tipo,
    categoria: categoria,
    descricao: descricao,
    data: data,
    ano: ano,
    mes: mes,
  };
}

// ------------------------------------------------------------
//  Planilha
// ------------------------------------------------------------

/** Abre a planilha (pelo ID do Config ou a planilha vinculada ao script). */
function planilha_() {
  var ss = null;
  try {
    ss = CONFIG.PLANILHA_ID
      ? SpreadsheetApp.openById(CONFIG.PLANILHA_ID)
      : SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    throw erroUsuario_(
      'Você não tem acesso à planilha do app. Peça ao responsável para compartilhar ' +
      'a planilha com o seu e-mail como "Editor". (Detalhe: ' + mensagemDe_(e) + ')'
    );
  }
  if (!ss) {
    throw erroUsuario_('Planilha não encontrada. Confira o PLANILHA_ID no arquivo Config.js.');
  }
  return ss;
}

/**
 * Devolve a aba pedida, criando-a com cabeçalho e formatação se ainda não existir.
 * Deve ser chamada com a trava (LockService) já obtida.
 */
function garantirAba_(nome, colunas, formatos) {
  var ss = planilha_();
  var aba = ss.getSheetByName(nome);

  if (!aba) {
    var abas = ss.getSheets();
    var primeira = abas.length === 1 ? abas[0] : null;
    if (primeira && primeira.getLastRow() === 0 && primeira.getLastColumn() === 0 &&
        nome === CONFIG.ABA_LANCAMENTOS) {
      // Planilha nova: reaproveita a "Página1" vazia.
      aba = primeira.setName(nome);
      configurarPlanilhaNova_(ss);
    } else {
      aba = ss.insertSheet(nome);
    }
  }

  if (aba.getLastRow() === 0) {
    escreverCabecalho_(aba, colunas, formatos);
  } else {
    conferirCabecalho_(aba, colunas);
  }
  return aba;
}

/** Fuso e idioma da planilha iguais aos do app (datas corretas). */
function configurarPlanilhaNova_(ss) {
  try {
    ss.setSpreadsheetTimeZone(CONFIG.FUSO_HORARIO);
    ss.setSpreadsheetLocale('pt_BR');
  } catch (e) {
    console.warn('Não foi possível ajustar fuso/idioma da planilha: ' + mensagemDe_(e));
  }
}

function escreverCabecalho_(aba, colunas, formatos) {
  var cabecalho = aba.getRange(1, 1, 1, colunas.length);
  cabecalho.setValues([colunas])
    .setFontWeight('bold')
    .setBackground('#e8eaf6');
  aba.setFrozenRows(1);
  // Formato das colunas para as linhas já existentes na grade.
  var linhasGrade = aba.getMaxRows() - 1;
  if (linhasGrade > 0) {
    var formatoColunas = [];
    for (var i = 0; i < linhasGrade; i++) formatoColunas.push(formatos);
    aba.getRange(2, 1, linhasGrade, colunas.length).setNumberFormats(formatoColunas);
  }
  aba.autoResizeColumns(1, colunas.length);
}

/** Evita gravar em colunas erradas se alguém mexer no cabeçalho. */
function conferirCabecalho_(aba, colunas) {
  var atual = aba.getRange(1, 1, 1, colunas.length).getValues()[0];
  for (var i = 0; i < colunas.length; i++) {
    if (semAcentos_(String(atual[i]).trim()).toLowerCase() !==
        semAcentos_(colunas[i]).toLowerCase()) {
      throw erroUsuario_(
        'O cabeçalho da aba "' + aba.getName() + '" foi alterado (coluna ' + (i + 1) +
        ' deveria ser "' + colunas[i] + '"). Corrija a linha 1 da planilha para o app voltar a gravar.'
      );
    }
  }
}

/** Escreve uma linha logo abaixo da última, com o formato de cada coluna. */
function escreverNovaLinha_(aba, valores, formatos) {
  var ultima = aba.getLastRow();
  if (ultima >= aba.getMaxRows()) {
    aba.insertRowsAfter(aba.getMaxRows(), 100);
  }
  var faixa = aba.getRange(ultima + 1, 1, 1, valores.length);
  // O formato vem antes dos valores: com "texto puro", uma descrição que começa
  // com "=" fica como texto e não vira fórmula.
  faixa.setNumberFormats([formatos]);
  faixa.setValues([valores]);
}

/** Número da linha (na planilha) que tem esse ID, ou -1. */
function encontrarLinhaPorId_(aba, id) {
  var ultima = aba.getLastRow();
  if (ultima < 2) return -1;
  var ids = aba.getRange(2, COL.ID + 1, ultima - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === id) return i + 2;
  }
  return -1;
}

/** Converte uma linha da planilha no objeto enviado ao celular (ou null se for inválida). */
function linhaParaItem_(linha, fuso) {
  var tipo = normalizarTipo_(linha[COL.TIPO]);
  var valor = numeroDaPlanilha_(linha[COL.VALOR]);
  if (!tipo || valor === null) return null;

  var dataRef = linha[COL.DATA_REF];
  var textoData = '';
  if (dataRef instanceof Date && !isNaN(dataRef.getTime())) {
    textoData = Utilities.formatDate(dataRef, fuso, 'yyyy-MM-dd');
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(String(dataRef))) {
    textoData = String(dataRef);
  } else {
    var br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(dataRef).trim());
    if (br) textoData = br[3] + '-' + doisDigitos_(br[2]) + '-' + doisDigitos_(br[1]);
  }

  var ano = Number(linha[COL.ANO]);
  var mes = Number(linha[COL.MES]);
  if (!ano && textoData) ano = Number(textoData.slice(0, 4));
  if (!mes && textoData) mes = Number(textoData.slice(5, 7));

  var dataHora = linha[COL.DATA_HORA];
  var temDataHora = dataHora instanceof Date && !isNaN(dataHora.getTime());

  var categoria = String(linha[COL.CATEGORIA] || '').trim();
  if (tipo === TIPO_ENTRADA) categoria = normalizarCategoriaEntrada_(categoria) || categoria;

  return {
    id: String(linha[COL.ID] || '').trim(),
    dataReferencia: textoData,
    ano: ano,
    mes: mes,
    tipo: tipo,
    categoria: categoria,
    descricao: String(linha[COL.DESCRICAO] || '').trim(),
    valorCentavos: Math.round(Math.abs(valor) * 100),
    usuario: String(linha[COL.USUARIO] || '').trim(),
    dataHoraLancamento: temDataHora ? Utilities.formatDate(dataHora, fuso, 'dd/MM/yyyy HH:mm') : '',
    ordemLancamento: temDataHora ? dataHora.getTime() : 0,
  };
}

/** Totais do mês, em centavos (evita erros de arredondamento). */
function calcularTotais_(itens) {
  var t = { dizimos: 0, ofertas: 0, entradas: 0, saidas: 0, saldo: 0, quantidade: itens.length };
  itens.forEach(function (item) {
    if (item.tipo === TIPO_ENTRADA) {
      t.entradas += item.valorCentavos;
      if (item.categoria === 'Dízimo') t.dizimos += item.valorCentavos;
      else if (item.categoria === 'Oferta') t.ofertas += item.valorCentavos;
    } else {
      t.saidas += item.valorCentavos;
    }
  });
  t.saldo = t.entradas - t.saidas;
  return t;
}

// ------------------------------------------------------------
//  Acesso
// ------------------------------------------------------------

function emailUsuarioAtual_() {
  var email = '';
  try {
    email = Session.getActiveUser().getEmail() || '';
  } catch (e) {
    email = '';
  }
  return String(email).trim().toLowerCase();
}

function usuarioAutorizado_(email) {
  if (!email) return false;
  return (CONFIG.USUARIOS_AUTORIZADOS || []).some(function (autorizado) {
    return String(autorizado).trim().toLowerCase() === email;
  });
}

// ------------------------------------------------------------
//  Utilitários
// ------------------------------------------------------------

/**
 * Executa uma função pública com conferência de acesso e tratamento de erros.
 * Sempre devolve { ok: true, ... } ou { ok: false, erro: 'mensagem em português' }.
 */
function executar_(funcao) {
  try {
    var email = emailUsuarioAtual_();
    if (!usuarioAutorizado_(email)) {
      throw erroUsuario_(
        'O e-mail ' + (email || '(não identificado)') + ' não está autorizado a usar este app. ' +
        'Peça ao responsável para incluir o seu e-mail na lista de usuários.'
      );
    }
    return funcao(email);
  } catch (e) {
    if (e && e.paraUsuario) {
      return { ok: false, erro: e.message };
    }
    console.error(e && e.stack ? e.stack : e);
    return {
      ok: false,
      erro: 'Ocorreu um erro inesperado. Tente de novo em alguns instantes. ' +
        '(Detalhe técnico: ' + mensagemDe_(e) + ')',
    };
  }
}

/** Erro com mensagem que pode ser mostrada para a pessoa. */
function erroUsuario_(mensagem) {
  var erro = new Error(mensagem);
  erro.paraUsuario = true;
  return erro;
}

function pegarTrava_(trava) {
  if (!trava.tryLock(ESPERA_TRAVA_MS)) {
    throw erroUsuario_(
      'O sistema está ocupado gravando outro lançamento. Aguarde alguns segundos e tente de novo.'
    );
  }
}

function anosDisponiveis_() {
  return (CONFIG.ANOS || [])
    .map(Number)
    .filter(function (a) { return a >= 2000 && a <= 2100; })
    .sort(function (a, b) { return a - b; });
}

function listarAnos_(anos) {
  if (anos.length <= 1) return String(anos[0] || '');
  return anos.slice(0, -1).join(', ') + ' ou ' + anos[anos.length - 1];
}

function normalizarTipo_(valor) {
  var t = semAcentos_(String(valor || '')).trim().toLowerCase();
  if (t === 'entrada') return TIPO_ENTRADA;
  if (t === 'saida') return TIPO_SAIDA;
  return '';
}

function normalizarCategoriaEntrada_(valor) {
  var c = semAcentos_(String(valor || '')).trim().toLowerCase();
  for (var i = 0; i < CATEGORIAS_ENTRADA.length; i++) {
    if (semAcentos_(CATEGORIAS_ENTRADA[i]).toLowerCase() === c) return CATEGORIAS_ENTRADA[i];
  }
  return '';
}

/** Remove espaços extras e caracteres invisíveis. */
function limparTexto_(valor) {
  return String(valor === undefined || valor === null ? '' : valor)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function semAcentos_(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Lê um valor da planilha (número ou texto tipo "1.234,56"). */
function numeroDaPlanilha_(valor) {
  if (typeof valor === 'number') return isFinite(valor) ? valor : null;
  var texto = String(valor || '').replace(/R\$|\s/g, '');
  if (!texto) return null;
  if (texto.indexOf(',') >= 0) texto = texto.replace(/\./g, '').replace(',', '.');
  var n = Number(texto);
  return isFinite(n) ? n : null;
}

function formatarReais_(centavos) {
  var negativo = centavos < 0;
  var abs = Math.abs(Math.round(centavos));
  var inteiro = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  var resto = doisDigitos_(abs % 100);
  return (negativo ? '-' : '') + 'R$ ' + inteiro + ',' + resto;
}

function doisDigitos_(n) {
  return ('0' + n).slice(-2);
}

function mensagemDe_(e) {
  return e && e.message ? e.message : String(e);
}
