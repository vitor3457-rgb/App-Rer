import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Switch, View } from 'react-native';

import { dataBR } from '@/core/datas';
import { formatarReais } from '@/core/dinheiro';
import { historicoDoMembro } from '@/core/totais';
import { banco } from '@/dados';
import { useBanco, usePodeEscrever } from '@/dados/hooks';
import { avisar, avisarErro, perguntar } from '@/ui/avisos';
import { Botao, CampoTexto, Cartao, LinhaValor, MensagemErro, Rotulo, Texto, Vazio } from '@/ui/base';
import { GrupoDeLancamentos, ItemLancamento } from '@/ui/ItemLancamento';
import { CabecalhoVoltar, Corpo } from '@/ui/Tela';
import { ESPACO, useCores } from '@/ui/tema';

/** Cadastro de um membro + histórico das contribuições dele. */
export default function DetalheMembro() {
  const c = useCores();
  const { id } = useLocalSearchParams<{ id: string }>();
  const m = useBanco((e) => (id ? e.membros[id] : undefined));
  const lancamentos = useBanco((e) => e.lancamentos);
  const podeEscrever = usePodeEscrever();
  const [nome, setNome] = useState(m?.nome ?? '');
  const [telefone, setTelefone] = useState(m?.telefone ?? '');
  const [observacao, setObservacao] = useState(m?.observacao ?? '');
  const [ativo, setAtivo] = useState(m?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);

  const h = useMemo(() => (m ? historicoDoMembro(Object.values(lancamentos), m) : null), [lancamentos, m]);

  if (!m || !h) {
    return (
      <View style={{ flex: 1 }}>
        <CabecalhoVoltar titulo="Cadastro" />
        <Corpo><Vazio icone="person-outline" titulo="Este cadastro não existe mais" /></Corpo>
      </View>
    );
  }

  const mudou = nome !== m.nome || telefone !== m.telefone || observacao !== m.observacao || ativo !== m.ativo;

  async function salvar() {
    setErro(null);
    try {
      await banco.salvarMembro({ id: m!.id, nome, telefone, observacao, ativo });
      avisar('Cadastro salvo.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  async function excluir() {
    const sim = await perguntar({
      titulo: 'Excluir este cadastro?',
      detalhes: [m!.nome],
      mensagem: 'Os lançamentos já feitos continuam como estão. O nome só deixa de aparecer nas sugestões e nesta lista.',
      confirmar: 'Sim, excluir',
      perigo: true,
    });
    if (!sim) return;
    try {
      await banco.excluirMembro(m!.id);
      avisar('Cadastro excluído.');
      router.back();
    } catch (e) {
      avisarErro(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <View style={{ flex: 1 }} testID="tela-membro">
      <CabecalhoVoltar titulo={m.nome} />
      <Corpo>
        <Cartao>
          <Texto tipo="rotulo" suave>CONTRIBUIÇÕES</Texto>
          <LinhaValor testID="membro-total" rotulo="Total" valor={formatarReais(h.totalCentavos)} cor={c.entrada} forte />
          <LinhaValor rotulo="Dízimos" valor={formatarReais(h.dizimosCentavos)} recuo />
          <LinhaValor rotulo="Ofertas" valor={formatarReais(h.ofertasCentavos)} recuo />
          <LinhaValor rotulo="Quantidade" valor={String(h.quantidade)} />
        </Cartao>

        <Cartao style={{ gap: ESPACO.g }}>
          <View>
            <Rotulo>Nome</Rotulo>
            <CampoTexto testID="membro-nome" value={nome} onChangeText={setNome} editable={podeEscrever} autoCapitalize="words" maxLength={120} accessibilityLabel="Nome" />
          </View>
          <View>
            <Rotulo extra="(opcional)">Telefone</Rotulo>
            <CampoTexto testID="membro-telefone" value={telefone} onChangeText={setTelefone} editable={podeEscrever} keyboardType="phone-pad" maxLength={40} placeholder="(00) 00000-0000" accessibilityLabel="Telefone" />
          </View>
          <View>
            <Rotulo extra="(opcional)">Observação</Rotulo>
            <CampoTexto testID="membro-observacao" value={observacao} onChangeText={setObservacao} editable={podeEscrever} maxLength={500} multiline placeholder="Anotações sobre este cadastro" accessibilityLabel="Observação" style={{ minHeight: 80, textAlignVertical: 'top' }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Texto tipo="rotulo">Ativo</Texto>
              <Texto tipo="pequeno" suave>Inativos não aparecem nas sugestões de nome.</Texto>
            </View>
            <Switch testID="membro-ativo" value={ativo} onValueChange={setAtivo} disabled={!podeEscrever} trackColor={{ true: c.laranja, false: c.borda }} />
          </View>
          <MensagemErro texto={erro} testID="erro-membro" />
          {podeEscrever ? <Botao testID="membro-salvar" titulo="Salvar cadastro" desativado={!mudou} onPress={() => void salvar()} /> : null}
        </Cartao>

        <View style={{ gap: ESPACO.p + 2 }}>
          <Texto tipo="subtitulo">Histórico</Texto>
          {h.itens.length ? (
            <GrupoDeLancamentos>
              {h.itens.map((l) => (
                <ItemLancamento key={l.id} l={l} emGrupo legenda={dataBR(l.dataReferencia) + (l.formaPagamento ? ' · ' + l.formaPagamento : '')} aoAbrir={() => router.push({ pathname: '/lancamento/[id]', params: { id: l.id } })} />
              ))}
            </GrupoDeLancamentos>
          ) : null}
          {!h.itens.length ? <Texto suave>Nenhuma contribuição registrada para este nome.</Texto> : null}
        </View>

        {podeEscrever ? <Botao testID="membro-excluir" titulo="Excluir cadastro" tipo="secundario" icone="trash-outline" onPress={() => void excluir()} /> : null}
      </Corpo>
    </View>
  );
}
