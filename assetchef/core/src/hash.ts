import { hash } from "fnv-plus";

import { Stats } from "fs";
import { VError } from "verror";

/**
 * Computes a hash of the fs.Stats object, using relevant information.
 * This method is supposed to be as fast as possible, and the hash is optimized for uniqueness, not randomness.
 * @param {fs.Stats} stats - the stats returned by fs.stat
 * @throws {VError} if the parameter is null or if stats doesn't have mtime, ctime or size
 * @returns {string} the hash of the stats objects
 */
export function hashFSStat(stats: Stats): string {
    if (stats == null) {
        throw new VError("stat is null");
    }

    if (stats.mtime == null || stats.ctime == null || stats.size == null) {
        throw new VError("stats is malformed");
    }

    const str = stats.mtime.getTime() + "," + stats.ctime.getTime() + "," + stats.size;

    return hash(str, 32).hex();
}
