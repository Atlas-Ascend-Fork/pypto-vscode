const fs   = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'sql.js','dist',  'sql-wasm.wasm');
const dstDir = path.join(__dirname, '..', 'dist', 'node_modules', 'sql.js');
const dst = path.join(dstDir, 'sql-wasm.wasm');

fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(src, dst);
console.log('copied sql-wasm.wasm →', dst);