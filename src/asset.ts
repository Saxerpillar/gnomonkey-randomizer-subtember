/**
 * Resolve a vendored asset path against the deploy base.
 *
 * The app is served from a subpath on GitHub Pages
 * (`/gnomonkey-randomizer-subtember/`), so bare absolute paths like
 * `/img/coins.png` would resolve against the domain root and 404. Vite rewrites
 * static references it can see at build time, but these paths are built at
 * runtime from data (item ids, boss image names), so they need this helper.
 *
 * Always use it for anything under `public/`.
 */
export const asset = (path: string): string =>
  import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
