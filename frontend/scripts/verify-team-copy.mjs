import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const reference = 'origin/develop';
const git = args => execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
  cwd: root, encoding: 'utf8', windowsHide: true,
}).trim();

try {
  const commit = git(['rev-parse', '--verify', reference]);
  const changed = git(['diff', '--name-only', reference, '--', '.', ':(exclude)frontend/**']);
  const added = git(['ls-files', '--others', '--exclude-standard'])
    .split('\n').filter(path => path && !path.startsWith('frontend/'));
  if (changed || added.length) {
    console.error('Arquivos fora de frontend/ diferem da develop:');
    if (changed) console.error(changed);
    if (added.length) console.error(added.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Arquivos compartilhados iguais a origin/develop (' + commit + '). Alteracoes limitadas a frontend/.');
  }
} catch (error) {
  console.error('Nao foi possivel conferir origin/develop. Execute esta verificacao na copia Git de integracao.');
  console.error(error.message);
  process.exitCode = 1;
}
