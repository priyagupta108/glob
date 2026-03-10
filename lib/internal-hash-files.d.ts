import { Globber } from './glob.js';
import { HashFileOptions } from './internal-hash-file-options.js';
export declare function hashFiles(globber: Globber, currentWorkspace: string, options?: HashFileOptions, verbose?: Boolean): Promise<string>;
