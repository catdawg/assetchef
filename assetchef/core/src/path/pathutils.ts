import * as pathutils from "path";
import { VError } from "verror";

export enum PathRelationship {
    Different = "Different",
    Path1DirectlyInsidePath2 = "Path1DirectlyInsidePath2",
    Path1InsidePath2 = "Path1InsidePath2",
    Path2DirectlyInsidePath1 = "Path2DirectlyInsidePath1",
    Path2InsidePath1 = "Path2InsidePath1",
    Equal = "Equal",
}

export abstract class PathUtils {
    /**
     * Tokenizes a path removing empty names and "."
     * @param path the path to tokenize
     * @return the tokens
     */
    public static cleanTokenizePath(path: string): string[] {
        if (path == null) {
            throw new VError("arg can't be null");
        }

        let tokens = path.split(pathutils.sep);
        tokens = tokens.map((t) => t.trim());
        tokens = tokens.filter((t) => t !== ".");
        tokens = tokens.filter((t) => t !== "");
        return tokens;
    }

    /**
     * Compares the paths to see their relationship, described the enum @see PathRelationship.
     * @param path1 path1
     * @param path2 path2
     * @returns the relationship
     */
    public static getPathRelationship(path1: string, path2: string): PathRelationship {
        if (path1 == null || path2 == null) {
            throw new VError("args can't be null");
        }

        const path1Tokens = PathUtils.cleanTokenizePath(path1);
        const path2Tokens = PathUtils.cleanTokenizePath(path2);

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
}
