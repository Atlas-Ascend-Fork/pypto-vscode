import path from 'node:path';
import fse from 'fs-extra';

export function copy(options){
    return {
        name:'vite-plugin-copy',
        closeBundle() {
            options.targets.forEach(itemTarget => {
                const sourceDir = path.resolve(itemTarget.src);
                const targetDir = path.resolve(itemTarget.dest);

                fse.ensureDirSync(targetDir);
                fse.copySync(sourceDir,targetDir);
            })
        }
    }
}