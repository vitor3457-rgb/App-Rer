import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { SUGESTOES_DESPESA } from '@/config';
import { hojeISO, somarDias } from '@/core/datas';
import { digitosParaCentavos, formatarReais } from '@/core/dinheiro';
import { semRepetir, sugerir } from '@/core/texto';
import { Lancamento } from '@/core/tipos';
import { maisUsados } from '@/core/totais';
import { Campo, DATA_MINIMA, DIAS_NO_FUTURO, DadosValidados, Formulario, validarLancamento } from '@/core/validacao';
import { useBanco, useResponsaveisAtivos } from '@/dados/hooks';

import { avisarErro } from './avisos';
import { Botao, BotaoOpcao, CampoTexto, Cartao, MensagemErro, Rotulo, Sugestoes } from './base';
import { CampoData } from './CampoData';
import { escolherFoto } from './foto';
import { ESPACO, FONTE, RAIO, useCores } from './tema';
import { toque } from './toque';

const CHAVE_RESPONSAVEL = 'adrer:responsavel';

export interface ResultadoFormulario {
  dados: DadosValidados;
  /** undefined = não mexeu na foto; texto = foto nova; null = tirou a foto. */
  comprovanteUri: string | null | undefined;
}

/**
 * Formulário de lançamento (usado para criar e para alterar).
 * `inicial`: lançamento que está sendo alterado. `aoSalvar` devolve true se deu certo (aí o formulário é limpo).
 */
export function FormularioLancamento({
  inicial, aoSalvar, textoBotao = 'Salvar',
}: {
  inicial?: Lancamento;
  aoSalvar: (r: ResultadoFormulario) => Promise<boolean>;
  textoBotao?: string;
}) {
  const c = useCores();
  const responsaveis = useResponsaveisAtivos();
  const responsavelPadrao = useBanco((e) => e.config.responsavelPadrao);
  const lancamentos = useBanco((e) => e.lancamentos);
  const membros = useBanco((e) => e.membros);

  const [responsavel, setResponsavel] = useState(inicial?.responsavel ?? '');
  const [centavos, setCentavos] = useState(inicial?.valorCentavos ?? 0);
  const [tipo, setTipo] = useState<Formulario['tipo']>(inicial?.tipo ?? '');
  const [categoria, setCategoria] = useState<Formulario['categoria']>(inicial && inicial.tipo === 'Entrada' ? inicial.categoria : '');
  const [descricao, setDescricao] = useState(inicial?.tipo === 'Saída' ? inicial.descricao : '');
  const [contribuinte, setContribuinte] = useState(inicial?.tipo === 'Entrada' ? inicial.descricao : '');
  const [data, setData] = useState(inicial?.dataReferencia ?? hojeISO());
  const [foto, setFoto] = useState<string | null | undefined>(undefined);
  const [erro, setErro] = useState<{ texto: string; campo: Campo } | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Responsável: o último usado neste celular; senão o padrão da igreja; senão o primeiro da lista.
  useEffect(() => {
    if (responsavel || !responsaveis.length) return;
    let vivo = true;
    AsyncStorage.getItem(CHAVE_RESPONSAVEL).catch(() => null).then((salvo) => {
      if (!vivo) return;
      const escolha = [salvo, responsavelPadrao, responsaveis[0]].find((n) => n && responsaveis.includes(n));
      if (escolha) setResponsavel(escolha);
    });
    return () => { vivo = false; };
  }, [responsaveis, responsavelPadrao, responsavel]);

  const { despesas, nomes } = useMemo(() => {
    const todos = Object.values(lancamentos);
    return {
      despesas: semRepetir(SUGESTOES_DESPESA, maisUsados(todos.filter((l) => l.tipo === 'Saída').map((l) => l.descricao))),
      nomes: semRepetir(
        maisUsados(todos.filter((l) => l.tipo === 'Entrada').map((l) => l.descricao)),
        Object.values(membros).filter((m) => m.ativo).map((m) => m.nome).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      ),
    };
  }, [lancamentos, membros]);

  const hoje = hojeISO();
  const fotoAtual = foto !== undefined ? foto : inicial?.comprovanteLocal ?? null;
  const temFotoNoServidor = foto === undefined && !!inicial?.comprovante && !inicial?.comprovanteLocal;

  function limparErro(campo?: Campo) {
    if (erro && (!campo || erro.campo === campo)) setErro(null);
  }

  function escolherTipo(novo: 'Entrada' | 'Saída') {
    setTipo(novo);
    if (novo === 'Saída') setCategoria('');
    limparErro();
  }

  async function adicionarFoto(origem: 'camera' | 'galeria') {
    try {
      const uri = await escolherFoto(origem);
      if (uri) setFoto(uri);
    } catch (e) {
      avisarErro(e instanceof Error ? e.message : 'Não foi possível abrir a câmera.');
    }
  }

  async function salvar() {
    if (salvando) return;
    const r = validarLancamento(
      { responsavel, valorCentavos: centavos, tipo, categoria, descricao, contribuinte, dataReferencia: data },
      { responsaveis, hoje },
    );
    if (!r.ok) {
      toque.erro();
      setErro({ texto: r.erro, campo: r.campo });
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      const ok = await aoSalvar({ dados: r.dados, comprovanteUri: foto });
      if (ok) {
        AsyncStorage.setItem(CHAVE_RESPONSAVEL, r.dados.responsavel).catch(() => {});
        if (!inicial) {
          setCentavos(0);
          setTipo('');
          setCategoria('');
          setDescricao('');
          setContribuinte('');
          setData(hojeISO());
          setFoto(undefined);
        }
      }
    } catch (e) {
      toque.erro();
      setErro({ texto: e instanceof Error ? e.message : String(e), campo: 'valor' });
    } finally {
      setSalvando(false);
    }
  }

  const com = (campo: Campo) => erro?.campo === campo;

  return (
    <Cartao style={{ gap: ESPACO.g + 2 }}>
      {/* ---------- Responsável ---------- */}
      <View>
        <Rotulo>Responsável</Rotulo>
        <View testID="responsaveis" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.p }}>
          {responsaveis.map((nome) => {
            const escolhido = nome === responsavel;
            return (
              <Pressable
                key={nome}
                testID={'responsavel-' + nome}
                accessibilityRole="button"
                accessibilityLabel={'Responsável: ' + nome}
                accessibilityState={{ selected: escolhido }}
                onPress={() => { toque.leve(); setResponsavel(nome); limparErro('responsavel'); }}
                style={{
                  minHeight: 48, paddingHorizontal: ESPACO.g, borderRadius: 24, borderWidth: 2, flexDirection: 'row', alignItems: 'center', gap: 6,
                  borderColor: escolhido ? c.rocha : com('responsavel') ? c.saida : c.borda, backgroundColor: escolhido ? c.rocha : c.cartao,
                }}>
                {escolhido ? <Ionicons name="checkmark" size={18} color={c.cartao} /> : null}
                <Text style={{ fontFamily: FONTE.forte, fontSize: 16, color: escolhido ? c.cartao : c.texto }}>{nome}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ---------- Valor ---------- */}
      <View>
        <Rotulo>Valor</Rotulo>
        <CampoTexto
          testID="valor"
          grande
          erro={com('valor')}
          value={centavos ? formatarReais(centavos) : ''}
          onChangeText={(t) => { setCentavos(digitosParaCentavos(t)); limparErro('valor'); }}
          placeholder="R$ 0,00"
          keyboardType="number-pad"
          inputMode="numeric"
          returnKeyType="done"
          selection={Platform.OS === 'web' ? undefined : { start: 99, end: 99 }}
          accessibilityLabel="Valor"
        />
      </View>

      {/* ---------- Tipo ---------- */}
      <View>
        <Rotulo>Tipo</Rotulo>
        <View style={{ flexDirection: 'row', gap: ESPACO.m }}>
          <BotaoOpcao testID="tipo-entrada" titulo="Entrada" icone="arrow-up" cor={c.entrada} selecionado={tipo === 'Entrada'} erro={com('tipo')} onPress={() => escolherTipo('Entrada')} />
          <BotaoOpcao testID="tipo-saida" titulo="Saída" icone="arrow-down" cor={c.saida} selecionado={tipo === 'Saída'} erro={com('tipo')} onPress={() => escolherTipo('Saída')} />
        </View>
      </View>

      {/* ---------- Entrada: Dízimo/Oferta + quem contribuiu ---------- */}
      {tipo === 'Entrada' ? (
        <>
          <View>
            <Rotulo>A entrada é</Rotulo>
            <View style={{ flexDirection: 'row', gap: ESPACO.m }}>
              <BotaoOpcao testID="categoria-dizimo" titulo="Dízimo" cor={c.rocha} selecionado={categoria === 'Dízimo'} erro={com('categoria')} onPress={() => { setCategoria('Dízimo'); limparErro(); }} />
              <BotaoOpcao testID="categoria-oferta" titulo="Oferta" cor={c.rocha} selecionado={categoria === 'Oferta'} erro={com('categoria')} onPress={() => { setCategoria('Oferta'); limparErro(); }} />
            </View>
          </View>
          <View>
            <Rotulo extra={categoria === 'Oferta' ? '(opcional na oferta)' : undefined}>Nome de quem contribuiu</Rotulo>
            <CampoTexto
              testID="contribuinte"
              erro={com('contribuinte')}
              value={contribuinte}
              onChangeText={(t) => { setContribuinte(t); limparErro('contribuinte'); }}
              placeholder="Ex.: Silvana"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={200}
              returnKeyType="done"
              accessibilityLabel="Nome de quem contribuiu"
            />
            <Sugestoes testID="sugestoes-contribuinte" itens={sugerir(nomes, contribuinte, 10)} onEscolher={(t) => { setContribuinte(t); limparErro('contribuinte'); }} />
          </View>
        </>
      ) : null}

      {/* ---------- Saída: descrição ---------- */}
      {tipo === 'Saída' ? (
        <View>
          <Rotulo>Descrição da despesa</Rotulo>
          <CampoTexto
            testID="descricao"
            erro={com('descricao')}
            value={descricao}
            onChangeText={(t) => { setDescricao(t); limparErro('descricao'); }}
            placeholder="Ex.: aluguel, água, luz"
            autoCapitalize="sentences"
            maxLength={200}
            returnKeyType="done"
            accessibilityLabel="Descrição da despesa"
          />
          <Sugestoes testID="sugestoes-descricao" itens={sugerir(despesas, descricao, 10)} onEscolher={(t) => { setDescricao(t); limparErro('descricao'); }} />
        </View>
      ) : null}

      {/* ---------- Data ---------- */}
      <View>
        <Rotulo>Data</Rotulo>
        <CampoData valor={data} onMudar={(d) => { setData(d); limparErro('data'); }} minimo={DATA_MINIMA} maximo={somarDias(hoje, DIAS_NO_FUTURO)} erro={com('data')} />
      </View>

      {/* ---------- Foto do comprovante ---------- */}
      {tipo ? (
        <View>
          <Rotulo extra="(opcional)">Foto do comprovante</Rotulo>
          {fotoAtual ? (
            <View style={{ flexDirection: 'row', gap: ESPACO.m, alignItems: 'center' }}>
              <Image testID="foto-previa" source={{ uri: fotoAtual }} style={{ width: 84, height: 84, borderRadius: RAIO.p, backgroundColor: c.cartaoSuave }} contentFit="cover" />
              <View style={{ flex: 1, gap: ESPACO.p }}>
                <Text style={{ fontFamily: FONTE.media, fontSize: 14, color: c.textoSuave }}>Foto anexada.</Text>
                <Botao testID="foto-remover" titulo="Tirar a foto" tipo="secundario" pequeno icone="trash-outline" onPress={() => setFoto(null)} />
              </View>
            </View>
          ) : (
            <View style={{ gap: ESPACO.p }}>
              {temFotoNoServidor ? <Text style={{ fontFamily: FONTE.media, fontSize: 14, color: c.textoSuave }}>Este lançamento já tem uma foto. Você pode trocá-la:</Text> : null}
              <View style={{ flexDirection: 'row', gap: ESPACO.m }}>
                {Platform.OS !== 'web' ? (
                  <Botao testID="foto-camera" titulo="Câmera" tipo="secundario" pequeno icone="camera-outline" style={{ flex: 1 }} onPress={() => void adicionarFoto('camera')} />
                ) : null}
                <Botao testID="foto-galeria" titulo="Galeria" tipo="secundario" pequeno icone="image-outline" style={{ flex: 1 }} onPress={() => void adicionarFoto('galeria')} />
              </View>
            </View>
          )}
        </View>
      ) : null}

      <MensagemErro texto={erro?.texto ?? null} testID="erro-form" />
      <Botao testID="salvar" titulo={salvando ? 'Salvando…' : textoBotao} carregando={salvando} onPress={() => void salvar()} style={{ minHeight: 62 }} />
    </Cartao>
  );
}
