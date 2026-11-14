import { useMemo } from 'react';
import { useStore } from 'zustand';

import { agruparPorMes, calcularCaixa } from '@/core/totais';
import { Lancamento, podeEscrever } from '@/core/tipos';

import { Estado } from './banco';
import { EstadoSessao, banco, sessao } from './index';

/** Lê uma parte do banco local e redesenha a tela quando ela muda. */
export function useBanco<T>(seletor: (e: Estado) => T): T {
  return useStore(banco.loja, seletor);
}

export function useSessao<T>(seletor: (e: EstadoSessao) => T): T {
  return useStore(sessao, seletor);
}

/** Lançamentos agrupados por mês + o caixa acumulado (saldo anterior → saldo em caixa). */
export function useCaixa() {
  const mapa = useBanco((e) => e.lancamentos);
  const abertura = useBanco((e) => e.config.saldoAberturaCentavos);
  return useMemo(() => {
    const porMes = agruparPorMes(Object.values(mapa));
    return { porMes, ...calcularCaixa(porMes, abertura) };
  }, [mapa, abertura]);
}

const VAZIO: Lancamento[] = [];

export function useLancamentosDoMes(mes: string): Lancamento[] {
  const { porMes } = useCaixa();
  return porMes.get(mes) ?? VAZIO;
}

export function usePodeEscrever(): boolean {
  return useBanco((e) => podeEscrever(e.usuario?.papel));
}

export function useEhAdmin(): boolean {
  return useBanco((e) => e.usuario?.papel === 'admin');
}

/** Nomes dos responsáveis ativos, na ordem. */
export function useResponsaveisAtivos(): string[] {
  const lista = useBanco((e) => e.responsaveis);
  return useMemo(() => lista.filter((r) => r.ativo).map((r) => r.nome), [lista]);
}
