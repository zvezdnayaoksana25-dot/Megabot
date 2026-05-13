const baseUrl = normalizeBaseUrl(process.argv[2] || process.env.MEGABOT_PAGES_URL || 'http://127.0.0.1:4173/');

const requiredAssets = [
  { path: '', label: 'index.html', mustContain: ['id="app"', 'src="./src/app.js"'] },
  { path: 'src/app.js', label: 'src/app.js', mustContain: ['seedIfEmpty().then(refresh).catch(renderError)'] },
  { path: 'src/styles.css', label: 'src/styles.css', mustContain: ['.boot'] },
  { path: 'data/memory.json', label: 'data/memory.json', json: true },
  { path: '.nojekyll', label: '.nojekyll' }
];

const results = [];
let failed = false;

for (const asset of requiredAssets) {
  const url = new URL(asset.path, baseUrl).toString();
  try {
    const response = await fetch(url, { cache: 'no-store' });
    const text = await response.text();
    const checks = [];

    if (!response.ok) {
      failed = true;
      checks.push(`HTTP ${response.status}`);
    }

    for (const fragment of asset.mustContain || []) {
      if (!text.includes(fragment)) {
        failed = true;
        checks.push(`missing fragment: ${fragment}`);
      }
    }

    if (asset.json) {
      try {
        JSON.parse(text);
      } catch {
        failed = true;
        checks.push('invalid JSON');
      }
    }

    results.push({ asset, status: response.status, bytes: text.length, ok: response.ok && checks.length === 0, checks });
  } catch (error) {
    failed = true;
    results.push({ asset, status: 'NETWORK_ERROR', bytes: 0, ok: false, checks: [error.message] });
  }
}

for (const result of results) {
  const icon = result.ok ? '✅' : '❌';
  const details = result.checks.length ? ` — ${result.checks.join('; ')}` : '';
  console.log(`${icon} ${result.asset.label}: ${result.status}, ${result.bytes} bytes${details}`);
}

if (failed) {
  console.error(`\nMegabot Pages verification failed for ${baseUrl}`);
  process.exit(1);
}

console.log(`\nMegabot Pages verification passed for ${baseUrl}`);

function normalizeBaseUrl(value) {
  try {
    const url = new URL(value.endsWith('/') ? value : `${value}/`);
    return url.toString();
  } catch {
    throw new Error(`Invalid Pages URL: ${value}`);
  }
}
