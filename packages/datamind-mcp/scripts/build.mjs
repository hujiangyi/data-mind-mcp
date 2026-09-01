import { chmod, copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = resolve(packageRoot, 'dist')

await mkdir(distRoot, { recursive: true })
await copyFile(resolve(packageRoot, 'src/index.js'), resolve(distRoot, 'index.js'))
await copyFile(
  resolve(packageRoot, 'src/cli/gen-credential.js'),
  resolve(distRoot, 'gen-credential.js'),
)
await chmod(resolve(distRoot, 'index.js'), 0o755)
await chmod(resolve(distRoot, 'gen-credential.js'), 0o755)
