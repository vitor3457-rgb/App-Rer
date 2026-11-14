/** Tipos de dados do app (iguais no celular e no banco, só mudando o estilo dos nomes). */

export type Tipo = 'Entrada' | 'Saída';
export type Categoria = 'Dízimo' | 'Oferta' | 'Despesa';
export type Papel = 'admin' | 'tesoureiro' | 'leitor';

export const TIPOS: Tipo[] = ['Entrada', 'Saída'];
export const CATEGORIAS_ENTRADA: Categoria[] = ['Dízimo', 'Oferta'];
export const CATEGORIA_SAIDA: Categoria = 'Despesa';

export interface Lancamento {
  /** UUID gerado no celular: reenviar o mesmo lançamento não duplica. */
  id: string;
  /** Data escolhida no formulário, no formato AAAA-MM-DD. */
  dataReferencia: string;
  tipo: Tipo;
  categoria: Categoria;
  /** Saída: o que foi a despesa. Entrada: nome de quem contribuiu (pode ficar vazio na oferta). */
  descricao: string;
  membroId: string | null;
  valorCentavos: number;
  responsavel: string;
  /** Caminho da foto do comprovante no armazenamento (ou null). */
  comprovante: string | null;
  usuarioEmail: string;
  criadoEm: string;
  atualizadoEm: string;
  excluidoEm: string | null;
  excluidoPor: string | null;
  /** Só no celular: ainda não chegou ao servidor. */
  pendente?: boolean;
  /** Só no celular: foto ainda não enviada (endereço local do arquivo). */
  comprovanteLocal?: string | null;
}

export interface Membro {
  id: string;
  nome: string;
  telefone: string;
  observacao: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  excluidoEm: string | null;
  pendente?: boolean;
}

export interface Responsavel {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
  atualizadoEm: string;
}

export interface Usuario {
  email: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
  atualizadoEm: string;
}

export interface Configuracoes {
  /** Quanto havia em caixa antes do primeiro lançamento do app. */
  saldoAberturaCentavos: number;
  /** Responsável que já vem escolhido no formulário. */
  responsavelPadrao: string;
}

export const CONFIG_PADRAO: Configuracoes = { saldoAberturaCentavos: 0, responsavelPadrao: '' };

export function podeEscrever(papel: Papel | null | undefined): boolean {
  return papel === 'admin' || papel === 'tesoureiro';
}
