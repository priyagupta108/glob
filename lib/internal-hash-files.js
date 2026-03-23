var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import * as crypto from 'crypto';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as stream from 'stream';
import * as util from 'util';
import * as path from 'path';
import minimatch from 'minimatch';
const { Minimatch } = minimatch;
const IS_WINDOWS = process.platform === 'win32';
const MAX_WARNED_FILES = 10;
const MINIMATCH_OPTIONS = {
    dot: true,
    nobrace: true,
    nocase: IS_WINDOWS,
    nocomment: true,
    noext: true,
    nonegate: true
};
// Checks if resolvedFile is inside any of resolvedRoots.
function isInResolvedRoots(resolvedFile, resolvedRoots) {
    const normalizedFile = IS_WINDOWS ? resolvedFile.toLowerCase() : resolvedFile;
    return resolvedRoots.some(root => {
        const normalizedRoot = IS_WINDOWS ? root.toLowerCase() : root;
        if (normalizedFile === normalizedRoot)
            return true;
        const rel = path.relative(normalizedRoot, normalizedFile);
        return (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`));
    });
}
function normalizeForMatch(p) {
    return p.split(path.sep).join('/');
}
function buildExcludeMatchers(excludePatterns) {
    return excludePatterns.map(pattern => {
        const normalizedPattern = normalizeForMatch(pattern);
        // basename-only pattern (no "/") uses matchBase so "*.log" matches anywhere
        const isBasenamePattern = !normalizedPattern.includes('/');
        return {
            absolutePathMatcher: new Minimatch(normalizedPattern, Object.assign(Object.assign({}, MINIMATCH_OPTIONS), { matchBase: false })),
            workspaceRelativeMatcher: new Minimatch(normalizedPattern, Object.assign(Object.assign({}, MINIMATCH_OPTIONS), { matchBase: isBasenamePattern }))
        };
    });
}
function isExcluded(resolvedFile, excludeMatchers, githubWorkspace) {
    if (excludeMatchers.length === 0)
        return false;
    const absolutePath = path.resolve(resolvedFile);
    const absolutePathForMatch = normalizeForMatch(absolutePath);
    const workspaceRelativePathForMatch = normalizeForMatch(path.relative(githubWorkspace, absolutePath));
    return excludeMatchers.some(m => m.absolutePathMatcher.match(absolutePathForMatch) ||
        m.workspaceRelativeMatcher.match(workspaceRelativePathForMatch));
}
export function hashFiles(globber_1, currentWorkspace_1, options_1) {
    return __awaiter(this, arguments, void 0, function* (globber, currentWorkspace, options, verbose = false) {
        var _a, e_1, _b, _c;
        var _d, _e, _f, _g;
        const writeDelegate = verbose ? core.info : core.debug;
        const githubWorkspace = currentWorkspace
            ? currentWorkspace
            : ((_d = process.env['GITHUB_WORKSPACE']) !== null && _d !== void 0 ? _d : process.cwd());
        const allowOutside = (_e = options === null || options === void 0 ? void 0 : options.allowFilesOutsideWorkspace) !== null && _e !== void 0 ? _e : false;
        const excludeMatchers = buildExcludeMatchers((_f = options === null || options === void 0 ? void 0 : options.exclude) !== null && _f !== void 0 ? _f : []);
        // Resolve roots up front; warn and skip any that fail to resolve
        const resolvedRoots = [];
        for (const root of (_g = options === null || options === void 0 ? void 0 : options.roots) !== null && _g !== void 0 ? _g : [githubWorkspace]) {
            try {
                resolvedRoots.push(fs.realpathSync(root));
            }
            catch (err) {
                core.warning(`Could not resolve root '${root}': ${err}`);
            }
        }
        if (resolvedRoots.length === 0) {
            core.warning(`Could not resolve any allowed root(s); no files will be considered for hashing.`);
            return '';
        }
        const outsideRootFiles = [];
        const result = crypto.createHash('sha256');
        const pipeline = util.promisify(stream.pipeline);
        let hasMatch = false;
        let count = 0;
        try {
            for (var _h = true, _j = __asyncValues(globber.globGenerator()), _k; _k = yield _j.next(), _a = _k.done, !_a; _h = true) {
                _c = _k.value;
                _h = false;
                const file = _c;
                writeDelegate(file);
                // Resolve real path of the file for symlink-safe exclude + root checking
                let resolvedFile;
                try {
                    resolvedFile = fs.realpathSync(file);
                }
                catch (err) {
                    core.warning(`Could not read "${file}". Please check symlinks and file access. Details: ${err}`);
                    continue;
                }
                // Exclude matching patterns (apply to resolved path for symlink-safety)
                if (isExcluded(resolvedFile, excludeMatchers, githubWorkspace)) {
                    writeDelegate(`Exclude '${file}' (exclude pattern match).`);
                    continue;
                }
                // Check if in resolved roots
                if (!isInResolvedRoots(resolvedFile, resolvedRoots)) {
                    outsideRootFiles.push(file);
                    if (allowOutside) {
                        writeDelegate(`Including '${file}' since it is outside the allowed root(s) and 'allowFilesOutsideWorkspace' is enabled.`);
                    }
                    else {
                        writeDelegate(`Skip '${file}' since it is not under allowed root(s).`);
                        continue;
                    }
                }
                if (fs.statSync(resolvedFile).isDirectory()) {
                    writeDelegate(`Skip directory '${file}'.`);
                    continue;
                }
                const hash = crypto.createHash('sha256');
                yield pipeline(fs.createReadStream(resolvedFile), hash);
                result.write(hash.digest());
                count++;
                hasMatch = true;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_h && !_a && (_b = _j.return)) yield _b.call(_j);
            }
            finally { if (e_1) throw e_1.error; }
        }
        result.end();
        // Warn if any files outside root were found without opt-in.
        if (!allowOutside && outsideRootFiles.length > 0) {
            const shown = outsideRootFiles.slice(0, MAX_WARNED_FILES);
            const remaining = outsideRootFiles.length - shown.length;
            const fileList = shown.map(f => `- ${f}`).join('\n');
            const suffix = remaining > 0
                ? `\n  ...and ${remaining} more file(s). Enable debug logging to see all.`
                : '';
            core.warning(`Some matched files are outside the allowed root(s) and were skipped:\n${fileList}${suffix}\n` +
                `To include them, set 'allowFilesOutsideWorkspace: true' in your options.`);
        }
        if (hasMatch) {
            writeDelegate(`Found ${count} files to hash.`);
            return result.digest('hex');
        }
        else {
            writeDelegate(`No matches found for glob`);
            return '';
        }
    });
}
//# sourceMappingURL=internal-hash-files.js.map