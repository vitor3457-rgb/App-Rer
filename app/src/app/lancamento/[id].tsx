import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { dataHoraBR, dataPorExtenso } from '@/core/datas';
import { formatarReais } from '@/core/dinheiro';
import { banco, remoto } from '@/dados';
import { useBanco, usePodeEscrever } from '@/dados/hooks';
import { excluirComConfirmacao } from '@/ui/acoes';
import { avisar } from '@/ui/avisos';
import { Botao, Cartao, LinhaValor, Texto, Vazio } from '@/ui/base';
import { FormularioLancamento, ResultadoFormulario } from '@/ui/Formulario';
import { tituloDoLancamento } from '@/ui/ItemLancamento';
import { CabecalhoVoltar, Corpo } from '@/ui/Tela';
import { ESPACO, RAIO, useCores } from '@/ui/tema';

/** Detalhe de um lançamento: ver tudo, ver a foto, alterar ou excluir. */
export default function DetalheLancamento() {
  const c = useCores();
  const { id } = useLocalSearchParams<{ id: string }>();
  const l = useBanco((e) => (id ? e.lancamentos[id] : undefined));
  const podeEscrever = usePodeEscrever();
  const [editando, setEditando] = useState(false);
  const [foto, setFoto] = useState<{ uri: string | null; estado: 'nada' | 'carregando' | 'pronta' | 'erro'; erro?: string }>({ uri: null, estado: 'nada' });

  const caminho = l?.comprovante ?? null;
  const local = l?.comprovanteLocal ?? null;
  useEffect(() => {
    let vivo = true;
    if (local) {
      setFoto({ uri: local, estado: 'pronta' });
    } else if (caminho) {
      setFoto({ uri: null, estado: 'carregando' });
      remoto.urlComprovante(caminho)
        .then((uri) => { if (vivo) setFoto({ uri, estado: 'pronta' }); })
        .catch((e) => { if (vivo) setFoto({ uri: null, estado: 'erro', erro: e instanceof Error ? e.message : String(e) }); });
    } else {
      setFoto({ uri: null, estado: 'nada' });
    }
    return () => { vivo = false; };
  }, [caminho, local]);

  if (!l) {
    return (
      <View style={{ flex: 1 }}>
        <CabecalhoVoltar titulo="Lançamento" />
        <Corpo>
          <Vazio icone="trash-outline" titulo="Este lançamento não existe mais" texto="Ele pode ter sido excluído por outra pessoa." />
          <Botao titulo="Voltar" tipo="secundario" onPress={() => router.back()} />
        </Corpo>
      </View>
    );
  }

  async function salvar({ dados, comprovanteUri }: ResultadoFormulario): Promise<boolean> {
    await banco.editarLancamento(l!.id, dados, { comprovanteUri });
    avisar('Alteração salva.');
    setEditando(false);
    return true;
  }

  async function excluir() {
    if (await excluirComConfirmacao(l!)) router.back();
  }

  const entrada = l.tipo === 'Entrada';
  return (
    <View style={{ flex: 1 }} testID="tela-detalhe">
      <CabecalhoVoltar titulo={editando ? 'Alterar lançamento' : 'Lançamento'} />
      <Corpo>
        {editando ? (
          <>
            <FormularioLancamento inicial={l} aoSalvar={salvar} textoBotao="Salvar alteração" />
            <Botao testID="cancelar-edicao" titulo="Cancelar" tipo="secundario" onPress={() => setEditando(false)} />
          </>
        ) : (
          <>
            <Cartao style={{ alignItems: 'center', gap: 4 }}>
              <Texto suave>{entrada ? 'Entrada' : 'Saída'}</Texto>
              <Texto testID="detalhe-valor" tipo="titulo" cor={entrada ? c.entrada : c.saida} style={{ fontSize: 34, lineHeight: 40 }}>
                {entrada ? '+ ' : '- '}{formatarReais(l.valorCentavos)}
              </Texto>
              <Texto testID="detalhe-titulo" tipo="subtitulo" style={{ textAlign: 'center' }}>{tituloDoLancamento(l)}</Texto>
              {l.pendente ? <Texto tipo="pequeno" cor={c.aviso}>Ainda não enviado — será enviado quando houver internet.</Texto> : null}
            </Cartao>

            <Cartao>
              <LinhaValor rotulo="Data" valor={dataPorExtenso(l.dataReferencia)} />
              <LinhaValor rotulo="Categoria" valor={l.categoria} />
              <LinhaValor rotulo={entrada ? 'Quem contribuiu' : 'Descrição'} valor={l.descricao || '—'} />
              {l.formaPagamento ? <LinhaValor rotulo="Forma de pagamento" valor={l.formaPagamento} /> : null}
              <LinhaValor rotulo="Responsável" valor={l.responsavel} />
              <LinhaValor rotulo="Conta usada" valor={l.usuarioEmail || '—'} />
              <LinhaValor rotulo="Lançado em" valor={dataHoraBR(l.criadoEm)} />
            </Cartao>

            {l.observacao ? (
              <Cartao style={{ gap: 4 }} testID="detalhe-observacao">
                <Texto tipo="rotulo" suave>OBSERVAÇÃO</Texto>
                <Texto>{l.observacao}</Texto>
              </Cartao>
            ) : null}

            {foto.estado !== 'nada' ? (
              <Cartao style={{ gap: ESPACO.m }}>
                <Texto tipo="subtitulo">Comprovante</Texto>
                {foto.estado === 'carregando' ? <ActivityIndicator color={c.laranja} /> : null}
                {foto.estado === 'erro' ? <Texto suave>{foto.erro}</Texto> : null}
                {foto.uri ? (
                  <Image testID="detalhe-foto" source={{ uri: foto.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: RAIO.p, backgroundColor: c.cartaoSuave }} contentFit="contain" />
                ) : null}
              </Cartao>
            ) : null}

            {podeEscrever ? (
              <View style={{ flexDirection: 'row', gap: ESPACO.m }}>
                <Botao testID="detalhe-alterar" titulo="Alterar" tipo="secundario" icone="create-outline" style={{ flex: 1 }} onPress={() => setEditando(true)} />
                <Botao testID="detalhe-excluir" titulo="Excluir" tipo="perigo" icone="trash-outline" style={{ flex: 1 }} onPress={() => void excluir()} />
              </View>
            ) : null}
          </>
        )}
      </Corpo>
    </View>
  );
}
