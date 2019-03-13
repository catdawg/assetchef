import * as nodepath from "path";
import { VError } from "verror";

export enum PathRelationship {
    Different = "Different",
    Path1DirectlyInsidePath2 = "Path1DirectlyInsidePath2",
    Path1InsidePath2 = "Path1InsidePath2",
    Path2DirectlyInsidePath1 = "Path2DirectlyInsidePath1",
    Path2InsidePath1 = "Path2InsidePath1",
    Equal = "Equal",
}

export { ParsedPath } from "upath";

export abstract class PathUtils {

    /**
     * The separator for paths in use. Always "/" now.
     */
    public static sep: string = nodepath.posix.sep;

    /**
     * Tokenizes a path, normalizing it into POSIX. @see path.posix
     * @param path the path to tokenize
     * @return the tokens
     */
    public static split(path: string): string[] {
        if (path == null) {
            throw new VError("arg can't be null");
        }
        return nodepath.posix.normalize(PathUtils.toUnix(path)).split(PathUtils.sep);
    }

    /**
     * Joins a path into a POSIX path, cleaning it up in the process. @see path.posix
     * @param pathParts the path parts to join
     * @return the tokens
     */
    public static join(...pathParts: string[]): string {
        if (pathParts.filter((s) => s == null).length !== 0) {
            throw new VError("arg can't be null");
        }
        return nodepath.posix.join(...pathParts.map((s) => PathUtils.toUnix(s)));
    }

    /**
     * Normalizes a path into a POSIX path, removing ".." and "." and cleaning up empty parts.  @see path.posix
     * @param path the path to normalize
     * @return the clean path
     */
    public static normalize(path: string): string {
        if (path == null) {
            throw new VError("arg can't be null");
        }
        return PathUtils.toUnix(nodepath.normalize(PathUtils.toUnix(path)));
    }

    /**
     * Resolves a path to find an absolute path.  @see path.posix
     * @param paths the paths to use
     * @return the clean path
     */
    public static resolve(...pathSegments: string[]): string {
        if (pathSegments.filter((s) => s == null).length !== 0) {
            throw new VError("arg can't be null");
        }
        return PathUtils.toUnix(nodepath.resolve(...pathSegments.map((s) => PathUtils.toUnix(s))));
    }

    /**
     * Parses a path into different components.  @see path.posix
     * @param path the path to use
     * @return the components
     */
    public static parse(path: string): nodepath.ParsedPath {
        if (path == null) {
            throw new VError("arg can't be null");
        }
        return nodepath.parse(PathUtils.toUnix(path));
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

        const path1Tokens = PathUtils.split(path1).filter((s) => s !== ".");
        const path2Tokens = PathUtils.split(path2).filter((s) => s !== ".");

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

    private static toUnix(path: string): string {
        const double = /\/\//;
        path = path.replace(/\\/g, "/");
        while (path.match(double)) {
          path = path.replace(double, "/");
        }
        return path;
    }
}
