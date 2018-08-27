"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * The possible directory and file changes
 * @readonly
 * @enum {string}
 * @typedef {string} PathEventType
 */
var PathEventType;
(function (PathEventType) {
    PathEventType["Add"] = "add";
    PathEventType["AddDir"] = "addDir";
    PathEventType["Unlink"] = "unlink";
    PathEventType["UnlinkDir"] = "unlinkDir";
    PathEventType["Change"] = "change";
})(PathEventType = exports.PathEventType || (exports.PathEventType = {}));
//# sourceMappingURL=ipathchangeevent.js.map