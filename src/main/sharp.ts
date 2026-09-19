import { promises as fs } from 'fs'
import { dirname, join } from 'path'

// sharp is libvips: ~19 MB of native code. Loaded at the top of the main bundle,
// it held the window back on a cold start by ~0.8 s — mostly the first read of
// that DLL, which Windows Defender scans. So it's loaded on demand instead, once
// the window is up, and its native files are read ahead of that, off the main
// thread, while Electron is still starting: the scan happens there, and the load
// then finds them read.

type Sharp = typeof import('sharp')

let readAhead: Promise<unknown> = Promise.resolve()
let sharp: Promise<Sharp> | null = null

/** Read sharp's native libraries (@img/<platform package>/lib/*) in the background. */
export function readSharpAhead(): void {
  const imgScope = join(dirname(require.resolve('sharp/package.json')), '..', '@img')
  readAhead = fs
    .readdir(imgScope)
    .then((pkgs) =>
      Promise.all(
        pkgs.map(async (pkg) => {
          const lib = join(imgScope, pkg, 'lib')
          const files = await fs.readdir(lib).catch(() => [])
          await Promise.all(files.map((f) => fs.readFile(join(lib, f))))
        })
      )
    )
    .catch(() => {}) // only a head start; loading works without it
}

/** sharp itself, loaded on first use — after the read-ahead has finished. */
export function loadSharp(): Promise<Sharp> {
  if (!sharp) {
    sharp = readAhead.then(async () => {
      const lib = (await import('sharp')).default
      // One libvips thread per operation; ipc.ts caps how many run at once.
      lib.concurrency(1)
      return lib
    })
  }
  return sharp
}
