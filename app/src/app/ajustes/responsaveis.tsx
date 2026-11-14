import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { limparTexto } from '@/core/texto';
import { Responsavel } from '@/core/tipos';
import { banco, remoto } from '@/dados';
import { useBanco } from '@/dados/hooks';
import { avisar } from '@/ui/avisos';
import { Botao, CampoTexto, Cartao, MensagemErro, Rotulo, Texto } from '@/ui/base';
import { Janela } from '@/ui/Janela';
import { CabecalhoVoltar, Corpo } from '@/ui/Tela';
import { ESPACO, FONTE, useCores } from '@/ui/tema';
import { toque } from '@/ui/toque';

/** Responsáveis (só o administrador): nomes do campo "Responsável" e qual já vem escolhido. Precisa de internet. */
export default function Responsaveis() {
  const c = useCores();
  const lista = useBanco((e) => e.responsaveis);
  const padrao = useBanco((e) => e.config.responsavelPadrao);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Responsavel | null>(null);
  const [nome, setNome] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [ehPadrao, setEhPadrao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function abrir(r: Responsavel | null) {
    setEditando(r);
    setNome(r?.nome ?? '');
    setAtivo(r?.ativo ?? true);
    setEhPadrao(!!r && r.nome === padrao);
    setErro(null);
    setAberto(true);
  }

  async function salvar() {
    const limpo = limparTexto(nome);
    if (!limpo) {
      setErro('Escreva o nome.');
      return;
    }
    if (!ativo && lista.filter((r) => r.ativo && r.id !== editando?.id).length === 0) {
      setErro('É preciso ter pelo menos um responsável ativo.');
      return;
    }
    setOcupado(true);
    setErro(null);
    try {
      const ordem = editando?.ordem ?? Math.max(0, ...lista.map((r) => r.ordem)) + 1;
      await remoto.gravarResponsavel({ id: editando?.id, nome: limpo, ativo, ordem });
      if (ehPadrao && ativo) await remoto.gravarConfiguracao('responsavel_padrao', limpo);
      else if (editando && editando.nome === padrao && (!ativo || !ehPadrao)) await remoto.gravarConfiguracao('responsavel_padrao', '');
      await banco.sincronizar();
      avisar('Responsável salvo.');
      setAberto(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
    setOcupado(false);
  }

  return (
    <View style={{ flex: 1 }} testID="tela-responsaveis">
      <CabecalhoVoltar titulo="Responsáveis" />
      <Corpo>
        <Texto suave>São as pessoas que podem ser escolhidas como responsável por um lançamento. Quem for desativado some do formulário, mas continua nos lançamentos antigos.</Texto>
        <Botao testID="novo-responsavel" titulo="Incluir responsável" icone="add" onPress={() => abrir(null)} />
        <View style={{ gap: ESPACO.p + 2 }}>
          {lista.map((r) => (
            <Pressable key={r.id} testID="item-responsavel" accessibilityRole="button" accessibilityLabel={r.nome} onPress={() => { toque.leve(); abrir(r); }}>
              <Cartao style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: r.ativo ? 1 : 0.55 }}>
                <Text style={{ fontFamily: FONTE.forte, fontSize: 17, color: c.texto }}>{r.nome}</Text>
                <Text style={{ fontFamily: FONTE.forte, fontSize: 13, color: r.ativo ? c.laranjaEscuro : c.textoSuave }}>
                  {!r.ativo ? 'Desativado' : r.nome === padrao ? 'Padrão' : ''}
                </Text>
              </Cartao>
            </Pressable>
          ))}
        </View>
      </Corpo>

      <Janela visivel={aberto} titulo={editando ? 'Alterar responsável' : 'Incluir responsável'} aoFechar={() => setAberto(false)} testID="janela-responsavel">
        <View>
          <Rotulo>Nome</Rotulo>
          <CampoTexto testID="responsavel-nome" value={nome} onChangeText={setNome} placeholder="Ex.: Alex" autoCapitalize="words" maxLength={60} accessibilityLabel="Nome do responsável" />
        </View>
        <Botao testID="responsavel-padrao" titulo={ehPadrao ? 'Já vem escolhido no formulário ✓' : 'Deixar já escolhido no formulário'} tipo={ehPadrao ? 'suave' : 'secundario'} pequeno onPress={() => setEhPadrao(!ehPadrao)} />
        {editando ? (
          <Botao testID="responsavel-ativo" titulo={ativo ? 'Ativo (toque para desativar)' : 'Desativado (toque para ativar)'} tipo={ativo ? 'suave' : 'secundario'} pequeno onPress={() => setAtivo(!ativo)} />
        ) : null}
        <MensagemErro texto={erro} testID="erro-responsavel" />
        <Botao testID="responsavel-salvar" titulo="Salvar" carregando={ocupado} onPress={() => void salvar()} />
      </Janela>
    </View>
  );
}
