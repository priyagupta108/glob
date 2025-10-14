"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashFiles = void 0;
const crypto = __importStar(require("crypto"));
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
const stream = __importStar(require("stream"));
const util = __importStar(require("util"));
const path = __importStar(require("path"));
/**
 * Symlink Protection: Checks if the realpath of file is inside any of the realpaths of roots.
 * Prevents files escaping via symlink traversal.
 */
function isInResolvedRoots(resolvedFile, resolvedRoots) {
    // Ensure normalized path comparison with trailing separator
    return resolvedRoots.some(root => resolvedFile.startsWith(root + path.sep));
}
function isExcluded(file, excludePatterns) {
    const basename = path.basename(file);
    return excludePatterns.some(pattern => {
        if (pattern.startsWith('*.')) {
            return basename.endsWith(pattern.slice(1));
        }
        return basename === pattern;
    });
}
function hashFiles(globber, currentWorkspace, options, verbose = false) {
    var _a, e_1, _b, _c;
    var _d, _e, _f, _g;
    return __awaiter(this, void 0, void 0, function* () {
        const writeDelegate = verbose ? core.info : core.debug;
        let hasMatch = false;
        // Determine roots for inclusion (default to currentWorkspace)
        const githubWorkspace = currentWorkspace
            ? currentWorkspace
            : (_d = process.env['GITHUB_WORKSPACE']) !== null && _d !== void 0 ? _d : process.cwd();
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
                // Exclude matching patterns
                if (isExcluded(file, excludePatterns)) {
                    writeDelegate(`Exclude '${file}' (pattern match).`);
                    continue;
                }
                // Symlink Protection: resolve real path of the file
                let resolvedFile;
                try {
                    resolvedFile = fs.realpathSync(file);
                }
                catch (err) {
                    core.warning(`Could not read "${file}". Please check symlinks and file access. Details: ${err}`);
                    continue; // skip if unable to resolve symlink
                }
                // Check if in resolved roots
                if (!isInResolvedRoots(resolvedFile, resolvedRoots)) {
                    outsideRootFiles.push(file);
                    if (allowOutside) {
                        writeDelegate(`Including '${file}' since it is outside the allowed workspace root(s) and 'allowFilesOutsideWorkspace' is enabled.`);
                        // continue to hashing
                    }
                    else {
                        writeDelegate(`Ignore '${file}' since it is not under allowed workspace root(s).`);
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
        // fail if any files outside root found without opt-in
        if (!allowOutside && outsideRootFiles.length > 0) {
            throw new Error(`Some files are outside your workspace:\n` +
                outsideRootFiles.map(f => `- ${f}`).join('\n') +
                `\nTo include them, set 'allowFilesOutsideWorkspace: true' in your options.`);
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
exports.hashFiles = hashFiles;
//# sourceMappingURL=internal-hash-files.js.map