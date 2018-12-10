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
};
Object.defineProperty(exports, "__esModule", { value: true });
const pathutils = __importStar(require("path"));
const verror_1 = require("verror");
const ipathchangeevent_1 = require("../../plugin/ipathchangeevent");
const pathchangeprocessingutils_1 = require("../../utils/path/pathchangeprocessingutils");
const pathchangequeue_1 = require("../../utils/path/pathchangequeue");
const pathtree_1 = require("../../utils/path/pathtree");
/**
 * Instance of the plugin base "OneFile". Makes it easier to implement plugin instances that
 * just operate on one file as input. Plugins will then simply implement the abstract methods, cookFile,
 * shouldCook, setupOneFilePlugin, destroyOneFilePlugin
 */
class OneFilePluginBaseInstance {
    constructor() {
        this.actualTree = new pathtree_1.PathTree();
        this.treeInterface = this.actualTree;
        this.productionTree = new pathtree_1.PathTree();
    }
    setup(inLogger, config, prevStepInterface, needsUpdateCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            if (inLogger == null) {
                throw new verror_1.VError("inLogger parameter can't be null");
            }
            if (config == null) {
                throw new verror_1.VError("config parameter can't be null");
            }
            if (prevStepInterface == null) {
                throw new verror_1.VError("prevStepInterface parameter can't be null");
            }
            if (needsUpdateCallback == null) {
                throw new verror_1.VError("needsUpdateCallback parameter can't be null");
            }
            if (this.callbackUnlisten != null) {
                this.callbackUnlisten.unlisten();
            }
            this.logger = inLogger;
            this.prevTree = prevStepInterface;
            this.needsUpdateCallback = needsUpdateCallback;
            this.callbackUnlisten = this.prevTree.listenChanges((e) => {
                this.changeQueue.push(e);
                this.needsUpdateCallback();
            });
            this.changeQueue = new pathchangequeue_1.PathChangeQueue(() => {
                if (this.prevTree.exists("")) {
                    this.changeQueue.push({ eventType: ipathchangeevent_1.PathEventType.AddDir, path: "" });
                }
                else {
                    this.changeQueue.push({ eventType: ipathchangeevent_1.PathEventType.UnlinkDir, path: "" });
                }
                this.needsUpdateCallback();
            }, this.logger);
            this.reset();
            yield this.setupOneFilePlugin(config);
        });
    }
    /**
     * Part of the IRecipePluginInstance interface. Calling the cookFile/shouldCook method on each new or changed file.
     * And also takes care of cleaning up files that are removed.
     */
    update() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isSetup()) {
                return; // not setup.
            }
            const fileAddedAndChangedHandler = (path) => __awaiter(this, void 0, void 0, function* () {
                const content = this.prevTree.get(path);
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
                            throw new verror_1.VError("Plugin created the same file from different sources '%s'", r.path);
                        }
                        this.actualTree.set(r.path, r.content);
                    }
                    this.productionTree.set(path, resultPaths);
                };
            });
            yield pathchangeprocessingutils_1.PathChangeProcessingUtils.processOne(this.changeQueue, {
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
                    return this.prevTree.isDir(path);
                }),
                list: (path) => __awaiter(this, void 0, void 0, function* () {
                    return [...this.prevTree.list(path)];
                }),
            }, this.logger);
        });
    }
    /**
     * Part of the IRecipePluginInstance interface. Checks if there's anything to do.
     */
    needsUpdate() {
        if (!this.isSetup()) {
            return false;
        }
        return this.changeQueue.hasChanges();
    }
    /**
     * Part of the IRecipePluginInstance interface. Resets the plugin, processing everything again.
     */
    reset() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isSetup()) {
                return;
            }
            this.changeQueue.reset();
        });
    }
    /**
     * Part of the IRecipePluginInstance interface. Will call destroyOnFilePlugin method.
     */
    destroy() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isSetup()) {
                return;
            }
            yield this.destroyOneFilePlugin();
            this.callbackUnlisten.unlisten();
            if (this.actualTree.exists("")) {
                this.actualTree.remove("");
            }
            this.logger = null;
            this.needsUpdateCallback = null;
            this.prevTree = null;
            this.callbackUnlisten = null;
            this.changeQueue = null;
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
        /* istanbul ignore next */
        if (folder === ".") {
            folder = "";
        }
        while (true) {
            if (this.actualTree.list(folder).next().done && !this.prevTree.exists(folder)) {
                this.actualTree.remove(folder);
            }
            if (folder === "") {
                break;
            }
            folder = pathutils.dirname(folder);
            /* istanbul ignore next */
            if (folder === ".") {
                folder = "";
            }
        }
    }
    isSetup() {
        return this.prevTree != null;
    }
}
exports.OneFilePluginBaseInstance = OneFilePluginBaseInstance;
/**
 * Base implementation for plugins that operate on only one file and don't need to know about other
 * files. Subclasses should provide a getConfigSchema method and a createTypedBaseInstance implementation.
 * The latter is necessary due to typescript / javascript limitation of not being able to instantiate
 * a type through generics. i.e. just return "new <plugininstance>()""
 */
class OneFilePluginBase {
    constructor() {
        /**
         * part of the IRecipePlugin interface. Specifies the compatibility level.
         */
        this.apiLevel = 1;
        /**
         * part of the IRecipePlugin interface. Specifies the config schema.
         */
        this.configSchema = this.getConfigSchema();
    }
    /**
     * part of the IRecipePlugin~ interface. ~Instantiates an instance of this plugin.
     */
    createInstance() {
        return this.createTypedBaseInstance();
    }
}
exports.OneFilePluginBase = OneFilePluginBase;
//# sourceMappingURL=onefilepluginbase.js.map