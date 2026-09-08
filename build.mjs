// standalone 빌드: Rapier2D(WASM 인라인) + 게임 코드를 하나로 묶어 dist/index.html 한 파일로. file:// 로 열린다.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const result = await build({
  entryPoints: ['src/game.js'],
  bundle: true, format: 'esm', minify: true, write: false,
  alias: { rapier: '@dimforge/rapier2d-compat' },
  logLevel: 'warning',
});
const js = result.outputFiles[0].text;
let html = await readFile('index.html', 'utf8');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');
html = html.replace(/<!-- dev-only:start -->[\s\S]*?<!-- dev-only:end -->\s*/, '');
html = html.replace(/<script type="module" src="\.\/src\/game\.js"><\/script>/, () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', html);
console.log(`dist/index.html ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
