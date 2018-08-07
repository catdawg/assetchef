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
const fs = __importStar(require("fs-extra"));
const pathutils = __importStar(require("path"));
const verror_1 = require("verror");
const pathchangeevent_1 = require("../path/pathchangeevent");
const pathchangeprocessor_1 = require("../path/pathchangeprocessor");
const pathchangequeue_1 = require("../path/pathchangequeue");
const pathtree_1 = require("../path/pathtree");
const dirwatcher_1 = require("./dirwatcher");
const logger = __importStar(require("./logger"));
/**
 * This class allows you to efficiently keep a directory in memory.
 * Call start to listen to changes in a directory. When you're ready call sync and you will
 * get a @see PathTree that contains all the data in a directory. Note that in between sync calls,
 * the events in the directory will be tracked so that the sync does the minimum necessary.
 */
class MemDir {
    /**
     * @param path The path you want to sync
     */
    constructor(path) {
        if (path == null) {
            throw new verror_1.VError("path is null");
        }
        this._actualContent = new pathtree_1.PathTree();
        this.content = {
            addChangeListener: (cb) => {
                this._actualContent.addListener("treechanged", cb);
            },
            removeChangeListener: (cb) => {
                this._actualContent.removeListener("treechanged", cb);
            },
            exists: (p) => this._actualContent.exists(p),
            get: (p) => this._actualContent.get(p).content,
            isDir: (p) => this._actualContent.isDir(p),
            list: (p) => this._actualContent.list(p),
            listAll: () => this._actualContent.listAll(),
        };
        this._path = path;
    }
    /**
     * Checks if any changes happened since the last sync.
     */
    isOutOfSync() {
        return this._queue.hasChanges();
    }
    /**
     * Starts the watching mechanism on the directory to handle changes and sync efficiently.
     * @throws VError if start was already called before.
     */
    start() {
        if (this._watcher != null) {
            throw new verror_1.VError("Call stop before start.");
        }
        this._watcher = new dirwatcher_1.DirWatcher(this._path);
        const restartQueue = () => {
            this._queue.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.AddDir, ""));
        };
        this._queue = new pathchangequeue_1.PathChangeQueue(restartQueue);
        this._processor = new pathchangeprocessor_1.PathChangeProcessor(this._queue);
        restartQueue();
        this._watcher.addListener("pathchanged", (e) => {
            /* istanbul ignore else */
            if (this._watcher != null) {
                this._queue.push(e);
            }
        });
    }
    /**
     * Stops the watching mechanism on the director.
     * @throws VError if stop was already called before or start was never called.
     */
    stop() {
        if (this._watcher == null) {
            throw new verror_1.VError("Call start before stop.");
        }
        this._watcher.cancel();
        this._watcher = null;
    }
    /**
     * This method will look a directory and load everything there into memory.
     * The first time, everything gets loaded, but afterwards, only the changes that occurred
     * are efficiently loaded. The current state is in @see MemDir.content
     * @throws VError if start was not called.
     */
    sync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._watcher == null) {
                throw new verror_1.VError("Call start before sync.");
            }
            const fileAddedAndChangedHandler = (path) => __awaiter(this, void 0, void 0, function* () {
                // used for testing readFile error
                if (this._syncActionForTestingBeforeFileRead != null) {
                    const syncAction = this._syncActionForTestingBeforeFileRead;
                    this._syncActionForTestingBeforeFileRead = null;
                    yield syncAction();
                }
                const fullPath = pathutils.join(this._path, path);
                let filecontent = null;
                try {
                    filecontent = yield fs.readFile(fullPath);
                }
                catch (err) {
                    logger.logWarn("[MemDir] Failed to read %s with err %s", fullPath, err);
                    return null;
                }
                return () => {
                    this._actualContent.set(path, { path, content: filecontent });
                };
            });
            const pathRemovedHandler = (path) => __awaiter(this, void 0, void 0, function* () {
                return () => {
                    // unlinkDir can be handled before all the unlink events under it arrive.
                    /* istanbul ignore next */
                    if (this._actualContent.exists(path)) {
                        this._actualContent.remove(path);
                    }
                };
            });
            this._processor._debugActionAfterProcess = this._syncActionMidProcessing;
            const res = yield this._processor.processAll({
                handleFileAdded: fileAddedAndChangedHandler,
                handleFileChanged: fileAddedAndChangedHandler,
                handleFileRemoved: pathRemovedHandler,
                handleFolderAdded: (path) => __awaiter(this, void 0, void 0, function* () {
                    return () => {
                        this._actualContent.mkdir(path);
                    };
                }),
                handleFolderRemoved: pathRemovedHandler,
                isDir: (path) => __awaiter(this, void 0, void 0, function* () {
                    /// used to test stat exception
                    if (this._syncActionForTestingBeforeStat != null) {
                        const syncAction = this._syncActionForTestingBeforeStat;
                        this._syncActionForTestingBeforeStat = null;
                        yield syncAction();
                    }
                    const fullPath = pathutils.join(this._path, path);
                    try {
                        const stat = yield fs.stat(fullPath);
                        return stat.isDirectory();
                    }
                    catch (err) {
                        logger.logWarn("[MemDir] Failed to stat file %s with err %s", fullPath, err);
                        return null;
                    }
                }),
                list: (path) => __awaiter(this, void 0, void 0, function* () {
                    /// used to test readdir exception
                    if (this._syncActionForTestingBeforeDirRead != null) {
                        const syncAction = this._syncActionForTestingBeforeDirRead;
                        this._syncActionForTestingBeforeDirRead = null;
                        yield syncAction();
                    }
                    const fullPath = pathutils.join(this._path, path);
                    try {
                        return yield fs.readdir(fullPath);
                    }
                    catch (err) {
                        logger.logWarn("[MemDir] Failed to read dir %s with err %s", fullPath, err);
                        return null;
                    }
                }),
            });
            /* istanbul ignore next */
            if (res.error != null) {
                logger.logError("[MemDir] processing failed with error '%s'. Resetting...", res.error);
                this._queue.reset();
            }
            return res.processed;
        });
    }
}
exports.MemDir = MemDir;
//# sourceMappingURL=memdir.js.map