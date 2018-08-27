import EventEmitter from "events";
import * as pathutils from "path";
import { VError } from "verror";
import { IPathChangeEvent, PathEventType } from "../../plugin/ipathchangeevent";
import { IPathTreeReadonly } from "../../plugin/ipathtreereadonly";

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
/**
 * @fires PathTree#treechanged
 */
export class PathTree<TContent> extends EventEmitter {
    private static readonly ROOT = "ROOT";
    private topLevel: Branch<TContent>;
    private lastNodePath: string;
    private lastNode: Branch<TContent> | Leaf<TContent>;

    constructor() {
        super();
        this.topLevel = new Branch<TContent>("");
    }

    /**
     * DirEvent
     *
     * @event DirWatcher#treechanged
     * @param {IPathChangeEvent} event - see pathchangeevent.ts
     */

    /**
     * Remove the path.
     * @param path the path.
     * @throws {verror.VError} if path is null or doesn't exist.
     */
    public remove(path: string) {
        if (path == null) {
            throw new VError("Argument path is null");
        }
        const tokens = this.pathToTokens(path);

        this.lastNode = null;
        this.lastNodePath = null;

        let current = this.topLevel;
        let tokensLeft = tokens.length;
        for (const token of tokens) {
            --tokensLeft;
            const nodeInCurrent = current.leaves[token];

            if (nodeInCurrent == null) {
                throw new VError("Tried to remove path '%s' that doesn't exist", path);
            }

            if (tokensLeft === 0) {
                const node = current.leaves[token];
                delete current.leaves[token];

                if (node instanceof Branch) {
                    this.emitEvent({eventType: PathEventType.UnlinkDir, path});
                } else {
                    this.emitEvent({eventType: PathEventType.Unlink, path});
                }
                return;
            }

            if (nodeInCurrent instanceof Branch) {
                current = nodeInCurrent;
            } else {
                throw new VError("Tried to remove path '%s' that doesn't exist", path);
            }
        }
    }

    /**
     * Sets the content into the path, creating branches on the way.
     * If a leaf is on the path, an error is thrown
     * @param path the path to set
     * @param content the content
     * @throws {verror.VError} if path is null or path contains a leaf on the way.
     */
    public set(path: string, content: TContent): void {
        if (path == null) {
            throw new VError("Argument path is null");
        }

        if (path === this.lastNodePath) {
            if (this.lastNode instanceof Leaf) {
                const leaf = this.lastNode as Leaf<TContent>;
                leaf.content = content;

                this.emitEvent({eventType: PathEventType.Change, path});
                return;
            }
        }

        const tokens = this.pathToTokens(path);
        const newNode = new Leaf<TContent>(tokens[tokens.length - 1], content);

        this.setNode(path, newNode);
        this.lastNode = newNode;
        this.lastNodePath = path;
    }

    /**
     * Creates the directory, creating branches on the way.
     * If something already exists in that path, an error is thrown
     * @param path the path to create
     * @throws {verror.VError} if path is null or something is already there
     */
    public mkdir(path: string): void {
        const tokens = this.pathToTokens(path);
        const newNode = new Branch<TContent>(tokens[tokens.length - 1]);

        this.setNode(path, newNode);
        this.lastNode = newNode;
        this.lastNodePath = path;
    }

    /**
     * Retrieves the list of paths from the branch.
     * If the path doesn't exist, is null or is not a branch, an error will be thrown.
     * @param path the path
     * @throws {verror.VError} if path is null or is not a branch.
     */
    public *list(path: string): IterableIterator<string> {
        const node = (() => {
            if (path === this.lastNodePath) {
                if (this.lastNode instanceof Branch) {
                    return this.lastNode;
                }
            }
            return this.getNode(path);
        })();

        if (node != null && node instanceof Branch) {
            for (const property in node.leaves) {
                /* istanbul ignore else */
                if (node.leaves.hasOwnProperty(property)) {
                    this.lastNode = node.leaves[property];
                    this.lastNodePath = pathutils.join(path, this.lastNode.name);

                    yield this.lastNode.name;
                }
            }
        } else {
            throw new VError("path '%s' doesn't exist or is not a branch.", path);
        }
    }

    /**
     * Retrieves a list of all paths in the tree.
     */
    public *listAll(): IterableIterator<string> {
        const branchesToProcess: Array<Branch<TContent>> = [this.topLevel];
        const pathToBranchToProcess: string[] = [""];

        while (branchesToProcess.length > 0) {
            const branch = branchesToProcess.pop();
            const path = pathToBranchToProcess.pop();

            for (const nodeName in branch.leaves) {
                this.lastNode = branch.leaves[nodeName];
                this.lastNodePath = pathutils.join(path, nodeName);
                if (this.lastNodePath === PathTree.ROOT) {
                    this.lastNodePath = "";
                }
                yield this.lastNodePath;
                if (this.lastNode instanceof Branch) {
                    branchesToProcess.push(this.lastNode);
                    pathToBranchToProcess.push(this.lastNodePath);
                }
            }
        }
    }

    /**
     * Checks if the path is a branch.
     * @param path the path.
     * @returns {boolean} true if a dir.
     * @throws {verror.VError} if path is null
     */
    public isDir(path: string): boolean {
        const node = this.getNode(path);

        if (node != null) {
            return node instanceof Branch;
        }

        throw new VError("path '%s' doesn't exist.", path);
    }

    /**
     * Checks if the path exists.
     * @param path the path.
     * @returns {boolean} true if a exists.
     * @throws {verror.VError} if path is null
     */
    public exists(path: string): boolean {
        const node = this.getNode(path);

        return node != null;
    }

    /**
     * Retrieves the content from the path. If the path doesn't exist or is null, an error will be thrown.
     * @param path the path
     * @throws {verror.VError} if path is null or path contains a leaf on the way.
     */
    public get(path: string): TContent {
        if (path === this.lastNodePath) {
            if (this.lastNode instanceof Leaf) {
                const leaf = this.lastNode as Leaf<TContent>;
                return leaf.content;
            }
        }

        const node = this.getNode(path);

        if (node != null && node instanceof Leaf) {
            this.lastNode = node;
            this.lastNodePath = path;
            return node.content;
        }

        throw new VError("path '%s' doesn't exist.", path);
    }

    /**
     * Returns an interface that has all of the read methods.
     */
    public getReadonlyInterface(): IPathTreeReadonly<TContent> {
        return {
            addChangeListener: (cb) => {
                this.addListener("treechanged", cb);
            },
            removeChangeListener: (cb) => {
                this.removeListener("treechanged", cb);
            },
            exists: (p) => this.exists(p),
            get: (p) => this.get(p),
            isDir: (p) => this.isDir(p),
            list: (p) => this.list(p),
            listAll: () => this.listAll(),
        };
    }

    private setNode(path: string, node: Leaf<TContent> | Branch<TContent>): void {
        const tokens = this.pathToTokens(path);

        let current = this.topLevel;

        let currentPath: string = null;

        let tokensLeft = tokens.length;
        for (const token of tokens) {

            // removes first token because that's the root.
            if (currentPath == null) {
                currentPath = "";
            } else {
                currentPath = pathutils.join(currentPath, token);
            }

            --tokensLeft;

            const nodeInCurrent = current.leaves[token];

            if (tokensLeft === 0) {
                if (nodeInCurrent instanceof Branch || (nodeInCurrent != null && !(node instanceof Leaf))) {
                    throw new VError(
                        "Tried to change '%s' that is already a dir, " +
                        "remove first", path);
                }

                if (node instanceof Branch) {
                    current.leaves[token] = node;
                    this.emitEvent({eventType: PathEventType.AddDir, path});
                } else { // node is Leaf
                    if (nodeInCurrent == null) {
                        current.leaves[token] = node;
                        this.emitEvent({eventType: PathEventType.Add, path});
                    } else {
                        nodeInCurrent.content = node.content;
                        this.emitEvent({eventType: PathEventType.Change, path});
                    }
                }

                return;
            }

            if (nodeInCurrent == null) {
                const newBranch = new Branch<TContent>(token);
                current.leaves[token] = newBranch;
                current = newBranch;
                this.emitEvent({eventType: PathEventType.AddDir, path: currentPath});
            } else if (nodeInCurrent instanceof Branch) {
                current = nodeInCurrent;
            } else {
                throw new VError(
                    "Tried to set path '%s' that has a leaf on the way, " +
                    "remove the leaf first so it can be transformed into a branch", path);
            }
        }

        /* istanbul ignore next */
        throw new VError("Internal error, should never happen.");
    }

    private getNode(
        path: string,
    ): Branch<TContent> | Leaf<TContent> {
        const tokens = this.pathToTokens(path);

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

        /* istanbul ignore next */
        throw new VError("Internal error, should never happen.");
    }

    private pathToTokens(path: string): string[] {
        if (path == null) {
            throw new VError("Argument path is null");
        }

        let tokens = path.split(pathutils.sep);
        tokens = tokens.map((t) => t.trim());
        tokens = tokens.filter((t) => t !== ".");
        tokens = tokens.filter((t) => t !== "");
        tokens.unshift(PathTree.ROOT);
        return tokens;
    }

    private emitEvent(event: IPathChangeEvent) {
        this.emit("treechanged", event);
    }
}
