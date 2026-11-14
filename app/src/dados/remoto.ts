import { Categoria, Lancamento, Membro, Papel, Responsavel, Tipo, Usuario } from '@/core/tipos';

/**
 * "Remoto" é o servidor visto pelo app. Há duas implementações:
 *  - remotoSupabase.ts: o banco de verdade (Supabase);
 *  - remotoMemoria.ts: um servidor de mentira, em memória (modo demonstração e testes).
 */

export type TipoErro =
  | 'rede'       // sem internet ou servidor fora do ar: tentar de novo depois
  | 'sessao'     // login expirou: precisa entrar de novo
  | 'permissao'  // a conta não pode fazer isso
  | 'validacao'  // o servidor recusou os dados
  | 'outro';

export class ErroRemoto extends Error {
  tipo: TipoErro;
  constructor(tipo: TipoErro, mensagem: string) {
    super(mensagem);
    this.name = 'ErroRemoto';
    this.tipo = tipo;
  }
}

/** O que o celular manda de um lançamento (conta e carimbos de data são do servidor). */
export interface LancamentoEnvio {
  id: string;
  dataReferencia: string;
  tipo: Tipo;
  categoria: Categoria;
  descricao: string;
  membroId: string | null;
  valorCentavos: number;
  responsavel: string;
  comprovante: string | null;
  criadoEm: string;
}

export interface MembroEnvio {
  id: string;
  nome: string;
  telefone: string;
  observacao: string;
  ativo: boolean;
}

export interface LinhaConfig {
  chave: string;
  valor: unknown;
}

export interface UsuarioEnvio {
  email: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
}

export interface ResponsavelEnvio {
  id?: string;
  nome: string;
  ativo: boolean;
  ordem: number;
}

export interface Remoto {
  /** Linha da lista de usuários para a conta logada (null = não autorizada). */
  meuUsuario(): Promise<Usuario | null>;

  /** Linhas alteradas depois de `desde` (ISO), inclusive as excluídas. null = todas. */
  lancamentosAlterados(desde: string | null): Promise<Lancamento[]>;
  membrosAlterados(desde: string | null): Promise<Membro[]>;
  responsaveis(): Promise<Responsavel[]>;
  configuracoes(): Promise<LinhaConfig[]>;

  /** Gravações que entram na fila offline (todas podem ser repetidas sem duplicar). */
  gravarLancamento(l: LancamentoEnvio): Promise<void>;
  excluirLancamento(id: string): Promise<void>;
  gravarMembro(m: MembroEnvio): Promise<void>;
  excluirMembro(id: string): Promise<void>;
  enviarComprovante(caminho: string, uriLocal: string): Promise<void>;
  /** Endereço temporário para ver a foto. */
  urlComprovante(caminho: string): Promise<string>;

  /** Administração (só com internet). */
  listarUsuarios(): Promise<Usuario[]>;
  gravarUsuario(u: UsuarioEnvio): Promise<void>;
  removerUsuario(email: string): Promise<void>;
  gravarResponsavel(r: ResponsavelEnvio): Promise<void>;
  gravarConfiguracao(chave: string, valor: unknown): Promise<void>;
}
