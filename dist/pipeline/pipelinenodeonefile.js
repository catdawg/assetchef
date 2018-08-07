"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
}
Object.defineProperty(exports, "__esModule", { value: true });
const pathutils = __importStar(require("path"));
const verror_1 = require("verror");
const pathchangeevent_1 = require("../path/pathchangeevent");
const pathchangeprocessor_1 = require("../path/pathchangeprocessor");
const pathtree_1 = require("../path/pathtree");
const pipelinenode_1 = require("./pipelinenode");
/**
 * Base implementation for nodes that operate on only one file and don't need to know about other
 * files. Base classes simply need to implement the cookFile method
 */
class PipelineNodeOneFileMode extends pipelinenode_1.PipelineNode {
    constructor() {
        super(...arguments);
        this.productionTree = new pathtree_1.PathTree();
    }
    /**
     * Call to run a cycle, calling the cookFile method on each new or changed file.
     */
    update() {
        return __awaiter(this, void 0, void 0, function* () {
            const fileAddedAndChangedHandler = (path) => __awaiter(this, void 0, void 0, function* () {
                const content = this._prevTree.get(path);
                const result = this.shouldCook(path, content) ?
                    yield this.cookFile(path, content) :
                    [{
                            path,
                            content,
                        }];
                return () => {
                    const resultPaths = result.map((r) => r.path);
                    const pathsToDelete = [];
                    const pathsProducedBeforeAndNow = [];
                    if (this.productionTree.exists(path)) {
                        for (const previouslyResultingPath of this.productionTree.get(path)) {
                            if (resultPaths.indexOf(previouslyResultingPath) === -1) {
                                pathsToDelete.push(previouslyResultingPath);
                            }
                            else {
                                pathsProducedBeforeAndNow.push(previouslyResultingPath);
                            }
                        }
                        for (const pathToDelete of pathsToDelete) {
                            this.deleteFileAndPurgeEmptyDirectories(pathToDelete);
                        }
                    }
                    for (const r of result) {
                        if (this.actualTree.exists(r.path) &&
                            pathsProducedBeforeAndNow.indexOf(r.path) === -1) {
                            throw new verror_1.VError("Node created the same file from different sources '%s'", r.path);
                        }
                        this.actualTree.set(r.path, r.content);
                    }
                    this.productionTree.set(path, resultPaths);
                };
            });
            const res = yield this.eventProcessor.processAll({
                handleFileAdded: fileAddedAndChangedHandler,
                handleFileChanged: fileAddedAndChangedHandler,
                handleFileRemoved: (path) => __awaiter(this, void 0, void 0, function* () {
                    return () => {
                        /* istanbul ignore else */ // an unlink should never appear without being added first.
                        if (this.productionTree.exists(path)) {
                            for (const previouslyResultingPath of this.productionTree.get(path)) {
                                this.deleteFileAndPurgeEmptyDirectories(previouslyResultingPath);
                            }
                        }
                    };
                }),
                handleFolderAdded: (path) => __awaiter(this, void 0, void 0, function* () {
                    return () => {
                        if (this.productionTree.exists(path)) {
                            for (const f of this.getAllFilesProducedByFolderRecursively(path)) {
                                this.deleteFileAndPurgeEmptyDirectories(f);
                            }
                            this.productionTree.remove(path);
                        }
                    };
                }),
                handleFolderRemoved: (path) => __awaiter(this, void 0, void 0, function* () {
                    return () => {
                        /* istanbul ignore next */ // an unlink should never appear without being added first.
                        if (!this.productionTree.exists(path)) {
                            return;
                        }
                        for (const f of this.getAllFilesProducedByFolderRecursively(path)) {
                            this.deleteFileAndPurgeEmptyDirectories(f);
                        }
                        this.productionTree.remove(path);
                    };
                }),
                isDir: (path) => __awaiter(this, void 0, void 0, function* () {
                    return this._prevTree.isDir(path);
                }),
                list: (path) => __awaiter(this, void 0, void 0, function* () {
                    return [...this._prevTree.list(path)];
                }),
            });
        });
    }
    reset() {
        this._prevTreeChangeQueue.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.AddDir, ""));
    }
    setupTree() {
        return __awaiter(this, void 0, void 0, function* () {
            this.actualTree = new pathtree_1.PathTree();
            this.eventProcessor = new pathchangeprocessor_1.PathChangeProcessor(this._prevTreeChangeQueue);
            return this.actualTree.getReadonlyInterface();
        });
    }
    getAllFilesProducedByFolderRecursively(path) {
        const filesProduced = [];
        const foldersToProcess = [path];
        while (foldersToProcess.length > 0) {
            const folder = foldersToProcess.pop();
            for (const f of this.productionTree.list(folder)) {
                const fFullPath = pathutils.join(folder, f);
                if (this.productionTree.isDir(fFullPath)) {
                    foldersToProcess.push(fFullPath);
                }
                else {
                    for (const p of this.productionTree.get(fFullPath)) {
                        filesProduced.push(p);
                    }
                }
            }
        }
        return filesProduced;
    }
    deleteFileAndPurgeEmptyDirectories(path) {
        this.actualTree.remove(path);
        let folder = pathutils.dirname(path);
        if (folder === ".") {
            folder = "";
        }
        while (true) {
            if (this.actualTree.list(folder).next().done && !this._prevTree.exists(folder)) {
                this.actualTree.remove(folder);
            }
            if (folder === "") {
                break;
            }
            folder = pathutils.dirname(folder);
            if (folder === ".") {
                folder = "";
            }
        }
    }
}
exports.PipelineNodeOneFileMode = PipelineNodeOneFileMode;
//# sourceMappingURL=pipelinenodeonefile.js.map