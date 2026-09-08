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
let html = await readFile('dev.html', 'utf8');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');
html = html.replace(/<!-- dev-only:start -->[\s\S]*?<!-- dev-only:end -->\s*/, '');
html = html.replace(/<script type="module" src="\.\/src\/game\.js"><\/script>/, () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
// 빌드 스탬프 — 브라우저가 어떤 버전을 띄웠는지 눈으로 확인하려고 남긴다
const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
html = html.replace('__BUILD__', `build ${stamp}`);

// 루트 index.html = Pages 가 주는 단일 파일(모듈 12개를 각각 캐시하는 문제를 피한다)
await writeFile('index.html', html);
await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', html);
console.log(`index.html + dist/index.html  ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB  (${stamp})`);
