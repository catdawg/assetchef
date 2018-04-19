"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CacheEntry {
    constructor() {
        this.refcount = 0;
    }
    CacheEntry(c) {
        this.content = c;
    }
    GetContent() {
        return this.content;
    }
}
class Cache {
}
exports.Cache = Cache;
//# sourceMappingURL=weakholder.js.map