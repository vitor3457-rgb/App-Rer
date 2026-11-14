import { dataBR } from '@/core/datas';
import { formatarReais } from '@/core/dinheiro';
import { Lancamento } from '@/core/tipos';
import { banco } from '@/dados';

import { avisar, avisarErro, perguntar } from './avisos';
import { tituloDoLancamento } from './ItemLancamento';

/** Pergunta e exclui um lançamento. Devolve true se excluiu. */
export async function excluirComConfirmacao(l: Lancamento): Promise<boolean> {
  const sim = await perguntar({
    titulo: 'Excluir este lançamento?',
    detalhes: [
      l.tipo + ' · ' + tituloDoLancamento(l),
      'Valor: ' + formatarReais(l.valorCentavos),
      'Data: ' + dataBR(l.dataReferencia),
      'Responsável: ' + l.responsavel,
    ],
    mensagem: 'Ele sai da lista e dos totais. Fica registrado no banco quem excluiu e quando.',
    confirmar: 'Sim, excluir',
    perigo: true,
  });
  if (!sim) return false;
  try {
    await banco.excluirLancamento(l.id);
    avisar('Lançamento excluído.');
    return true;
  } catch (e) {
    avisarErro(e instanceof Error ? e.message : String(e));
    return false;
  }
}

/** Roda uma exportação mostrando erro amigável se falhar. */
export async function tentar(acao: () => Promise<void>, erroPadrao: string): Promise<void> {
  try {
    await acao();
  } catch (e) {
    avisarErro(e instanceof Error && e.message ? e.message : erroPadrao);
  }
}
