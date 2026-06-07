import { gzipSync } from 'node:zlib';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const assetsDir = path.resolve('dist/assets');
const files = (await readdir(assetsDir)).filter((file) => file.endsWith('.js'));
const rows = await Promise.all(files.map(async (file) => {
  const contents = await readFile(path.join(assetsDir, file));
  return {
    file,
    rawKb: contents.byteLength / 1024,
    gzipKb: gzipSync(contents).byteLength / 1024,
  };
}));

rows.sort((a, b) => b.gzipKb - a.gzipKb);
const entry = rows.find((row) => /^index-.*\.js$/.test(row.file));
const totalGzipKb = rows.reduce((sum, row) => sum + row.gzipKb, 0);
const ENTRY_GZIP_BUDGET_KB = 160;
const TOTAL_GZIP_BUDGET_KB = 500;

console.table(rows.slice(0, 12).map((row) => ({
  file: row.file,
  rawKb: row.rawKb.toFixed(1),
  gzipKb: row.gzipKb.toFixed(1),
})));
console.log(`Entry gzip: ${entry?.gzipKb.toFixed(1) ?? 'n/a'} kB / ${ENTRY_GZIP_BUDGET_KB} kB`);
console.log(`Total JS gzip: ${totalGzipKb.toFixed(1)} kB / ${TOTAL_GZIP_BUDGET_KB} kB`);

if (!entry || entry.gzipKb > ENTRY_GZIP_BUDGET_KB || totalGzipKb > TOTAL_GZIP_BUDGET_KB) {
  process.exitCode = 1;
}
