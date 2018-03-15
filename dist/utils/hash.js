"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fnv_plus_1 = require("fnv-plus");
const verror_1 = require("verror");
/**
 * Computes a hash of the fs.Stats object, using relevant information.
 * This method is supposed to be as fast as possible, and the hash is optimized for uniqueness, not randomness.
 * @param {fs.Stats} stats - the stats returned by fs.stat
 * @throws {VError} if the parameter is null or if stats doesn't have mtime, ctime or size
 * @returns {string} the hash of the stats objects
 */
function hashFSStat(stats) {
    if (stats == null) {
        throw new verror_1.VError("stat is null");
    }
    if (stats.mtime == null || stats.ctime == null || stats.size == null) {
        throw new verror_1.VError("stats is malformed");
    }
    const str = stats.mtime.getTime() + "," + stats.ctime.getTime() + "," + stats.size;
    return fnv_plus_1.hash(str, 32).hex();
}
exports.hashFSStat = hashFSStat;
//# sourceMappingURL=hash.js.map