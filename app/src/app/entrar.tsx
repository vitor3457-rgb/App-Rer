import { Redirect } from 'expo-router';

/** Endereço de retorno do login do Google (adrer://entrar). A sessão é criada em dados/sessaoSupabase. */
export default function RetornoDoLogin() {
  return <Redirect href="/" />;
}
