// (v323.1) The WebKit jobs run in Playwright's own image (.github/workflows/test.yml, container): its browsers are
// built for one Playwright version, so the image's tag must be the Playwright version installed. Exits 1, saying both,
// if they differ (test/app.test.mjs checks the same before a push).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export function pwImageCheck(root = new URL('..', import.meta.url)) {
  const wf = readFileSync(new URL('.github/workflows/test.yml', root), 'utf8'),
    tags = [...wf.matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/g)].map((m) => m[1]),
    pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')),
    want =
      (pkg.devDependencies && pkg.devDependencies.playwright) ||
      (pkg.dependencies && pkg.dependencies.playwright),
    have = require('playwright/package.json').version;
  const bad = [];
  if (!tags.length) bad.push('no Playwright image in the workflow');
  for (const t of tags)
    if (t !== have) bad.push(`the workflow's image is v${t}, Playwright installed is ${have}`);
  if (want !== have) bad.push(`package.json asks for "${want}": pin it to the installed ${have} exactly`);
  return bad;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const bad = pwImageCheck();
  if (bad.length) {
    console.error('Playwright and its image differ:\n  ' + bad.join('\n  '));
    process.exit(1);
  }
  console.log('Playwright ' + require('playwright/package.json').version + ' matches the WebKit jobs’ image');
}
