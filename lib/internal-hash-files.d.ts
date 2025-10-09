import { Globber } from './glob';
import { HashFileOptions } from './internal-hash-file-options';
export declare function hashFiles(globber: Globber, currentWorkspace: string, options?: HashFileOptions, verbose?: Boolean): Promise<string>;
