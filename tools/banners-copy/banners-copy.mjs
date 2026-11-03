#!/usr/bin/env node
/* eslint-disable no-console, no-underscore-dangle -- CLI output; CF fields (_path…) */
/*
 * Copy of the public banners in the page HTML (for AI agents, which read the HTML without
 * running scripts). The home carousel shows banner Content Fragments fetched in the browser;
 * this writes the banners an anonymous visitor sees (publico empty / "todos" / "visitante",
 * active dates, by "ordem") as authored slides of the carousel-hero block, with the option
 * "banners-<channel>" instead of the Fonte / Público / Escopo Target rows. On the site the
 * Content Fragments still replace these slides; they only show if the fetch fails.
 *
 * Images: resized through Dynamic Media on the AEM publish tier and stored in Document
 * Authoring (/images/banners/…), so the page holds no AEM asset URL (those make publishing
 * from the Universal Editor fail).
 *
 *   node tools/banners-copy/banners-copy.mjs [--page index] [--channel site] [--write]
 *
 * Without --write: prints what it would do (nothing changes). With --write it updates
 * content/<page>.plain.html, uploads the images and the page to DA and previews the page
 * (never publishes live). Uploads use curl, so the credentials the environment provides for
 * admin.da.live / admin.hlx.page apply. Run again whenever the banners change.
 */
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync, readFileSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORG = 'denisadobe';
const SITE = 'copel';
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIENCE = 'visitante'; // anonymous visitor, as in carousel-hero-cf.js
const IMAGE_WIDTH = 2000;

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const PAGE = arg('page', 'index');
const CHANNEL = arg('channel', 'site');
const WRITE = args.includes('--write');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const text = (v) => (typeof v === 'string' ? v : v?.plaintext ?? '').trim();
const curl = (curlArgs) => execFileSync('curl', ['-sS', '--fail-with-body', '--compressed', ...curlArgs], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/* same rules as blocks/carousel-hero/carousel-hero-cf.js */
const matchesAudience = (item) => {
  const values = (Array.isArray(item.publico) ? item.publico : [item.publico])
    .filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim().toLowerCase());
  return !values.length || values.includes('todos') || values.includes(AUDIENCE);
};
const parseDate = (value, endOfDay) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const v = value.trim();
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T${endOfDay ? '23:59:59.999' : '00:00:00'}` : v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const isActive = (item, now) => {
  const from = parseDate(item.ativoDe, false);
  const to = parseDate(item.ativoAte, true);
  return (!from || now >= from) && (!to || now <= to);
};
const order = (item) => (Number.isFinite(Number(item.ordem)) && item.ordem !== null && item.ordem !== '' ? Number(item.ordem) : Infinity);
const safeHref = (v) => {
  const s = (v || '').trim();
  if (/^\/(?![/\\])/.test(s)) return s;
  try { return /^https?:$/.test(new URL(s).protocol) ? new URL(s).href : null; } catch { return null; }
};

/** The block element (balanced <div>…</div>) starting at the "carousel-hero" class. */
function findBlock(html) {
  const start = html.search(/<div class="carousel-hero(?:[\s"])/);
  if (start < 0) throw new Error('no carousel-hero block in the page');
  const tag = /<(\/?)div\b[^>]*>/g;
  tag.lastIndex = start;
  let depth = 0;
  let m = tag.exec(html);
  while (m) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return { start, end: tag.lastIndex, html: html.slice(start, tag.lastIndex) };
    m = tag.exec(html);
  }
  throw new Error('unbalanced carousel-hero block');
}

async function main() {
  const config = JSON.parse(readFileSync(join(REPO_ROOT, 'config.json'), 'utf8')).public.default;
  const listUrl = config['aem-banners-url'].replace(/\{canal\}/g, encodeURIComponent(CHANNEL));
  const publish = config['aem-publish-url'].replace(/\/$/, '');
  const json = await (await fetch(listUrl)).json();
  const now = new Date();
  const items = (json?.data?.bannerList?.items || [])
    .filter((i) => i && isActive(i, now) && matchesAudience(i))
    .sort((a, b) => order(a) - order(b));
  if (!items.length) throw new Error(`no public banner in ${listUrl}`);

  const work = mkdtempSync(join(tmpdir(), 'banners-copy-'));
  const uploads = [];
  const image = (ref, name) => {
    const url = ref?._dynamicUrl ? `${publish}${ref._dynamicUrl}?width=${IMAGE_WIDTH}&quality=80` : ref?._publishUrl;
    if (!url) return null;
    const daPath = `/images/banners/${name}.jpg`;
    uploads.push({ url, daPath, file: join(work, `${name}.jpg`) });
    return `https://content.da.live/${ORG}/${SITE}${daPath}`;
  };

  const rows = items.map((item) => {
    const name = item._path.split('/').pop();
    const alt = esc(text(item.imagemAlt));
    const pictures = [image(item.imagem, name), image(item.imagemMobile, `${name}-mobile`)]
      .filter(Boolean).map((src) => `<picture><img src="${src}" alt="${alt}"></picture>`).join('');
    const paragraphs = text(item.resumo).split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
      .map((p) => `<p>${esc(p)}</p>`)
      .join('');
    const links = [[item.ctaTexto, item.ctaLink], [item.ctaSecundarioTexto, item.ctaSecundarioLink]]
      .map(([label, href]) => (text(label) && safeHref(href) ? `<p><a href="${esc(safeHref(href))}">${esc(text(label))}</a></p>` : ''))
      .join('');
    return `<div><div>${pictures}</div><div><h2>${esc(text(item.titulo))}</h2>${paragraphs}${links}</div></div>`;
  });

  const daSource = curl([`https://admin.da.live/source/${ORG}/${SITE}/${PAGE}.html`]);
  const mainHtml = (/<main>([\s\S]*)<\/main>/.exec(daSource) || [])[1];
  if (!mainHtml) throw new Error('page has no <main>');
  const block = findBlock(mainHtml);
  const classes = (/^<div class="([^"]+)"/.exec(block.html)[1]).split(/\s+/)
    .filter((c) => c !== 'carousel-hero' && !c.startsWith('banners-'));
  const blockHtml = `<div class="${['carousel-hero', `banners-${CHANNEL}`, ...classes].join(' ')}">${rows.join('')}</div>`;
  const newMain = mainHtml.slice(0, block.start) + blockHtml + mainHtml.slice(block.end);

  console.log(`${items.length} banner(s) for ${AUDIENCE} (${CHANNEL}):`);
  items.forEach((i) => console.log(`  - ${text(i.titulo)}  [${i._path}]`));
  console.log(`block: <div class="${['carousel-hero', `banners-${CHANNEL}`, ...classes].join(' ')}"> (${rows.length} slides, replaces ${block.html.length} chars)`);
  uploads.forEach((u) => console.log(`  image ${u.daPath} <- ${u.url}`));
  if (!WRITE) {
    console.log('\ndry run: nothing changed (add --write to update content/, DA and the preview)');
    return;
  }

  // local copy first: the preview renders content/, and the upload is built from that file
  const local = join(REPO_ROOT, 'content', `${PAGE}.plain.html`);
  writeFileSync(local, newMain);
  uploads.forEach((u) => {
    curl(['-o', u.file, u.url]);
    curl(['-X', 'POST', '-F', `data=@${u.file};type=image/jpeg`, `https://admin.da.live/source/${ORG}/${SITE}${u.daPath}`]);
  });
  const pageFile = join(work, `${PAGE.replace(/\//g, '_')}.html`);
  writeFileSync(pageFile, `<body><header></header><main>${readFileSync(local, 'utf8')}</main><footer></footer></body>`);
  curl(['-X', 'POST', '-F', `data=@${pageFile};type=text/html`, `https://admin.da.live/source/${ORG}/${SITE}/${PAGE}.html`]);
  curl(['-X', 'POST', `https://admin.hlx.page/preview/${ORG}/${SITE}/main/${PAGE === 'index' ? '' : PAGE}`]);
  console.log(`\nupdated ${local}, ${uploads.length} image(s) and the page in DA, preview done (not published live)`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
