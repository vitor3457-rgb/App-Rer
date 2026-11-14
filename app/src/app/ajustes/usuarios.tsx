import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Papel, Usuario } from '@/core/tipos';
import { validarEmail } from '@/core/validacao';
import { banco, remoto } from '@/dados';
import { useSessao } from '@/dados/hooks';
import { avisar, avisarErro, perguntar } from '@/ui/avisos';
import { Botao, CampoTexto, Cartao, MensagemErro, Rotulo, Texto } from '@/ui/base';
import { Janela } from '@/ui/Janela';
import { CabecalhoVoltar, Corpo } from '@/ui/Tela';
import { ESPACO, FONTE, useCores } from '@/ui/tema';
import { toque } from '@/ui/toque';

const PAPEIS: [Papel, string, string][] = [
  ['tesoureiro', 'Tesoureiro', 'Lança, altera e exclui'],
  ['leitor', 'Só consulta', 'Vê tudo, mas não lança'],
  ['admin', 'Administrador', 'Faz tudo e gerencia usuários'],
];
const NOME_PAPEL: Record<Papel, string> = { admin: 'Administrador', tesoureiro: 'Tesoureiro', leitor: 'Só consulta' };

/** Usuários do app (só o administrador vê): quem pode entrar e com qual permissão. Precisa de internet. */
export default function Usuarios() {
  const c = useCores();
  const meuEmail = useSessao((e) => e.conta?.email);
  const [lista, setLista] = useState<Usuario[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState<Papel>('tesoureiro');
  const [ativo, setAtivo] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    setErroLista(null);
    try {
      setLista(await remoto.listarUsuarios());
    } catch (e) {
      setErroLista(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  function abrir(u: Usuario | null) {
    setEditando(u);
    setEmail(u?.email ?? '');
    setNome(u?.nome ?? '');
    setPapel(u?.papel ?? 'tesoureiro');
    setAtivo(u?.ativo ?? true);
    setErro(null);
    setAberto(true);
  }

  async function salvar() {
    const valido = validarEmail(email);
    if (!valido) {
      setErro('Escreva o e-mail completo da conta Google (ex.: nome@gmail.com).');
      return;
    }
    setOcupado(true);
    setErro(null);
    try {
      await remoto.gravarUsuario({ email: valido, nome: nome.trim(), papel, ativo });
      avisar(editando ? 'Usuário atualizado.' : 'Usuário incluído. Ele já pode entrar com essa conta Google.');
      setAberto(false);
      await carregar();
      void banco.sincronizar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
    setOcupado(false);
  }

  async function remover(u: Usuario) {
    const sim = await perguntar({
      titulo: 'Remover este usuário?',
      detalhes: [u.nome || u.email, u.email],
      mensagem: 'Ele deixa de conseguir entrar no app. Os lançamentos que ele fez continuam.',
      confirmar: 'Sim, remover',
      perigo: true,
    });
    if (!sim) return;
    try {
      await remoto.removerUsuario(u.email);
      avisar('Usuário removido.');
      setAberto(false);
      await carregar();
    } catch (e) {
      avisarErro(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <View style={{ flex: 1 }} testID="tela-usuarios">
      <CabecalhoVoltar titulo="Usuários do app" />
      <Corpo>
        <Texto suave>Só entra no app quem está nesta lista, usando o login do Google com o mesmo e-mail.</Texto>
        <Botao testID="novo-usuario" titulo="Incluir usuário" icone="person-add-outline" onPress={() => abrir(null)} />
        {erroLista ? (
          <>
            <MensagemErro texto={erroLista} />
            <Botao titulo="Tentar de novo" tipo="secundario" onPress={() => void carregar()} />
          </>
        ) : null}
        {!lista && !erroLista ? <ActivityIndicator color={c.laranja} /> : null}
        <View style={{ gap: ESPACO.p + 2 }}>
          {(lista ?? []).map((u) => (
            <Pressable key={u.email} testID="item-usuario" accessibilityRole="button" accessibilityLabel={(u.nome || u.email) + ', ' + NOME_PAPEL[u.papel]} onPress={() => { toque.leve(); abrir(u); }}>
              <Cartao style={{ opacity: u.ativo ? 1 : 0.6, gap: 2 }}>
                <Text style={{ fontFamily: FONTE.forte, fontSize: 16, color: c.texto }}>{u.nome || u.email.split('@')[0]}{u.email === meuEmail ? ' (você)' : ''}</Text>
                <Text style={{ fontFamily: FONTE.normal, fontSize: 14, color: c.textoSuave }}>{u.email}</Text>
                <Text style={{ fontFamily: FONTE.forte, fontSize: 13, color: c.laranjaEscuro }}>{NOME_PAPEL[u.papel]}{u.ativo ? '' : ' · desativado'}</Text>
              </Cartao>
            </Pressable>
          ))}
        </View>
      </Corpo>

      <Janela visivel={aberto} titulo={editando ? 'Alterar usuário' : 'Incluir usuário'} aoFechar={() => setAberto(false)} testID="janela-usuario">
        <View>
          <Rotulo>E-mail da conta Google</Rotulo>
          <CampoTexto testID="usuario-email" value={email} onChangeText={setEmail} editable={!editando} placeholder="nome@gmail.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} accessibilityLabel="E-mail da conta Google" style={editando ? { opacity: 0.6 } : undefined} />
        </View>
        <View>
          <Rotulo extra="(opcional)">Nome</Rotulo>
          <CampoTexto testID="usuario-nome" value={nome} onChangeText={setNome} placeholder="Como chamar essa pessoa" autoCapitalize="words" maxLength={80} accessibilityLabel="Nome" />
        </View>
        <View style={{ gap: ESPACO.p }}>
          <Rotulo>O que pode fazer</Rotulo>
          {PAPEIS.map(([valor, titulo, descricao]) => {
            const escolhido = papel === valor;
            return (
              <Pressable key={valor} testID={'papel-' + valor} accessibilityRole="button" accessibilityLabel={titulo + ': ' + descricao} accessibilityState={{ selected: escolhido }} onPress={() => { toque.leve(); setPapel(valor); }}
                style={{ borderRadius: 12, borderWidth: 2, borderColor: escolhido ? c.laranja : c.borda, backgroundColor: escolhido ? c.laranjaSuave : c.cartao, padding: ESPACO.m }}>
                <Text style={{ fontFamily: FONTE.forte, fontSize: 15, color: c.texto }}>{titulo}</Text>
                <Text style={{ fontFamily: FONTE.normal, fontSize: 13, color: c.textoSuave }}>{descricao}</Text>
              </Pressable>
            );
          })}
        </View>
        {editando ? (
          <Botao testID="usuario-ativo" titulo={ativo ? 'Acesso liberado (toque para bloquear)' : 'Acesso bloqueado (toque para liberar)'} tipo={ativo ? 'suave' : 'secundario'} pequeno icone={ativo ? 'lock-open-outline' : 'lock-closed-outline'} onPress={() => setAtivo(!ativo)} />
        ) : null}
        <MensagemErro texto={erro} testID="erro-usuario" />
        <Botao testID="usuario-salvar" titulo="Salvar" carregando={ocupado} onPress={() => void salvar()} />
        {editando && editando.email !== meuEmail ? <Botao testID="usuario-remover" titulo="Remover da lista" tipo="secundario" icone="trash-outline" onPress={() => void remover(editando)} /> : null}
      </Janela>
    </View>
  );
}
