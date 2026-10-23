// Copies the installed @dropins/* packages (package.json devDependencies) into
// scripts/__dropins__ so they are served as-is (Edge Delivery has no build step).
// Run `npm run install:dropins` after changing drop-in versions, and commit the result.
// Only runtime files are kept: type definitions, source maps, changelogs and package.json
// are left out (every committed file is served).
const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const target = path.join('scripts', '__dropins__');

const SKIP = [/\.d\.ts$/, /\.map$/, /(^|[\\/])package\.json$/, /(^|[\\/])CHANGELOG\.md$/i, /(^|[\\/])README\.md$/i];

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

Object.keys(deps)
  .filter((name) => name.startsWith('@dropins/'))
  .forEach((name) => {
    const dir = name.replace('@dropins/', '');
    fs.cpSync(path.join('node_modules', name), path.join(target, dir), {
      recursive: true,
      filter: (src) => !SKIP.some((re) => re.test(src)),
    });
    // eslint-disable-next-line no-console
    console.log(`vendored ${name}`);
  });
