/* ═══════════════════════════════════════════════════════════════
   Kisan Store — src/ts/node-shims.d.ts
   Minimal ambient declarations for the Node built-ins used by
   index.ts, so `npx tsc --noEmit` passes even WITHOUT @types/node
   installed. (If you `npm install`, the real @types/node simply
   takes precedence.)
   ═══════════════════════════════════════════════════════════════ */

declare module 'node:fs' {
  /** Read a UTF-8 text file synchronously. */
  export function readFileSync(path: string, encoding?: 'utf-8'): string;
}

declare module 'node:url' {
  /** Convert a file:// URL into a filesystem path. */
  export function fileURLToPath(url: string): string;
}

declare module 'node:path' {
  /** Return the parent directory of a path. */
  export function dirname(p: string): string;
  /** Join path segments. */
  export function join(...parts: string[]): string;
}

/** The Node.js process global (argv access for the CLI). */
declare const process: {
  argv: string[];
};
