import { Lancamento, Membro } from '../tipos';

let contador = 0;

/** Cria um lançamento de teste (Entrada · Dízimo de R$ 50,00 por padrão). */
export function lanc(extra: Partial<Lancamento> = {}): Lancamento {
  contador++;
  const n = String(contador).padStart(12, '0');
  return {
    id: '00000000-0000-4000-8000-' + n,
    dataReferencia: '2026-11-08',
    tipo: 'Entrada',
    categoria: 'Dízimo',
    descricao: 'Silvana',
    membroId: null,
    valorCentavos: 5000,
    responsavel: 'Alex',
    comprovante: null,
    usuarioEmail: 'dono@gmail.com',
    criadoEm: '2026-11-08T12:00:' + String(contador % 60).padStart(2, '0') + '.000Z',
    atualizadoEm: '2026-11-08T12:00:00.000Z',
    excluidoEm: null,
    excluidoPor: null,
    ...extra,
  };
}

export function saida(descricao: string, valorCentavos: number, extra: Partial<Lancamento> = {}): Lancamento {
  return lanc({ tipo: 'Saída', categoria: 'Despesa', descricao, valorCentavos, ...extra });
}

export function membro(nome: string, extra: Partial<Membro> = {}): Membro {
  contador++;
  return {
    id: '11111111-0000-4000-8000-' + String(contador).padStart(12, '0'),
    nome, telefone: '', observacao: '', ativo: true,
    criadoEm: '2026-11-01T00:00:00.000Z', atualizadoEm: '2026-11-01T00:00:00.000Z', excluidoEm: null,
    ...extra,
  };
}
