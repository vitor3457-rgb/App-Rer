import { hojeISO, mesDe, somarMeses } from '@/core/datas';

import { LancamentoEnvio } from './remoto';
import { RemotoMemoria, ServidorMemoria } from './remotoMemoria';
import { Autenticacao, Conta } from './sessao';

/**
 * MODO DEMONSTRAÇÃO: o app inteiro funcionando sem internet e sem servidor, com dados de exemplo.
 * É usado nos testes automáticos das telas (EXPO_PUBLIC_DEMO=1). Nada é gravado de verdade.
 */

export const CONTA_DEMO: Conta = { email: 'demo@adrer.app', nome: 'Demonstração', foto: null };

function uuid(n: number): string {
  return 'dddddddd-0000-4000-8000-' + String(n).padStart(12, '0');
}

export function criarDemo() {
  const servidor = new ServidorMemoria([
    { email: CONTA_DEMO.email, nome: CONTA_DEMO.nome, papel: 'admin', ativo: true },
    { email: 'tesoureiro@adrer.app', nome: 'Tesoureiro', papel: 'tesoureiro', ativo: true },
  ]);
  servidor.config.set('saldo_abertura_centavos', 150000);
  const remoto: RemotoMemoria = servidor.conectar(CONTA_DEMO.email);

  // ---- dados de exemplo: os 3 meses anteriores + o mês atual (até hoje) ----
  const hoje = hojeISO();
  const mesHoje = mesDe(hoje);
  const diaHoje = Number(hoje.slice(8, 10));
  let n = 0;
  const membros = ['Silvana', 'Maria das Graças', 'José Carlos', 'Ana Paula'].map((nome) => {
    const id = uuid(++n);
    servidor.membros.set(id, {
      id, nome, telefone: '', observacao: '', ativo: true,
      criadoEm: servidor.carimbo(), atualizadoEm: servidor.carimbo(), excluidoEm: null,
    });
    return { id, nome };
  });
  const responsaveis = ['Alex', 'Júlio', 'Lázaro'];

  function gravar(l: Omit<LancamentoEnvio, 'id' | 'criadoEm' | 'comprovante' | 'responsavel'>) {
    const id = uuid(++n);
    const carimbo = servidor.carimbo();
    servidor.lancamentos.set(id, {
      ...l, id, comprovante: null, responsavel: responsaveis[n % 3], usuarioEmail: CONTA_DEMO.email,
      criadoEm: carimbo, atualizadoEm: carimbo, excluidoEm: null, excluidoPor: null,
    });
  }

  for (let atras = 3; atras >= 0; atras--) {
    const mes = somarMeses(mesHoje, -atras);
    const ate = atras === 0 ? diaHoje : 28;
    const dia = (d: number) => mes + '-' + String(Math.min(Math.max(d, 1), ate)).padStart(2, '0');
    const fator = 1 + (3 - atras) * 0.08;
    const v = (centavos: number) => Math.round((centavos * fator) / 5) * 5;
    const dizimo = (d: number, m: number, centavos: number) =>
      gravar({ dataReferencia: dia(d), tipo: 'Entrada', categoria: 'Dízimo', descricao: membros[m].nome, membroId: membros[m].id, valorCentavos: v(centavos) });
    const oferta = (d: number, centavos: number) =>
      gravar({ dataReferencia: dia(d), tipo: 'Entrada', categoria: 'Oferta', descricao: '', membroId: null, valorCentavos: v(centavos) });
    const despesa = (d: number, descricao: string, centavos: number) =>
      gravar({ dataReferencia: dia(d), tipo: 'Saída', categoria: 'Despesa', descricao, membroId: null, valorCentavos: centavos });

    dizimo(1, 0, 15000);
    oferta(1, 8450);
    despesa(3, 'Aluguel', 80000);
    despesa(5, 'Conta de luz', 12735 + atras * 310);
    dizimo(8, 1, 30000);
    oferta(8, 6890);
    despesa(8, 'Material de limpeza e manutenção do banheiro', 9850);
    if (ate >= 12) {
      dizimo(12, 2, 22000);
      despesa(12, 'Água', 6420);
      despesa(13, 'Internet', 9990);
    }
    if (ate >= 15) {
      oferta(15, 11230);
      dizimo(15, 3, 18000);
    }
    if (ate >= 22) {
      dizimo(22, 0, 15000);
      oferta(22, 9570);
      despesa(24, 'Gás', 12000);
    }
  }

  // ---- login de mentira ----
  let conta: Conta | null = null;
  const ouvintes = new Set<(c: Conta | null) => void>();
  const autenticacao: Autenticacao = {
    async contaAtual() {
      return conta;
    },
    async entrarComGoogle() {
      conta = CONTA_DEMO;
      ouvintes.forEach((o) => o(conta));
      return true;
    },
    async sair() {
      conta = null;
      ouvintes.forEach((o) => o(conta));
    },
    aoMudar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
  };

  remoto.latencia = 120;
  return { servidor, remoto, autenticacao };
}
