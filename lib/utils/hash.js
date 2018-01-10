"use strict";
const VError = require("verror").VError;
const fnv = require("fnv-plus");

const hash = module.exports = {};

/**
 * Computes a hash of the fs.Stats object, using relevant information.
 * This method is supposed to be as fast as possible, and the hash is optimized for uniqueness, not randomness.
 * @param {fs.Stats} stats - the stats returned by fs.stat 
 * @throws {VError} if the parameter is null or if stats doesn't have mtime, ctime or size
 * @returns {string} the hash of the stats objects
 */
hash.hashFSStat = function(stats) {
    if (stats == null) {
        throw new VError("stat is null");
    }
     
    if (stats.mtime == null || stats.ctime == null || stats.size == null) {
        throw new VError("stats is malformed");
    }

    const str = stats.mtime.getTime() + "," + stats.ctime.getTime() + "," + stats.size;

    return fnv.hash(str, 32).hex();
};
