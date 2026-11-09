/**
 * Simulação (bem simplificada) dos serviços do Google Apps Script usados pelo app.
 * Serve para testar o código sem precisar do Google: funciona no Node (testes)
 * e no navegador (pré-visualização da interface).
 *
 * Uso: var gas = criarAmbienteGAS({ email: 'a@gmail.com' });
 *      gas.SpreadsheetApp, gas.LockService, gas.Session, gas.Utilities, ...
 */
(function (raiz) {
  'use strict';

  function criarAmbienteGAS(opcoes) {
    opcoes = opcoes || {};
    var estado = {
      email: opcoes.email || '',
      fusoScript: opcoes.fuso || 'America/Sao_Paulo',
      travaOcupada: false,
      travasPegas: 0,
      flushes: 0,
      falharAberturaPlanilha: false,
    };

    // ---------------- Planilha ----------------
    function Aba(nome, linhas, colunas) {
      this._nome = nome;
      this._dados = []; // matriz de valores (só as linhas/colunas usadas)
      this._formatos = {};
      this._maxLinhas = linhas || 1000;
      this._maxColunas = colunas || 26;
      this._linhasCongeladas = 0;
    }
    Aba.prototype.getName = function () { return this._nome; };
    Aba.prototype.setName = function (n) { this._nome = n; return this; };
    Aba.prototype.getMaxRows = function () { return this._maxLinhas; };
    Aba.prototype.getMaxColumns = function () { return this._maxColunas; };
    Aba.prototype.getLastRow = function () {
      for (var i = this._dados.length - 1; i >= 0; i--) {
        var linha = this._dados[i] || [];
        if (linha.some(function (v) { return v !== '' && v !== undefined && v !== null; })) return i + 1;
      }
      return 0;
    };
    Aba.prototype.getLastColumn = function () {
      var max = 0;
      this._dados.forEach(function (linha) {
        (linha || []).forEach(function (v, j) {
          if (v !== '' && v !== undefined && v !== null && j + 1 > max) max = j + 1;
        });
      });
      return max;
    };
    Aba.prototype.insertRowsAfter = function (depoisDe, quantidade) {
      if (depoisDe < 1 || depoisDe > this._maxLinhas) throw new Error('Linha fora da grade');
      var vazias = [];
      for (var i = 0; i < quantidade; i++) vazias.push([]);
      Array.prototype.splice.apply(this._dados, [depoisDe, 0].concat(vazias));
      this._maxLinhas += quantidade;
      return this;
    };
    Aba.prototype.deleteRow = function (linha) {
      if (linha < 1 || linha > this._maxLinhas) throw new Error('Linha fora da grade');
      this._dados.splice(linha - 1, 1);
      this._maxLinhas -= 1;
      return this;
    };
    Aba.prototype.setFrozenRows = function (n) { this._linhasCongeladas = n; return this; };
    Aba.prototype.getFrozenRows = function () { return this._linhasCongeladas; };
    Aba.prototype.autoResizeColumns = function () { return this; };
    Aba.prototype.appendRow = function (valores) {
      var l = this.getLastRow() + 1;
      if (l > this._maxLinhas) this._maxLinhas = l;
      this._dados[l - 1] = valores.slice();
      return this;
    };
    Aba.prototype.getRange = function (linha, coluna, numLinhas, numColunas) {
      numLinhas = numLinhas || 1;
      numColunas = numColunas || 1;
      if (linha < 1 || coluna < 1 || numLinhas < 1 || numColunas < 1) {
        throw new Error('As coordenadas do intervalo são inválidas.');
      }
      if (linha + numLinhas - 1 > this._maxLinhas || coluna + numColunas - 1 > this._maxColunas) {
        throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
      }
      return new Intervalo(this, linha, coluna, numLinhas, numColunas);
    };
    Aba.prototype.getDataRange = function () {
      return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn()));
    };
    /** Auxiliar dos testes: matriz com os valores usados. */
    Aba.prototype._valores = function () {
      var ul = this.getLastRow();
      var uc = this.getLastColumn();
      if (!ul || !uc) return [];
      return this.getRange(1, 1, ul, uc).getValues();
    };

    function Intervalo(aba, linha, coluna, numLinhas, numColunas) {
      this._aba = aba;
      this._l = linha;
      this._c = coluna;
      this._nl = numLinhas;
      this._nc = numColunas;
    }
    Intervalo.prototype._conferirTamanho = function (matriz) {
      if (!Array.isArray(matriz) || matriz.length !== this._nl ||
          matriz.some(function (l) { return !Array.isArray(l) || l.length !== this._nc; }, this)) {
        throw new Error('O número de linhas/colunas dos dados não corresponde ao intervalo.');
      }
    };
    Intervalo.prototype.getValues = function () {
      var r = [];
      for (var i = 0; i < this._nl; i++) {
        var linha = this._aba._dados[this._l - 1 + i] || [];
        var saida = [];
        for (var j = 0; j < this._nc; j++) {
          var v = linha[this._c - 1 + j];
          saida.push(v === undefined || v === null ? '' : (v instanceof Date ? new Date(v.getTime()) : v));
        }
        r.push(saida);
      }
      return r;
    };
    Intervalo.prototype.setValues = function (matriz) {
      this._conferirTamanho(matriz);
      for (var i = 0; i < this._nl; i++) {
        var idx = this._l - 1 + i;
        if (!this._aba._dados[idx]) this._aba._dados[idx] = [];
        for (var j = 0; j < this._nc; j++) {
          var v = matriz[i][j];
          var formato = this._aba._formatos[(idx + 1) + ',' + (this._c + j)];
          // Como no Google: texto vira número se a célula não for "texto puro".
          if (typeof v === 'string' && formato !== '@' && /^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
          if (typeof v === 'string' && formato !== '@' && v.charAt(0) === '=') {
            v = '#FORMULA:' + v; // marca para os testes detectarem fórmula indevida
          }
          this._aba._dados[idx][this._c - 1 + j] = v instanceof Date ? new Date(v.getTime()) : v;
        }
      }
      return this;
    };
    Intervalo.prototype.setValue = function (v) { return this.setValues([[v]]); };
    Intervalo.prototype.getValue = function () { return this.getValues()[0][0]; };
    Intervalo.prototype.setNumberFormats = function (matriz) {
      this._conferirTamanho(matriz);
      for (var i = 0; i < this._nl; i++) {
        for (var j = 0; j < this._nc; j++) {
          this._aba._formatos[(this._l + i) + ',' + (this._c + j)] = matriz[i][j];
        }
      }
      return this;
    };
    Intervalo.prototype.setNumberFormat = function (f) {
      for (var i = 0; i < this._nl; i++) {
        for (var j = 0; j < this._nc; j++) this._aba._formatos[(this._l + i) + ',' + (this._c + j)] = f;
      }
      return this;
    };
    Intervalo.prototype.getNumberFormat = function () {
      return this._aba._formatos[this._l + ',' + this._c] || 'General';
    };
    Intervalo.prototype.setFontWeight = function () { return this; };
    Intervalo.prototype.setBackground = function () { return this; };

    function Planilha(id) {
      this._id = id;
      this._abas = [new Aba('Página1')];
      this._fuso = opcoes.fusoPlanilha || 'America/New_York';
      this._idioma = 'en_US';
    }
    Planilha.prototype.getId = function () { return this._id; };
    Planilha.prototype.getSheets = function () { return this._abas.slice(); };
    Planilha.prototype.getSheetByName = function (nome) {
      for (var i = 0; i < this._abas.length; i++) if (this._abas[i].getName() === nome) return this._abas[i];
      return null;
    };
    Planilha.prototype.insertSheet = function (nome) {
      if (this.getSheetByName(nome)) {
        throw new Error('Já existe uma página com o nome "' + nome + '".');
      }
      var aba = new Aba(nome);
      this._abas.push(aba);
      return aba;
    };
    Planilha.prototype.getSpreadsheetTimeZone = function () { return this._fuso; };
    Planilha.prototype.setSpreadsheetTimeZone = function (f) { this._fuso = f; };
    Planilha.prototype.getSpreadsheetLocale = function () { return this._idioma; };
    Planilha.prototype.setSpreadsheetLocale = function (l) { this._idioma = l; };

    var planilha = new Planilha('PLANILHA_TESTE');

    var SpreadsheetApp = {
      getActiveSpreadsheet: function () { return planilha; },
      getActive: function () { return planilha; },
      openById: function (id) {
        if (estado.falharAberturaPlanilha) {
          throw new Error('You do not have permission to access the requested document.');
        }
        if (id !== planilha.getId()) throw new Error('Documento não encontrado: ' + id);
        return planilha;
      },
      flush: function () { estado.flushes++; },
    };

    // ---------------- Trava ----------------
    var LockService = {
      getScriptLock: function () {
        var temTrava = false;
        return {
          tryLock: function () {
            if (estado.travaOcupada) return false;
            estado.travaOcupada = true;
            estado.travasPegas++;
            temTrava = true;
            return true;
          },
          waitLock: function () {
            if (!this.tryLock()) throw new Error('Lock timeout');
          },
          releaseLock: function () {
            if (temTrava) { estado.travaOcupada = false; temTrava = false; }
          },
          hasLock: function () { return temTrava; },
        };
      },
    };

    // ---------------- Sessão ----------------
    var Session = {
      getActiveUser: function () { return { getEmail: function () { return estado.email; } }; },
      getEffectiveUser: function () { return { getEmail: function () { return 'dono@gmail.com'; } }; },
      getScriptTimeZone: function () { return estado.fusoScript; },
    };

    // ---------------- Utilitários ----------------
    function partesNoFuso(data, fuso) {
      var f = new Intl.DateTimeFormat('en-US', {
        timeZone: fuso, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      var p = {};
      f.formatToParts(data).forEach(function (x) { p[x.type] = x.value; });
      return p;
    }

    var Utilities = {
      getUuid: function () {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
      },
      formatDate: function (data, fuso, formato) {
        var p = partesNoFuso(data, fuso);
        return formato
          .replace(/yyyy/g, p.year)
          .replace(/MM/g, p.month)
          .replace(/dd/g, p.day)
          .replace(/HH/g, p.hour)
          .replace(/mm/g, p.minute)
          .replace(/ss/g, p.second);
      },
      parseDate: function (texto, fuso, formato) {
        if (formato !== 'yyyy-MM-dd') throw new Error('Formato não suportado na simulação: ' + formato);
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
        if (!m) throw new Error('Unparseable date: "' + texto + '"');
        // Como o Java (leniente): 2026-02-30 vira 02/03/2026.
        var palpite = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0);
        var p = partesNoFuso(new Date(palpite), fuso);
        var comoUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day),
          Number(p.hour), Number(p.minute), Number(p.second));
        var deslocamento = comoUtc - palpite;
        return new Date(palpite - deslocamento);
      },
    };

    // ---------------- HtmlService (mínimo) ----------------
    var HtmlService = {
      createTemplateFromFile: function (nome) {
        var t = { _arquivo: nome };
        t.evaluate = function () { return criarSaidaHtml(nome, t); };
        return t;
      },
      createHtmlOutputFromFile: function (nome) { return criarSaidaHtml(nome, {}); },
    };
    function criarSaidaHtml(nome, template) {
      var s = { arquivo: nome, template: template, metas: {}, titulo: '', favicon: '' };
      s.setTitle = function (t) { s.titulo = t; return s; };
      s.addMetaTag = function (n, c) {
        if ((opcoes.metasPermitidas || ['viewport', 'mobile-web-app-capable', 'apple-mobile-web-app-capable']).indexOf(n) < 0) {
          throw new Error('A metatag especificada não é permitida neste contexto.');
        }
        s.metas[n] = c;
        return s;
      };
      s.setFaviconUrl = function (u) { s.favicon = u; return s; };
      s.getContent = function () { return opcoes.lerArquivo ? opcoes.lerArquivo(nome) : ''; };
      return s;
    }

    var registros = [];
    var consoleGAS = {
      log: function () { registros.push(['log'].concat([].slice.call(arguments))); },
      warn: function () { registros.push(['warn'].concat([].slice.call(arguments))); },
      error: function () { registros.push(['error'].concat([].slice.call(arguments))); },
    };

    return {
      SpreadsheetApp: SpreadsheetApp,
      LockService: LockService,
      Session: Session,
      Utilities: Utilities,
      HtmlService: HtmlService,
      console: consoleGAS,
      // controles para os testes
      _estado: estado,
      _planilha: planilha,
      _registros: registros,
      _definirEmail: function (e) { estado.email = e; },
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { criarAmbienteGAS: criarAmbienteGAS };
  } else {
    raiz.criarAmbienteGAS = criarAmbienteGAS;
  }
})(typeof window !== 'undefined' ? window : this);
