import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const outputDirPath = path.resolve(url.fileURLToPath(import.meta.url), '../../dist');

if (fs.existsSync(outputDirPath)) {
  fs.rmSync(outputDirPath, { recursive: true });
}
