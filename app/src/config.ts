/** Configurações fixas do app. */

export const NOME_APP = 'ADRER';
export const NOME_COMPLETO = 'Assembleia de Deus Rocha Eterna dos Remidos';

/**
 * Projeto no Supabase. Estes dois valores são públicos por natureza (vão dentro do app):
 * quem protege os dados é o login + as regras de segurança do banco (RLS).
 */
export const SUPABASE_URL = 'https://nkkqbqvhuumtlywlstws.supabase.co';
export const SUPABASE_CHAVE_PUBLICA = 'sb_publishable_IpVy9EsF4wxUAL-M7HuUSg_lwzsEHrP';

/** Modo demonstração: sem servidor, com dados de exemplo (usado nos testes automáticos). */
export const MODO_DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

/** Sugestões fixas para a descrição de despesas (as mais usadas aparecem junto). */
export const SUGESTOES_DESPESA = ['Aluguel', 'Água', 'Luz', 'Internet', 'Material de limpeza'];
