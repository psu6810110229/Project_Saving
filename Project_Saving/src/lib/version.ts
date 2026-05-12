/**
 * Build-time app version surface. Sourced from package.json via Vite's
 * `define` injection in vite.config.ts. Renders into the VersionChip
 * shown in the top-right of AppShell so testers can correlate a bug
 * with a specific deploy.
 *
 * In dev builds the suffix `+dev` is appended so screenshots taken
 * locally are visibly distinct from production.
 */

declare const __APP_VERSION__: string;
declare const __APP_BUILD_MODE__: string;

export function appVersion(): string {
  const base = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
  const mode = typeof __APP_BUILD_MODE__ === 'string' ? __APP_BUILD_MODE__ : 'development';
  return mode === 'production' ? base : `${base}+${mode}`;
}
