import fs from 'node:fs';
import path from 'node:path';

const outputDirPath = path.resolve(import.meta.dirname, '../dist');
if (fs.existsSync(outputDirPath)) {
  fs.rmSync(outputDirPath, { recursive: true });
}
