// Aplica no banco as migrações de supabase/migracoes/ que ainda não foram aplicadas.
// Cada arquivo roda dentro de uma transação: ou entra inteiro, ou não entra.
// Rodar: npm run banco:aplicar   (na pasta raiz do repositório)
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from './api.mjs';

const PASTA = join(dirname(fileURLToPath(import.meta.url)), 'migracoes');

await sql(`
  create schema if not exists privado;
  create table if not exists privado.migracoes (
    nome text primary key,
    aplicada_em timestamptz not null default now()
  );
`);
const aplicadas = new Set((await sql('select nome from privado.migracoes')).map((l) => l.nome));
const arquivos = readdirSync(PASTA).filter((f) => f.endsWith('.sql')).sort();

let novas = 0;
for (const arquivo of arquivos) {
  if (aplicadas.has(arquivo)) {
    console.log('  já aplicada: ' + arquivo);
    continue;
  }
  const conteudo = readFileSync(join(PASTA, arquivo), 'utf8');
  process.stdout.write('  aplicando:   ' + arquivo + ' ... ');
  try {
    await sql(`begin;\n${conteudo}\n;insert into privado.migracoes (nome) values ('${arquivo}');\ncommit;`);
    console.log('ok');
    novas++;
  } catch (e) {
    console.log('ERRO');
    try { await sql('rollback;'); } catch { /* nada a desfazer */ }
    console.error('\n' + e.message);
    process.exit(1);
  }
}
console.log(novas ? `\n${novas} migração(ões) aplicada(s).` : '\nBanco já está atualizado.');
