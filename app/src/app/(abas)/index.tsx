import React from 'react';
import { View } from 'react-native';

import { dataBR } from '@/core/datas';
import { formatarReais } from '@/core/dinheiro';
import { banco } from '@/dados';
import { usePodeEscrever } from '@/dados/hooks';
import { avisar } from '@/ui/avisos';
import { Cartao, Texto, Vazio } from '@/ui/base';
import { FormularioLancamento, ResultadoFormulario } from '@/ui/Formulario';
import { Cabecalho, Corpo } from '@/ui/Tela';

/** Tela 1 — Novo lançamento */
export default function NovoLancamento() {
  const podeEscrever = usePodeEscrever();

  async function salvar({ dados, comprovanteUri }: ResultadoFormulario): Promise<boolean> {
    const l = await banco.adicionarLancamento(dados, { comprovanteUri: comprovanteUri ?? null });
    const oQue = l.tipo === 'Entrada' ? l.categoria + (l.descricao ? ' de ' + l.descricao : '') : l.descricao;
    const offline = !banco.loja.getState().sinc.online;
    avisar(
      'Lançamento salvo!',
      `${l.tipo} · ${oQue} · ${formatarReais(l.valorCentavos)} · ${dataBR(l.dataReferencia)} · ${l.responsavel}` +
        (offline ? '\nSem internet agora: será enviado quando a conexão voltar.' : ''),
    );
    return true;
  }

  return (
    <View style={{ flex: 1 }} testID="tela-novo">
      <Cabecalho />
      <Corpo>
        <Texto tipo="titulo">Novo lançamento</Texto>
        {podeEscrever ? (
          <FormularioLancamento aoSalvar={salvar} />
        ) : (
          <Cartao>
            <Vazio icone="eye-outline" titulo="Sua conta é só de consulta" texto="Você pode ver os lançamentos e o dashboard, mas não lançar. Fale com o administrador se precisar lançar." />
          </Cartao>
        )}
      </Corpo>
    </View>
  );
}
