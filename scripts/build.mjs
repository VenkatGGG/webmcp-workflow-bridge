import { build } from 'esbuild';
import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
const result = await build({
  entryPoints: { background: 'src/background.ts', content: 'src/content.ts', popup: 'src/ui/popup.ts', studio: 'src/ui/studio.ts' },
  bundle: true, outdir: 'dist', format: 'iife', target: 'chrome120',
  sourcemap: false, minify: false, metafile: true, legalComments: 'none'
});
const vendored = Object.keys(result.metafile.inputs).filter(p => p.includes('node_modules'));
if (vendored.length) throw new Error(`Unexpected runtime dependencies: ${vendored.join(', ')}`);
for (const file of ['manifest.json', 'popup.html', 'studio.html']) await cp(`extension/${file}`, `dist/${file}`);
await cp('src/ui/styles.css', 'dist/styles.css');
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
await writeFile('dist/build-info.json', JSON.stringify({ version: manifest.version, runtimeDependencies: [], assets: Object.keys(result.metafile.outputs) }, null, 2));
console.log('Built dist/ — four original JavaScript bundles, zero third-party runtime modules.');
