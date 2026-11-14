/** Onde o app guarda os dados no aparelho (para funcionar sem internet). */
export interface Armazenamento {
  ler(chaves: string[]): Promise<Record<string, string | null>>;
  gravar(pares: Record<string, string>): Promise<void>;
  remover(chaves: string[]): Promise<void>;
  /** Todas as chaves que começam com o prefixo. */
  chaves(prefixo: string): Promise<string[]>;
}

/** Armazenamento em memória (testes). */
export function armazenamentoMemoria(inicial: Record<string, string> = {}): Armazenamento & { dados: Record<string, string> } {
  const dados: Record<string, string> = { ...inicial };
  return {
    dados,
    async ler(chaves) {
      const r: Record<string, string | null> = {};
      for (const c of chaves) r[c] = c in dados ? dados[c] : null;
      return r;
    },
    async gravar(pares) {
      Object.assign(dados, pares);
    },
    async remover(chaves) {
      for (const c of chaves) delete dados[c];
    },
    async chaves(prefixo) {
      return Object.keys(dados).filter((c) => c.startsWith(prefixo));
    },
  };
}
