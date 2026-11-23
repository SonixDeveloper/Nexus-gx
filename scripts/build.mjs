/* global process */
import { build } from 'esbuild'
import { copyFile } from 'node:fs/promises'

await build({
  entryPoints: ['src/main/index.ts', 'src/main/preload.ts'],
  outdir: 'dist/main',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  target: 'node24',
  external: ['electron'],
  format: 'cjs',
  define: {
    __NEXUS_UPDATE_URL__: JSON.stringify(process.env.NEXUS_UPDATE_URL ?? ''),
    __NEXUS_UPDATE_KEY__: JSON.stringify(process.env.NEXUS_UPDATE_PUBLIC_KEY ?? '')
  }
})

await copyFile('packaging/icon.png', 'dist/main/icon.png')
