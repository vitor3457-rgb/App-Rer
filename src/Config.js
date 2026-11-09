/**
 * ============================================================
 *  CONFIGURAÇÕES DO APP — este é o único arquivo que costuma
 *  precisar de mudança. Depois de editar, republique o app
 *  (veja o README.md, seção "Publicar uma alteração").
 * ============================================================
 */
var CONFIG = {
  /**
   * Contas Google que podem usar o app.
   * - Um e-mail por linha, entre aspas simples, com vírgula no final.
   * - Use o e-mail da conta Google com que a pessoa entra no celular.
   * - A pessoa também precisa ter acesso de EDITOR à planilha.
   */
  USUARIOS_AUTORIZADOS: [
    'vitor3457@gmail.com',
    'PREENCHER_EMAIL_DO_TESOUREIRO@gmail.com',
  ],

  /**
   * Anos disponíveis no filtro da Tela 2 e aceitos nos lançamentos.
   * Para incluir 2027, troque por: [2026, 2027]
   */
  ANOS: [2026],

  /**
   * ID da planilha (o trecho entre /d/ e /edit no link da planilha).
   * Preenchido automaticamente na publicação. Se ficar vazio, o app usa
   * a planilha à qual o script está vinculado.
   */
  PLANILHA_ID: '1sYPLI4UyaGCvtKJIwI_OhJ3f08QFN0zPADB3qFVQIEg',

  /** Nome que aparece no topo do app e na aba do navegador. */
  NOME_APP: 'Financeiro da Igreja',

  /** Sugestões rápidas que aparecem ao lançar uma despesa (Saída). */
  SUGESTOES_DESPESA: ['Aluguel', 'Água', 'Luz', 'Internet', 'Material de limpeza'],

  /** Endereço de um ícone (PNG) para o atalho do celular. Vazio = ícone padrão. */
  ICONE_URL: '',

  // ---- Itens técnicos (normalmente não mexer) ----
  ABA_LANCAMENTOS: 'Lancamentos',
  ABA_EXCLUIDOS: 'Excluidos',
  FUSO_HORARIO: 'America/Sao_Paulo',
  VALOR_MAXIMO: 1000000, // maior valor aceito em um lançamento (R$)
  TAMANHO_MAXIMO_DESCRICAO: 200,
};
