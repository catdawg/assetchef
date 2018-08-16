"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const pathutils = __importStar(require("path"));
const verror_1 = require("verror");
var PathRelationship;
(function (PathRelationship) {
    PathRelationship["Different"] = "Different";
    PathRelationship["Path1DirectlyInsidePath2"] = "Path1DirectlyInsidePath2";
    PathRelationship["Path1InsidePath2"] = "Path1InsidePath2";
    PathRelationship["Path2DirectlyInsidePath1"] = "Path2DirectlyInsidePath1";
    PathRelationship["Path2InsidePath1"] = "Path2InsidePath1";
    PathRelationship["Equal"] = "Equal";
})(PathRelationship = exports.PathRelationship || (exports.PathRelationship = {}));
/**
 * Tokenizes a path removing empty names and "."
 * @param path the path to tokenize
 * @return the tokens
 */
function cleanTokenizePath(path) {
    if (path == null) {
        throw new verror_1.VError("arg can't be null");
    }
    let tokens = path.split(pathutils.sep);
    tokens = tokens.map((t) => t.trim());
    tokens = tokens.filter((t) => t !== ".");
    tokens = tokens.filter((t) => t !== "");
    return tokens;
}
exports.cleanTokenizePath = cleanTokenizePath;
/**
 * Compares the paths to see their relationship, described the enum @see PathRelationship.
 * @param path1 path1
 * @param path2 path2
 * @returns the relationship
 */
function getPathRelationship(path1, path2) {
    if (path1 == null || path2 == null) {
        throw new verror_1.VError("args can't be null");
    }
    const path1Tokens = cleanTokenizePath(path1);
    const path2Tokens = cleanTokenizePath(path2);
    for (let path1TokensIndex = 0; path1TokensIndex < path1Tokens.length; path1TokensIndex++) {
        if (path1TokensIndex >= path2Tokens.length) {
            if (path1Tokens.length - path2Tokens.length === 1) {
                return PathRelationship.Path1DirectlyInsidePath2;
            }
            return PathRelationship.Path1InsidePath2;
        }
        if (path1Tokens[path1TokensIndex] !== path2Tokens[path1TokensIndex]) {
            return PathRelationship.Different;
        }
    }
    if (path1Tokens.length === path2Tokens.length) {
        return PathRelationship.Equal;
    }
    if (path2Tokens.length - path1Tokens.length === 1) {
        return PathRelationship.Path2DirectlyInsidePath1;
    }
    return PathRelationship.Path2InsidePath1;
}
exports.getPathRelationship = getPathRelationship;
//# sourceMappingURL=pathextra.js.map