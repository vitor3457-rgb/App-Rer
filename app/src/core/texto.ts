/** Utilitários de texto. */

/** "José  da Silva " -> "jose da silva" (para comparar sem diferenciar acento/maiúscula). */
export function normalizar(texto: string | null | undefined): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove espaços extras e caracteres invisíveis. */
export function limparTexto(texto: string | null | undefined): string {
  return String(texto ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ['a','b','c'] -> "a, b ou c" */
export function listarNomes(nomes: (string | number)[]): string {
  const n = nomes.map(String);
  if (n.length <= 1) return n[0] ?? '';
  return n.slice(0, -1).join(', ') + ' ou ' + n[n.length - 1];
}

/**
 * Filtra e ordena sugestões: sem termo devolve todas; com termo, só as que contêm
 * o termo (as que começam com ele primeiro) e que não são idênticas ao digitado.
 */
export function sugerir(lista: string[], termo: string, maximo = 12): string[] {
  const t = normalizar(termo);
  const filtradas = lista.filter((item) => {
    const n = normalizar(item);
    return !t || (n.includes(t) && n !== t);
  });
  if (t) {
    filtradas.sort((a, b) => Number(!normalizar(a).startsWith(t)) - Number(!normalizar(b).startsWith(t)));
  }
  return filtradas.slice(0, maximo);
}

/** Junta listas sem repetir (comparando sem acento/maiúscula), mantendo a ordem. */
export function semRepetir(...listas: string[][]): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const lista of listas) {
    for (const item of lista) {
      const chave = normalizar(item);
      if (!chave || vistos.has(chave)) continue;
      vistos.add(chave);
      saida.push(item);
    }
  }
  return saida;
}
