import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'client', 'dist');
const budgetKb = Number(process.env.BUNDLE_BUDGET_KB ?? 4096);
const binaryBudgetKb = Number(process.env.ASSET_BUDGET_KB ?? 1536);

if (!Number.isFinite(budgetKb) || budgetKb <= 0 || !Number.isFinite(binaryBudgetKb) || binaryBudgetKb <= 0) {
  console.error('[bundle] BUNDLE_BUDGET_KB and ASSET_BUDGET_KB must be positive numbers');
  process.exit(1);
}

if (!existsSync(dist)) {
  console.error('[bundle] client/dist not found. Run `npm run build:client` first.');
  process.exit(1);
}

const assets = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (!/\.map$/i.test(entry.name)) assets.push({ file, bytes: statSync(file).size });
  }
}
walk(dist);

assets.sort((a, b) => b.bytes - a.bytes);
const total = assets.reduce((sum, asset) => sum + asset.bytes, 0);
const kb = total / 1024;

const binary = assets.filter(asset => !/\.(js|css|html)$/i.test(asset.file)).reduce((sum, asset) => sum + asset.bytes, 0);
console.log(`[bundle] All runtime assets: ${kb.toFixed(1)} KiB across ${assets.length} files (binary ${(binary / 1024).toFixed(1)} KiB)`);
for (const asset of assets.slice(0, 8)) {
  console.log(`  ${(asset.bytes / 1024).toFixed(1).padStart(8)} KiB  ${relative(root, asset.file)}`);
}
console.log(`[bundle] budget: ${budgetKb.toFixed(0)} KiB`);
console.log(`[bundle] binary budget: ${binaryBudgetKb.toFixed(0)} KiB`);

if (total > budgetKb * 1024) {
  console.error(`[bundle] FAIL: output exceeds budget by ${((total - budgetKb * 1024) / 1024).toFixed(1)} KiB`);
  process.exit(1);
}

if (binary > binaryBudgetKb * 1024) {
  console.error(`[bundle] FAIL: binary assets exceed budget by ${((binary - binaryBudgetKb * 1024) / 1024).toFixed(1)} KiB`);
  process.exit(1);
}

console.log('[bundle] PASS');
