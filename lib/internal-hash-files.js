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
/**
 * Symlink Protection: Checks if the realpath of file is inside any of the realpaths of roots.
 * Prevents files escaping via symlink traversal.
 */
function isInResolvedRoots(resolvedFile, resolvedRoots) {
    // Allow exact root equality, and root directory containment
    return resolvedRoots.some(root => resolvedFile === root || resolvedFile.startsWith(root + path.sep));
}
function normalizeForMatch(p) {
    // minimatch expects "/"-style separators
    return p.split(path.sep).join('/');
}
function mm(pat, target, matchBase) {
    return new Minimatch(pat, { dot: true, matchBase }).match(target);
}
function isExcluded(file, excludePatterns, githubWorkspace) {
    if (!excludePatterns || excludePatterns.length === 0)
        return false;
    const abs = path.resolve(file);
    const absNorm = normalizeForMatch(abs);
    const rel = path.relative(githubWorkspace, abs);
    const relNorm = normalizeForMatch(rel);
    return excludePatterns.some(pattern => {
        const pat = normalizeForMatch(pattern);
        // If the pattern is basename-only (no "/"), allow matchBase so "*.log" works anywhere.
        // Otherwise do path-based matching for patterns like "**/node_modules/**".
        const isBasenamePattern = !pat.includes('/');
        return mm(pat, absNorm, false) || mm(pat, relNorm, isBasenamePattern);
    });
}
export function hashFiles(globber_1, currentWorkspace_1, options_1) {
    return __awaiter(this, arguments, void 0, function* (globber, currentWorkspace, options, verbose = false) {
        var _a, e_1, _b, _c;
        var _d, _e, _f, _g;
        const writeDelegate = verbose ? core.info : core.debug;
        let hasMatch = false;
        // Determine roots for inclusion (default to currentWorkspace)
        const githubWorkspace = currentWorkspace
            ? currentWorkspace
            : ((_d = process.env['GITHUB_WORKSPACE']) !== null && _d !== void 0 ? _d : process.cwd());
        const roots = (_e = options === null || options === void 0 ? void 0 : options.roots) !== null && _e !== void 0 ? _e : [githubWorkspace];
        const allowOutside = (_f = options === null || options === void 0 ? void 0 : options.allowFilesOutsideWorkspace) !== null && _f !== void 0 ? _f : false;
        const excludePatterns = (_g = options === null || options === void 0 ? void 0 : options.exclude) !== null && _g !== void 0 ? _g : [];
        // Symlink Protection: resolve all roots up front
        let resolvedRoots = [];
        try {
            resolvedRoots = roots.map(root => fs.realpathSync(root));
        }
        catch (err) {
            core.warning(`Could not check workspace location: ${err}`);
            return '';
        }
        const outsideRootFiles = [];
        const result = crypto.createHash('sha256');
        let count = 0;
        try {
            for (var _h = true, _j = __asyncValues(globber.globGenerator()), _k; _k = yield _j.next(), _a = _k.done, !_a; _h = true) {
                _c = _k.value;
                _h = false;
                const file = _c;
                writeDelegate(file);
                // Symlink Protection: resolve real path of the file (use this for exclude + hashing)
                let resolvedFile;
                try {
                    resolvedFile = fs.realpathSync(file);
                }
                catch (err) {
                    core.warning(`Could not read "${file}". Please check symlinks and file access. Details: ${err}`);
                    continue; // skip if unable to resolve symlink
                }
                // Exclude matching patterns (apply to resolved path for symlink-safety)
                if (isExcluded(resolvedFile, excludePatterns, githubWorkspace)) {
                    writeDelegate(`Exclude '${file}' (exclude pattern match).`);
                    continue;
                }
                // Check if in resolved roots
                if (!isInResolvedRoots(resolvedFile, resolvedRoots)) {
                    outsideRootFiles.push(file);
                    if (allowOutside) {
                        writeDelegate(`Including '${file}' since it is outside the allowed workspace root(s) and 'allowFilesOutsideWorkspace' is enabled.`);
                    }
                    else {
                        writeDelegate(`Skip '${file}' since it is not under allowed workspace root(s).`);
                        continue;
                    }
                }
                if (fs.statSync(resolvedFile).isDirectory()) {
                    writeDelegate(`Skip directory '${file}'.`);
                    continue;
                }
                const hash = crypto.createHash('sha256');
                const pipeline = util.promisify(stream.pipeline);
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
        // Warn if any files outside root found without opt-in
        if (!allowOutside && outsideRootFiles.length > 0) {
            writeDelegate(`Some files are outside your workspace:\n${outsideRootFiles
                .map(f => `- ${f}`)
                .join('\n')}\nTo include them, set 'allowFilesOutsideWorkspace: true' in your options.`);
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