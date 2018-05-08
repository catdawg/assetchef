"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
}
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
}
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const pathutils = __importStar(require("path"));
const verror_1 = require("verror");
const pathchangeevent_1 = require("./pathchangeevent");
class Leaf {
    constructor(name, content) {
        this.name = name;
        this.content = content;
    }
}
class Branch {
    constructor(name) {
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
class PathTree extends events_1.default {
    constructor() {
        super();
        this.topLevel = new Branch("");
    }
    /**
     * DirEvent
     *
     * @event DirWatcher#treechanged
     * @param {PathChangeEvent} event - see pathchangeevent.ts
     */
    /**
     * Remove the path.
     * @param path the path.
     * @param noerror if true, if the path doesn't exist, an error will be thrown.
     * @throws {verror.VError} if path is null or doesn't exist.
     */
    remove(path, noerror = false) {
        if (path == null) {
            throw new verror_1.VError("Argument path is null");
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
                if (!noerror) {
                    throw new verror_1.VError("Tried to remove path '%s' that doesn't exist", path);
                }
                return;
            }
            if (tokensLeft === 0) {
                const node = current.leaves[token];
                delete current.leaves[token];
                if (node instanceof Branch) {
                    this.emit("treechanged", new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.UnlinkDir, path));
                }
                else {
                    this.emit("treechanged", new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.Unlink, path));
                }
                return;
            }
            if (nodeInCurrent instanceof Branch) {
                current = nodeInCurrent;
            }
            else {
                if (!noerror) {
                    throw new verror_1.VError("Tried to remove path '%s' that doesn't exist", path);
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
    set(path, content, noerror = false) {
        if (path == null) {
            throw new verror_1.VError("Argument path is null");
        }
        if (path === this.lastNodePath) {
            if (this.lastNode instanceof Leaf) {
                const leaf = this.lastNode;
                leaf.content = content;
                this.emit("treechanged", new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.Change, path));
                return;
            }
        }
        const tokens = this.pathToTokens(path);
        const newNode = new Leaf(tokens[tokens.length - 1], content);
        if (this.setNode(path, newNode, noerror)) {
            this.lastNode = newNode;
            this.lastNodePath = path;
        }
    }
    /**
     * Creates the directory, creating branches on the way.
     * If somethign already exists in that path, an error is thrown, unless no error is true
     * @param path the path to create
     * @param noerror if true, an error will be thrown if there is something already there
     * @throws {verror.VError} if path is null or something is already there
     */
    mkdir(path, noerror = false) {
        const tokens = this.pathToTokens(path);
        const newNode = new Branch(tokens[tokens.length - 1]);
        if (this.setNode(path, newNode, noerror)) {
            this.lastNode = newNode;
            this.lastNodePath = path;
        }
    }
    /**
     * Retrieves the list of paths from the branch.
     * If the path doesn't exist, is null or is not a branch, an error will be thrown.
     * @param path the path
     * @param noerror if true, an error will be thrown if the path doesn't exist or is not a branch.
     * @throws {verror.VError} if path is null or is not a branch.
     */
    *list(path, noerror = false) {
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
                    yield this.lastNodePath;
                }
            }
        }
        else {
            if (!noerror) {
                throw new verror_1.VError("path '%s' doesn't exist or is not a branch.", path);
            }
        }
    }
    /**
     * Retrieves a list of all paths in the tree.
     */
    *listAll() {
        const branchesToProcess = [this.topLevel];
        const pathToBranchToProcess = [""];
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
     * @param noerror if true, an error will be thrown if the path doesn't exist.
     * @returns {boolean} true if a dir.
     * @throws {verror.VError} if path is null
     */
    isDir(path, noerror = false) {
        const node = this.getNode(path);
        if (node != null) {
            return node instanceof Branch;
        }
        if (!noerror) {
            throw new verror_1.VError("path '%s' doesn't exist.", path);
        }
        return null;
    }
    /**
     * Checks if the path exists.
     * @param path the path.
     * @returns {boolean} true if a exists.
     * @throws {verror.VError} if path is null
     */
    exists(path) {
        const node = this.getNode(path);
        return node != null;
    }
    /**
     * Retrieves the content from the path. If the path doesn't exist or is null, an error will be thrown.
     * @param path the path
     * @param noerror if true, an error will be thrown if the path doesn't exist.
     * @throws {verror.VError} if path is null or path contains a leaf on the way.
     */
    get(path, noerror = false) {
        if (path === this.lastNodePath) {
            if (this.lastNode instanceof Leaf) {
                const leaf = this.lastNode;
                return leaf.content;
            }
        }
        const node = this.getNode(path);
        if (node != null && node instanceof Leaf) {
            this.lastNode = node;
            this.lastNodePath = path;
            return node.content;
        }
        if (!noerror) {
            throw new verror_1.VError("path '%s' doesn't exist.", path);
        }
        return null;
    }
    setNode(path, node, noerror) {
        const tokens = this.pathToTokens(path);
        let current = this.topLevel;
        let currentPath = null;
        let tokensLeft = tokens.length;
        for (const token of tokens) {
            // removes first token because that's the root.
            if (currentPath == null) {
                currentPath = "";
            }
            else {
                currentPath = pathutils.join(currentPath, token);
            }
            --tokensLeft;
            const nodeInCurrent = current.leaves[token];
            if (tokensLeft === 0) {
                if (nodeInCurrent instanceof Branch || (nodeInCurrent != null && !(node instanceof Leaf))) {
                    if (!noerror) {
                        throw new verror_1.VError("Tried to change '%s' that is already a dir, " +
                            "remove first", path);
                    }
                    return false;
                }
                if (node instanceof Branch) {
                    current.leaves[token] = node;
                    this.emit("treechanged", new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.AddDir, path));
                }
                else {
                    if (nodeInCurrent == null) {
                        current.leaves[token] = node;
                        this.emit("treechanged", new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.Add, path));
                    }
                    else {
                        nodeInCurrent.content = node.content;
                        this.emit("treechanged", new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.Change, path));
                    }
                }
                return true;
            }
            if (nodeInCurrent == null) {
                const newBranch = new Branch(token);
                current.leaves[token] = newBranch;
                current = newBranch;
                this.emit("treechanged", new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.AddDir, currentPath));
            }
            else if (nodeInCurrent instanceof Branch) {
                current = nodeInCurrent;
            }
            else {
                if (!noerror) {
                    throw new verror_1.VError("Tried to set path '%s' that has a leaf on the way, " +
                        "remove the leaf first so it can be transformed into a branch", path);
                }
                return false;
            }
        }
        /* istanbul ignore next */
        throw new verror_1.VError("Internal error, should never happen.");
    }
    getNode(path) {
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
            }
            else {
                return null;
            }
        }
        /* istanbul ignore next */
        throw new verror_1.VError("Internal error, should never happen.");
    }
    pathToTokens(path) {
        if (path == null) {
            throw new verror_1.VError("Argument path is null");
        }
        let tokens = path.split(pathutils.sep);
        tokens = tokens.map((t) => t.trim());
        tokens = tokens.filter((t) => t !== ".");
        tokens = tokens.filter((t) => t !== "");
        tokens.unshift(PathTree.ROOT);
        return tokens;
    }
}
PathTree.ROOT = "ROOT";
exports.PathTree = PathTree;
//# sourceMappingURL=pathtree.js.map