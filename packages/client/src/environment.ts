export const LOCAL_GAME = import.meta.env.VITE_LOCAL_GAME === 'true';

/** Public assets must also work below a GitHub Pages repository path. */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}
