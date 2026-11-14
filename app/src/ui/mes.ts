import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { mesAtual, somarMeses } from '@/core/datas';

/** Mês escolhido — o mesmo para as telas "Lançamentos" e "Dashboard". */
export const MES_MINIMO = '2020-01';

export function mesMaximo(): string {
  return somarMeses(mesAtual(), 2);
}

const loja = createStore<{ mes: string }>(() => ({ mes: mesAtual() }));

export function useMes(): string {
  return useStore(loja, (e) => e.mes);
}

export function definirMes(mes: string): void {
  if (mes < MES_MINIMO || mes > mesMaximo()) return;
  loja.setState({ mes });
}
