import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function supportsNode(version) {
  const parts = version.replace(/^v/, '').split('.');
  if (parts.length !== 3 || parts.some(part => !/^\d+$/.test(part))) return false;
  const [major, minor] = parts.map(Number);
  return major > 22 || (major === 22 && minor >= 22);
}

export function checkSetup() {
  const checks = [{
    name: 'Node.js 22.22 or later',
    ok: supportsNode(process.versions.node),
    detail: process.versions.node,
  }];
  for (const command of ['git', 'pnpm', 'docker', 'caddy']) {
    const result = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 5000 });
    checks.push({ name: command, ok: result.status === 0 });
  }
  return checks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const checks = checkSetup();
  for (const check of checks) {
    console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` (${check.detail})` : ''}`);
  }
  process.exitCode = checks.every(check => check.ok) ? 0 : 1;
}
