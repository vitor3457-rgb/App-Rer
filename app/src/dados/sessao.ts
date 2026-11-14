/** Login: quem está usando o app. */
export interface Conta {
  email: string;
  nome: string;
  foto: string | null;
}

export interface Autenticacao {
  contaAtual(): Promise<Conta | null>;
  /** Abre o login do Google. Devolve false se a pessoa desistiu. */
  entrarComGoogle(): Promise<boolean>;
  sair(): Promise<void>;
  /** Avisa quando a conta muda (entrou, saiu, sessão expirou). Devolve a função para parar de ouvir. */
  aoMudar(ouvinte: (conta: Conta | null) => void): () => void;
}
