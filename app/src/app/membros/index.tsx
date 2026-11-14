import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { dataBR } from '@/core/datas';
import { formatarReais } from '@/core/dinheiro';
import { normalizar } from '@/core/texto';
import { historicoDoMembro } from '@/core/totais';
import { banco } from '@/dados';
import { useBanco, usePodeEscrever } from '@/dados/hooks';
import { avisar } from '@/ui/avisos';
import { Botao, CampoTexto, MensagemErro, Rotulo, Texto, Vazio } from '@/ui/base';
import { Janela } from '@/ui/Janela';
import { CabecalhoVoltar, Corpo } from '@/ui/Tela';
import { ESPACO, FONTE, RAIO, useCores } from '@/ui/tema';
import { toque } from '@/ui/toque';

/** Membros e contribuintes: lista com busca e o total que cada um já contribuiu. */
export default function Membros() {
  const c = useCores();
  const membros = useBanco((e) => e.membros);
  const lancamentos = useBanco((e) => e.lancamentos);
  const podeEscrever = usePodeEscrever();
  const [busca, setBusca] = useState('');
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const lista = useMemo(() => {
    const todos = Object.values(lancamentos);
    const termo = normalizar(busca);
    return Object.values(membros)
      .filter((m) => !termo || normalizar(m.nome).includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((m) => ({ m, h: historicoDoMembro(todos, m) }));
  }, [membros, lancamentos, busca]);

  async function criar() {
    setErro(null);
    try {
      const m = await banco.salvarMembro({ nome, telefone });
      avisar('Cadastro criado: ' + m.nome);
      setNovo(false);
      setNome('');
      setTelefone('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <View style={{ flex: 1 }} testID="tela-membros">
      <CabecalhoVoltar titulo="Membros e contribuintes" />
      <Corpo>
        <Texto suave>Todo nome usado num dízimo ou oferta entra aqui sozinho. Toque num nome para ver o histórico ou completar o cadastro.</Texto>
        <CampoTexto testID="busca-membro" value={busca} onChangeText={setBusca} placeholder="Buscar pelo nome" autoCorrect={false} accessibilityLabel="Buscar membro pelo nome" style={{ minHeight: 50 }} />
        {podeEscrever ? <Botao testID="novo-membro" titulo="Novo cadastro" icone="person-add-outline" tipo="secundario" onPress={() => { setErro(null); setNovo(true); }} /> : null}

        <View style={{ gap: ESPACO.p + 2 }}>
          {lista.map(({ m, h }) => (
            <Pressable
              key={m.id}
              testID="item-membro"
              accessibilityRole="button"
              accessibilityLabel={m.nome + ', total contribuído ' + formatarReais(h.totalCentavos)}
              onPress={() => { toque.leve(); router.push({ pathname: '/membros/[id]', params: { id: m.id } }); }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: ESPACO.m, backgroundColor: c.cartao, borderRadius: RAIO.m, padding: ESPACO.m,
                borderWidth: c.escuro ? 1 : 0, borderColor: c.borda, opacity: pressed ? 0.75 : m.ativo ? 1 : 0.6,
                boxShadow: c.escuro ? undefined : '0 1px 3px rgba(40,28,24,0.08)',
              })}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.laranjaSuave, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: FONTE.preta, fontSize: 17, color: c.laranjaEscuro }}>{m.nome.trim().charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: FONTE.forte, fontSize: 16, color: c.texto }} numberOfLines={1}>{m.nome}{m.ativo ? '' : ' (inativo)'}</Text>
                <Text style={{ fontFamily: FONTE.normal, fontSize: 13, color: c.textoSuave }}>
                  {h.quantidade ? `${h.quantidade} contribuiç${h.quantidade === 1 ? 'ão' : 'ões'} · última em ${dataBR(h.ultimaData!)}` : 'Sem contribuições registradas'}
                </Text>
              </View>
              <Text style={{ fontFamily: FONTE.forte, fontSize: 15, color: c.entrada, fontVariant: ['tabular-nums'] }}>{formatarReais(h.totalCentavos)}</Text>
              <Ionicons name="chevron-forward" size={16} color={c.textoSuave} />
            </Pressable>
          ))}
          {!lista.length ? <Vazio icone="people-outline" titulo={busca ? 'Ninguém encontrado' : 'Nenhum cadastro ainda'} texto={busca ? 'Confira o nome digitado.' : 'Os nomes aparecem aqui conforme os dízimos e ofertas são lançados.'} /> : null}
        </View>
      </Corpo>

      <Janela visivel={novo} titulo="Novo cadastro" aoFechar={() => setNovo(false)} testID="janela-membro">
        <View>
          <Rotulo>Nome</Rotulo>
          <CampoTexto testID="membro-nome" value={nome} onChangeText={setNome} placeholder="Nome completo" autoCapitalize="words" maxLength={120} accessibilityLabel="Nome" />
        </View>
        <View>
          <Rotulo extra="(opcional)">Telefone</Rotulo>
          <CampoTexto testID="membro-telefone" value={telefone} onChangeText={setTelefone} placeholder="(00) 00000-0000" keyboardType="phone-pad" maxLength={40} accessibilityLabel="Telefone" />
        </View>
        <MensagemErro texto={erro} testID="erro-membro" />
        <Botao testID="membro-salvar" titulo="Salvar" onPress={() => void criar()} />
      </Janela>
    </View>
  );
}
