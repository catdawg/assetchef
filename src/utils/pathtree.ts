import * as pathutils from "path";
import { VError } from "verror";

class Leaf<TContent> {
    public name: string;
    public content: TContent;
    public constructor(name: string, content: TContent) {
        this.name = name;
        this.content = content;
    }
}

interface INodeMap<TContent> {
    [key: string]: Leaf<TContent> | Branch<TContent>;
}

class Branch<TContent> {
    public name: string;
    public leaves: INodeMap<TContent>;

    public constructor(name: string) {
        this.name = name;
        this.leaves = {};
    }
}

/**
 * Structure to organize data into a tree that can be queried via a path that is split like a filesystem path.
 */
export class PathTree<TContent> {
    public topLevel: Branch<TContent> = new Branch<TContent>("");

    /**
     * Remove the path.
     * @param path the path.
     * @param noerror if true, if the path doesn't exist, an error will be thrown.
     * @throws {verror.VError} if path is null or doesn't exist.
     */
    public remove(path: string, noerror: boolean = false) {
        if (path == null) {
            throw new VError("Argument path is null");
        }
        let tokens = path.split(pathutils.delimiter);
        tokens = tokens.filter((t) => t.trim() !== "");

        let current = this.topLevel;
        let tokensLeft = tokens.length;
        for (const token of tokens) {
            --tokensLeft;
            const nodeInCurrent = current.leaves[token];

            if (nodeInCurrent == null) {
                if (!noerror) {
                    throw new VError("Tried to remove path '%s' that doesn't exist", path);
                }
                return;
            }

            if (tokensLeft === 0) {
                delete current.leaves[token];
                return;
            }

            if (nodeInCurrent instanceof Branch) {
                current = nodeInCurrent;
            } else {
                if (!noerror) {
                    throw new VError("Tried to remove path '%s' that doesn't exist", path);
                }
                return;
            }
        }
    }

    /**
     * Sets the content into the path, creating branches on the way.
     * If a leaf is on the path, an error is thrown, unless no error is true
     * @param path the path to set
     * @param content the content
     * @param noerror if true, an error will be thrown if there is a leaf on the way.
     * @throws {verror.VError} if path is null or path contains a leaf on the way.
     */
    public set(path: string, content: TContent, noerror: boolean = false): void {
        if (path == null) {
            throw new VError("Argument path is null");
        }
        let tokens = path.split(pathutils.delimiter);
        tokens = tokens.filter((t) => t.trim() !== "");

        let current = this.topLevel;

        let currentPath: string = "";

        let tokensLeft = tokens.length;
        for (const token of tokens) {
            currentPath = pathutils.join(currentPath, token);
            --tokensLeft;

            const nodeInCurrent = current.leaves[token];

            if (tokensLeft === 0) {

                if (nodeInCurrent != null) {
                    if (nodeInCurrent instanceof Branch) {
                        if (!noerror) {
                            throw new VError(
                                "Tried to set path '%s' that has a leaf on the way, " +
                                "remove the leaf first so it can be transformed into a branch", path);
                        }
                        return;
                    }

                    delete current.leaves[token];
                }
                current.leaves[token] = new Leaf(token, content);
                return;
            }

            if (nodeInCurrent == null) {
                const newBranch = new Branch<TContent>(token);
                current.leaves[token] = newBranch;
                current = newBranch;
            } else if (nodeInCurrent instanceof Branch) {
                current = nodeInCurrent;
            } else {
                if (!noerror) {
                    throw new VError(
                        "Tried to set path '%s' that has a leaf on the way, " +
                        "remove the leaf first so it can be transformed into a branch", path);
                }
                return;
            }
        }

        /* istanbul ignore next */
        throw new VError("Internal error, should never happen.");
    }

    /**
     * Retrieves the content from the path. If the path doesn't exist or is null, an error will be thrown.
     * @param path the path
     * @param noerror if true, an error will be thrown if the path doesn't exist.
     * @throws {verror.VError} if path is null or path contains a leaf on the way.
     */
    public get(path: string, noerror: boolean = false): TContent {
        if (path == null) {
            throw new VError("Argument path is null");
        }
        const node = this.getNode(path);

        if (node != null && node instanceof Leaf) {
            return node.content;
        }

        if (!noerror) {
            throw new VError("path '%s' doesn't exist.", path);
        }

        return null;
    }

    /**
     * Retrieves the list of content from the branch.
     * If the path doesn't exist, is null or is not a branch, an error will be thrown.
     * @param path the path
     * @param noerror if true, an error will be thrown if the path doesn't exist or is not a branch.
     * @throws {verror.VError} if path is null or is not a branch.
     */
    public list(path: string, noerror: boolean = false): string[] {
        if (path == null) {
            throw new VError("Argument path is null");
        }
        const node = this.getNode(path);

        if (node != null && node instanceof Branch) {

            const names = [];
            for (const property in node.leaves) {
                /* istanbul ignore else */
                if (node.leaves.hasOwnProperty(property)) {
                    names.push(node.leaves[property].name);
                }
            }

            return names;
        }

        if (!noerror) {
            throw new VError("path '%s' doesn't exist.", path);
        }

        return null;
    }

    /**
     * Checks if the path exists.
     * @param path the path.
     * @returns {boolean} true if a exists.
     * @throws {verror.VError} if path is null
     */
    public exists(path: string): boolean {
        if (path == null) {
            throw new VError("Argument path is null");
        }
        const node = this.getNode(path);

        return node != null;
    }

    /**
     * Checks if the path is a branch.
     * @param path the path.
     * @param noerror if true, an error will be thrown if the path doesn't exist.
     * @returns {boolean} true if a dir.
     * @throws {verror.VError} if path is null
     */
    public isDir(path: string, noerror: boolean = false): boolean {
        if (path == null) {
            throw new VError("Argument path is null");
        }

        const node = this.getNode(path);

        if (node != null) {
            return node instanceof Branch;
        }

        if (!noerror) {
            throw new VError("path '%s' doesn't exist.", path);
        }

        return null;
    }

    private getNode(
        path: string,
    ): Branch<TContent> | Leaf<TContent> {
        let tokens = path.split(pathutils.delimiter);
        tokens = tokens.filter((t) => t.trim() !== "");

        let current = this.topLevel;
        let tokensLeft = tokens.length;
        for (const token of tokens) {
            --tokensLeft;

            if (tokensLeft === 0) {
                return current.leaves[token];
            }

            const nodeInCurrent = current.leaves[token];

            if (nodeInCurrent == null) {
                return null;
            }

            if (nodeInCurrent instanceof Branch) {
                current = nodeInCurrent;
            } else {
                return null;
            }
        }

        return current;
    }
}
