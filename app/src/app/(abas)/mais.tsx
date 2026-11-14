import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { dataHoraBR } from '@/core/datas';
import { aplicarDigitacao, formatarReais } from '@/core/dinheiro';
import { MODO_DEMO } from '@/config';
import { banco, remoto, sair } from '@/dados';
import { useBanco, useCaixa, useEhAdmin, useSessao } from '@/dados/hooks';
import { avisar, avisarErro, perguntar } from '@/ui/avisos';
import { Botao, CampoTexto, Cartao, ItemMenu, MensagemErro, Rotulo, Separador, Texto } from '@/ui/base';
import { Janela } from '@/ui/Janela';
import { DIAS_SEMANA, LEMBRETE_DISPONIVEL, Lembrete, salvarLembrete, textoLembrete, useLembrete } from '@/ui/lembrete';
import { Cabecalho, Corpo } from '@/ui/Tela';
import { ESPACO, FONTE, PreferenciaTema, definirTema, useCores, usePreferenciaTema } from '@/ui/tema';
import { toque } from '@/ui/toque';

const PAPEIS = { admin: 'Administrador', tesoureiro: 'Tesoureiro', leitor: 'Só consulta' } as const;

function Escolhas<T extends string | number>({ opcoes, valor, onMudar, prefixo }: { opcoes: [T, string][]; valor: T; onMudar: (v: T) => void; prefixo: string }) {
  const c = useCores();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.p }}>
      {opcoes.map(([v, rotulo]) => {
        const ativo = v === valor;
        return (
          <Pressable
            key={String(v)}
            testID={prefixo + '-' + v}
            accessibilityRole="button"
            accessibilityLabel={rotulo}
            accessibilityState={{ selected: ativo }}
            onPress={() => { toque.leve(); onMudar(v); }}
            style={{ minHeight: 42, paddingHorizontal: 14, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: ativo ? c.rocha : c.cartaoSuave, borderWidth: 1, borderColor: ativo ? c.rocha : c.borda }}>
            <Text style={{ fontFamily: FONTE.forte, fontSize: 14, color: ativo ? c.cartao : c.texto }}>{rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tela 4 — Mais: cadastros, caixa, aparência, lembrete, sincronização e conta. */
export default function Mais() {
  const c = useCores();
  const conta = useSessao((e) => e.conta);
  const usuario = useBanco((e) => e.usuario);
  const admin = useEhAdmin();
  const caixa = useCaixa();
  const abertura = useBanco((e) => e.config.saldoAberturaCentavos);
  const sinc = useBanco((e) => e.sinc);
  const fila = useBanco((e) => e.fila);
  const rejeitadas = useBanco((e) => e.rejeitadas);
  const totalMembros = useBanco((e) => Object.keys(e.membros).length);
  const tema = usePreferenciaTema();
  const lembrete = useLembrete();

  const [janela, setJanela] = useState<'' | 'abertura' | 'lembrete'>('');
  const [valorAbertura, setValorAbertura] = useState(0);
  const [negativo, setNegativo] = useState(false);
  const [rascunho, setRascunho] = useState<Lembrete>(lembrete);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function abrirAbertura() {
    setValorAbertura(Math.abs(abertura));
    setNegativo(abertura < 0);
    setErro(null);
    setJanela('abertura');
  }

  async function gravarAbertura() {
    setOcupado(true);
    setErro(null);
    try {
      await remoto.gravarConfiguracao('saldo_abertura_centavos', negativo ? -valorAbertura : valorAbertura);
      await banco.sincronizar();
      avisar('Saldo de abertura atualizado.');
      setJanela('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
    setOcupado(false);
  }

  async function gravarLembrete() {
    setOcupado(true);
    setErro(null);
    try {
      await salvarLembrete(rascunho);
      avisar(rascunho.ativo ? 'Lembrete ligado: ' + textoLembrete(rascunho).toLowerCase() + '.' : 'Lembrete desligado.');
      setJanela('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
    setOcupado(false);
  }

  async function sincronizarAgora() {
    await banco.sincronizar();
    const e = banco.loja.getState();
    if (e.sinc.erro) avisarErro(e.sinc.erro);
    else if (!e.sinc.online) avisarErro('Sem internet. Tente de novo quando a conexão voltar.');
    else avisar('Tudo sincronizado.');
  }

  async function baixarTudo() {
    const sim = await perguntar({
      titulo: 'Baixar tudo de novo?',
      mensagem: 'O app confere todos os lançamentos com o servidor. O que ainda não foi enviado é mantido. Use se algo parecer diferente entre os celulares.',
      confirmar: 'Baixar',
    });
    if (!sim) return;
    await banco.recarregarTudo();
    await sincronizarAgora();
  }

  async function confirmarSaida() {
    const pendentes = banco.loja.getState().fila.length;
    const sim = pendentes
      ? await perguntar({
        titulo: 'Sair e perder o que não foi enviado?',
        mensagem: `Há ${pendentes} item(ns) guardado(s) só neste celular, ainda não enviado(s). Se sair agora, eles serão apagados. O melhor é conectar à internet e esperar o envio.`,
        confirmar: 'Sair mesmo assim',
        cancelar: 'Ficar',
        perigo: true,
      })
      : await perguntar({ titulo: 'Sair da conta?', mensagem: 'Você vai precisar entrar com o Google de novo para usar o app.', confirmar: 'Sair' });
    if (sim) await sair(true);
  }

  return (
    <View style={{ flex: 1 }} testID="tela-mais">
      <Cabecalho />
      <Corpo>
        <Texto tipo="titulo">Mais</Texto>

        <Cartao style={{ gap: 2 }}>
          <Texto tipo="subtitulo" testID="conta-nome">{usuario?.nome || conta?.nome}</Texto>
          <Texto suave testID="conta-email">{conta?.email}</Texto>
          <Texto tipo="pequeno" cor={c.laranjaEscuro} style={{ fontFamily: FONTE.forte }}>{usuario ? PAPEIS[usuario.papel] : ''}{MODO_DEMO ? ' · modo demonstração' : ''}</Texto>
        </Cartao>

        <Cartao>
          <Texto tipo="rotulo" suave>CAIXA</Texto>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: ESPACO.p }}>
            <Texto>Saldo em caixa hoje</Texto>
            <Texto testID="caixa-hoje" tipo="subtitulo" cor={caixa.saldoAtual < 0 ? c.saida : c.entrada}>{formatarReais(caixa.saldoAtual)}</Texto>
          </View>
          <Separador />
          {admin ? (
            <ItemMenu testID="menu-abertura" icone="wallet-outline" titulo="Saldo de abertura" descricao="Quanto havia em caixa antes do primeiro lançamento do app" valor={formatarReais(abertura)} onPress={abrirAbertura} />
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: ESPACO.m }}>
              <Texto suave>Saldo de abertura</Texto>
              <Texto>{formatarReais(abertura)}</Texto>
            </View>
          )}
        </Cartao>

        <Cartao>
          <Texto tipo="rotulo" suave>CADASTROS</Texto>
          <ItemMenu testID="menu-membros" icone="people-outline" titulo="Membros e contribuintes" descricao="Quem deu dízimos e ofertas, com o histórico de cada um" valor={String(totalMembros)} onPress={() => router.push('/membros')} />
          {admin ? (
            <>
              <Separador />
              <ItemMenu testID="menu-responsaveis" icone="person-circle-outline" titulo="Responsáveis" descricao="Nomes que aparecem no campo Responsável" onPress={() => router.push('/ajustes/responsaveis')} />
              <Separador />
              <ItemMenu testID="menu-usuarios" icone="key-outline" titulo="Usuários do app" descricao="Contas Google que podem entrar e o que cada uma pode fazer" onPress={() => router.push('/ajustes/usuarios')} />
            </>
          ) : null}
        </Cartao>

        <Cartao style={{ gap: ESPACO.m }}>
          <Texto tipo="rotulo" suave>APARÊNCIA</Texto>
          <Escolhas<PreferenciaTema> prefixo="tema" valor={tema} onMudar={definirTema} opcoes={[['sistema', 'Igual ao celular'], ['claro', 'Claro'], ['escuro', 'Escuro']]} />
        </Cartao>

        <Cartao>
          <Texto tipo="rotulo" suave>LEMBRETE</Texto>
          <ItemMenu
            testID="menu-lembrete"
            icone="notifications-outline"
            titulo="Lembrete semanal"
            descricao={LEMBRETE_DISPONIVEL ? 'Aviso no celular para lançar os dízimos, ofertas e despesas' : 'Disponível só no app instalado no celular'}
            valor={textoLembrete(lembrete)}
            onPress={() => { setRascunho(lembrete); setErro(null); setJanela('lembrete'); }}
          />
        </Cartao>

        <Cartao style={{ gap: ESPACO.m }}>
          <Texto tipo="rotulo" suave>SINCRONIZAÇÃO</Texto>
          <View style={{ gap: 2 }}>
            <Texto testID="sinc-estado">
              {sinc.andamento ? 'Sincronizando…' : !sinc.online ? 'Sem internet' : sinc.erro ? 'Erro ao sincronizar' : 'Tudo certo'}
              {fila.length ? ` · ${fila.length} item(ns) a enviar` : ''}
            </Texto>
            <Texto tipo="pequeno" suave>
              {sinc.ultimoSucesso ? 'Última sincronização: ' + dataHoraBR(sinc.ultimoSucesso) : 'Ainda não sincronizou neste celular.'}
            </Texto>
            {sinc.erro ? <Texto tipo="pequeno" cor={c.saida}>{sinc.erro}</Texto> : null}
          </View>
          {rejeitadas.length ? (
            <View testID="rejeitadas" style={{ backgroundColor: c.saidaSuave, borderRadius: 12, padding: ESPACO.m, gap: 6 }}>
              <Texto tipo="rotulo" cor={c.saida}>Não aceitos pelo servidor ({rejeitadas.length})</Texto>
              {rejeitadas.map((r, i) => (
                <Texto key={i} tipo="pequeno">• {r.rotulo} — {r.motivo}</Texto>
              ))}
              <Texto tipo="pequeno" suave>Esses itens não foram gravados. Se precisar, lance de novo.</Texto>
              <Botao testID="descartar-rejeitadas" titulo="Entendi, limpar avisos" tipo="secundario" pequeno onPress={() => void banco.descartarRejeitadas()} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: ESPACO.m }}>
            <Botao testID="sincronizar" titulo="Sincronizar" tipo="suave" pequeno icone="sync" style={{ flex: 1 }} carregando={sinc.andamento} onPress={() => void sincronizarAgora()} />
            <Botao testID="baixar-tudo" titulo="Baixar tudo" tipo="secundario" pequeno icone="cloud-download-outline" style={{ flex: 1 }} onPress={() => void baixarTudo()} />
          </View>
        </Cartao>

        <Cartao>
          <ItemMenu testID="menu-sair" icone="log-out-outline" titulo="Sair da conta" perigo onPress={() => void confirmarSaida()} />
        </Cartao>

        <Texto tipo="mini" suave style={{ textAlign: 'center' }}>ADRER · versão {Constants.expoConfig?.version ?? '1.0.0'}</Texto>
      </Corpo>

      <Janela visivel={janela === 'abertura'} titulo="Saldo de abertura" aoFechar={() => setJanela('')} testID="janela-abertura">
        <Texto suave>É o dinheiro que a igreja já tinha em caixa antes do primeiro lançamento feito no app. Todos os saldos partem dele.</Texto>
        <CampoTexto testID="abertura-valor" grande value={valorAbertura ? formatarReais(valorAbertura) : ''} onChangeText={(t) => setValorAbertura(aplicarDigitacao(valorAbertura, valorAbertura ? formatarReais(valorAbertura) : '', t))} placeholder="R$ 0,00" keyboardType="number-pad" inputMode="numeric" accessibilityLabel="Valor do saldo de abertura" />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Texto>O caixa começou negativo (devendo)</Texto>
          <Switch testID="abertura-negativo" value={negativo} onValueChange={setNegativo} trackColor={{ true: c.saida, false: c.borda }} />
        </View>
        <MensagemErro texto={erro} />
        <Botao testID="abertura-salvar" titulo="Salvar" carregando={ocupado} onPress={() => void gravarAbertura()} />
      </Janela>

      <Janela visivel={janela === 'lembrete'} titulo="Lembrete semanal" aoFechar={() => setJanela('')} testID="janela-lembrete">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Texto tipo="rotulo">Receber o lembrete</Texto>
          <Switch testID="lembrete-ativo" value={rascunho.ativo} onValueChange={(ativo) => setRascunho({ ...rascunho, ativo })} trackColor={{ true: c.laranja, false: c.borda }} />
        </View>
        {rascunho.ativo ? (
          <>
            <View>
              <Rotulo>Dia da semana</Rotulo>
              <Escolhas<number> prefixo="dia" valor={rascunho.diaSemana} onMudar={(diaSemana) => setRascunho({ ...rascunho, diaSemana })} opcoes={DIAS_SEMANA.map((d, i) => [i + 1, d.slice(0, 3)] as [number, string])} />
            </View>
            <View>
              <Rotulo>Horário</Rotulo>
              <Escolhas<number> prefixo="hora" valor={rascunho.hora} onMudar={(hora) => setRascunho({ ...rascunho, hora, minuto: 0 })} opcoes={[8, 12, 14, 18, 19, 20, 21, 22].map((h) => [h, ('0' + h).slice(-2) + ':00'] as [number, string])} />
            </View>
          </>
        ) : null}
        <MensagemErro texto={erro} />
        <Botao testID="lembrete-salvar" titulo="Salvar" carregando={ocupado} desativado={!LEMBRETE_DISPONIVEL} onPress={() => void gravarLembrete()} />
        {!LEMBRETE_DISPONIVEL ? <Texto tipo="pequeno" suave>O lembrete funciona só no app instalado no celular.</Texto> : null}
      </Janela>
    </View>
  );
}
