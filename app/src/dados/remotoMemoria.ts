import { normalizar } from '@/core/texto';
import { Lancamento, Membro, Responsavel, Usuario, podeEscrever } from '@/core/tipos';
import {
  ErroRemoto, LancamentoEnvio, LinhaConfig, MembroEnvio, Remoto, ResponsavelEnvio, TipoErro, UsuarioEnvio,
} from './remoto';

/**
 * Servidor de mentira, em memória, com as mesmas regras principais do banco de verdade
 * (lista de usuários, papéis, exclusão lógica, carimbo de data do servidor).
 * Usado no modo demonstração e nos testes — vários "celulares" podem se conectar ao mesmo servidor.
 */
export class ServidorMemoria {
  usuarios: Usuario[] = [];
  lancamentos = new Map<string, Lancamento>();
  membros = new Map<string, Membro>();
  responsaveis: Responsavel[] = [];
  config = new Map<string, unknown>([['saldo_abertura_centavos', 0], ['responsavel_padrao', 'Alex']]);
  comprovantes = new Map<string, string>();
  /** Relógio do servidor (avança 1 segundo a cada gravação, para a ordem ser previsível). */
  relogio = Date.parse('2026-11-08T12:00:00.000Z');
  /** Quantas vezes cada método foi chamado (para os testes). */
  chamadas: Record<string, number> = {};

  constructor(usuarios: UsuarioEnvio[] = [], responsaveis: string[] = ['Alex', 'Júlio', 'Lázaro']) {
    const agora = this.carimbo();
    this.usuarios = usuarios.map((u) => ({ ...u, atualizadoEm: agora }));
    this.responsaveis = responsaveis.map((nome, i) => ({
      id: 'resp-' + (i + 1), nome, ativo: true, ordem: i + 1, atualizadoEm: agora,
    }));
  }

  carimbo(): string {
    this.relogio += 1000;
    return new Date(this.relogio).toISOString();
  }

  /** Um "celular" logado com esse e-mail. */
  conectar(email: string): RemotoMemoria {
    return new RemotoMemoria(this, email.toLowerCase());
  }
}

export class RemotoMemoria implements Remoto {
  /** false = sem internet: toda chamada falha com erro de rede. */
  online = true;
  /** Atraso artificial de cada chamada (ms). */
  latencia = 0;
  /** Próximas falhas programadas: [método ou '*', tipo, depois de gravar?]. */
  private falhas: { metodo: string; tipo: TipoErro; depois: boolean; mensagem: string }[] = [];

  constructor(private servidor: ServidorMemoria, public email: string) {}

  /** Faz a próxima chamada de `metodo` falhar. `depois: true` simula "gravou, mas a resposta se perdeu". */
  falharProxima(metodo: string, tipo: TipoErro, opcoes: { depois?: boolean; mensagem?: string } = {}) {
    this.falhas.push({ metodo, tipo, depois: !!opcoes.depois, mensagem: opcoes.mensagem ?? 'Falha simulada (' + tipo + ')' });
  }

  private async chamar<T>(metodo: string, acao: () => T): Promise<T> {
    const s = this.servidor;
    s.chamadas[metodo] = (s.chamadas[metodo] ?? 0) + 1;
    if (this.latencia) await new Promise((r) => setTimeout(r, this.latencia));
    if (!this.online) throw new ErroRemoto('rede', 'Sem conexão com a internet.');
    const i = this.falhas.findIndex((f) => f.metodo === metodo || f.metodo === '*');
    const falha = i >= 0 ? this.falhas.splice(i, 1)[0] : null;
    if (falha && !falha.depois) throw new ErroRemoto(falha.tipo, falha.mensagem);
    const resultado = acao();
    if (falha) throw new ErroRemoto(falha.tipo, falha.mensagem);
    return resultado;
  }

  private eu(): Usuario | null {
    return this.servidor.usuarios.find((u) => u.ativo && u.email === this.email) ?? null;
  }
  private exigirLeitura() {
    if (!this.eu()) throw new ErroRemoto('permissao', 'Esta conta não está autorizada.');
  }
  private exigirEscrita() {
    if (!podeEscrever(this.eu()?.papel)) throw new ErroRemoto('permissao', 'Esta conta não pode gravar.');
  }
  private exigirAdmin() {
    if (this.eu()?.papel !== 'admin') throw new ErroRemoto('permissao', 'Só o administrador pode fazer isso.');
  }

  meuUsuario() {
    return this.chamar('meuUsuario', () => {
      const u = this.eu();
      return u ? { ...u } : null;
    });
  }

  lancamentosAlterados(desde: string | null) {
    return this.chamar('lancamentosAlterados', () => {
      if (!this.eu()) return [];
      return Array.from(this.servidor.lancamentos.values())
        .filter((l) => !desde || l.atualizadoEm > desde)
        .sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? -1 : 1))
        .map((l) => ({ ...l }));
    });
  }

  membrosAlterados(desde: string | null) {
    return this.chamar('membrosAlterados', () => {
      if (!this.eu()) return [];
      return Array.from(this.servidor.membros.values())
        .filter((m) => !desde || m.atualizadoEm > desde)
        .map((m) => ({ ...m }));
    });
  }

  responsaveis() {
    return this.chamar('responsaveis', () => (this.eu() ? this.servidor.responsaveis.map((r) => ({ ...r })) : []));
  }

  configuracoes() {
    return this.chamar('configuracoes', (): LinhaConfig[] =>
      this.eu() ? Array.from(this.servidor.config.entries()).map(([chave, valor]) => ({ chave, valor })) : []);
  }

  gravarLancamento(l: LancamentoEnvio) {
    return this.chamar('gravarLancamento', () => {
      this.exigirEscrita();
      if (!(l.valorCentavos > 0) || l.valorCentavos > 100_000_000) throw new ErroRemoto('validacao', 'Valor inválido.');
      if (l.categoria !== 'Oferta' && !l.descricao.trim()) throw new ErroRemoto('validacao', 'Descrição obrigatória.');
      if (l.membroId && !this.servidor.membros.has(l.membroId)) throw new ErroRemoto('validacao', 'Membro não encontrado.');
      const antigo = this.servidor.lancamentos.get(l.id);
      const agora = this.servidor.carimbo();
      this.servidor.lancamentos.set(l.id, {
        ...l,
        usuarioEmail: antigo?.usuarioEmail ?? this.email,
        criadoEm: antigo?.criadoEm ?? l.criadoEm,
        atualizadoEm: agora,
        excluidoEm: antigo?.excluidoEm ?? null,
        excluidoPor: antigo?.excluidoPor ?? null,
      });
    });
  }

  excluirLancamento(id: string) {
    return this.chamar('excluirLancamento', () => {
      this.exigirEscrita();
      const l = this.servidor.lancamentos.get(id);
      if (!l || l.excluidoEm) return;
      const agora = this.servidor.carimbo();
      this.servidor.lancamentos.set(id, { ...l, excluidoEm: agora, excluidoPor: this.email, atualizadoEm: agora });
    });
  }

  gravarMembro(m: MembroEnvio) {
    return this.chamar('gravarMembro', () => {
      this.exigirEscrita();
      if (!m.nome.trim()) throw new ErroRemoto('validacao', 'Nome obrigatório.');
      const antigo = this.servidor.membros.get(m.id);
      const agora = this.servidor.carimbo();
      this.servidor.membros.set(m.id, {
        ...m, criadoEm: antigo?.criadoEm ?? agora, atualizadoEm: agora, excluidoEm: antigo?.excluidoEm ?? null,
      });
      // Como no banco: renomear o membro atualiza os lançamentos ligados a ele.
      if (antigo && antigo.nome !== m.nome) {
        for (const l of this.servidor.lancamentos.values()) {
          if (l.membroId === m.id && l.descricao !== m.nome) {
            this.servidor.lancamentos.set(l.id, { ...l, descricao: m.nome, atualizadoEm: this.servidor.carimbo() });
          }
        }
      }
    });
  }

  excluirMembro(id: string) {
    return this.chamar('excluirMembro', () => {
      this.exigirEscrita();
      const m = this.servidor.membros.get(id);
      if (!m || m.excluidoEm) return;
      const agora = this.servidor.carimbo();
      this.servidor.membros.set(id, { ...m, excluidoEm: agora, atualizadoEm: agora });
    });
  }

  enviarComprovante(caminho: string, uriLocal: string) {
    return this.chamar('enviarComprovante', () => {
      this.exigirEscrita();
      this.servidor.comprovantes.set(caminho, uriLocal);
    });
  }

  urlComprovante(caminho: string) {
    return this.chamar('urlComprovante', () => {
      this.exigirLeitura();
      const uri = this.servidor.comprovantes.get(caminho);
      if (!uri) throw new ErroRemoto('outro', 'Foto não encontrada.');
      return uri;
    });
  }

  listarUsuarios() {
    return this.chamar('listarUsuarios', () => {
      const eu = this.eu();
      if (!eu) return [];
      return this.servidor.usuarios.filter((u) => eu.papel === 'admin' || u.email === eu.email).map((u) => ({ ...u }));
    });
  }

  gravarUsuario(u: UsuarioEnvio) {
    return this.chamar('gravarUsuario', () => {
      this.exigirAdmin();
      const email = u.email.toLowerCase();
      const lista = this.servidor.usuarios.filter((x) => x.email !== email);
      lista.push({ ...u, email, atualizadoEm: this.servidor.carimbo() });
      if (!lista.some((x) => x.papel === 'admin' && x.ativo)) {
        throw new ErroRemoto('validacao', 'É preciso manter pelo menos um administrador ativo.');
      }
      this.servidor.usuarios = lista;
    });
  }

  removerUsuario(email: string) {
    return this.chamar('removerUsuario', () => {
      this.exigirAdmin();
      const lista = this.servidor.usuarios.filter((x) => x.email !== email.toLowerCase());
      if (!lista.some((x) => x.papel === 'admin' && x.ativo)) {
        throw new ErroRemoto('validacao', 'É preciso manter pelo menos um administrador ativo.');
      }
      this.servidor.usuarios = lista;
    });
  }

  gravarResponsavel(r: ResponsavelEnvio) {
    return this.chamar('gravarResponsavel', () => {
      this.exigirAdmin();
      const s = this.servidor;
      const repetido = s.responsaveis.find((x) => normalizar(x.nome) === normalizar(r.nome) && x.id !== r.id);
      if (repetido) throw new ErroRemoto('validacao', 'Já existe um responsável com esse nome.');
      const agora = s.carimbo();
      const existente = r.id ? s.responsaveis.find((x) => x.id === r.id) : undefined;
      if (existente) Object.assign(existente, { nome: r.nome, ativo: r.ativo, ordem: r.ordem, atualizadoEm: agora });
      else s.responsaveis.push({ id: r.id ?? 'resp-' + (s.responsaveis.length + 1), nome: r.nome, ativo: r.ativo, ordem: r.ordem, atualizadoEm: agora });
    });
  }

  gravarConfiguracao(chave: string, valor: unknown) {
    return this.chamar('gravarConfiguracao', () => {
      this.exigirAdmin();
      this.servidor.config.set(chave, valor);
    });
  }
}
