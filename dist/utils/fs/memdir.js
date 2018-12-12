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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const change_emitter_1 = require("change-emitter");
const fs = __importStar(require("fs-extra"));
const pathutils = __importStar(require("path"));
const verror_1 = require("verror");
const ipathchangeevent_1 = require("../../plugin/ipathchangeevent");
const pathchangeprocessingutils_1 = require("../path/pathchangeprocessingutils");
const pathchangequeue_1 = require("../path/pathchangequeue");
const pathtree_1 = require("../path/pathtree");
const winstonlogger_1 = __importDefault(require("../winstonlogger"));
const dirwatcher_1 = require("./dirwatcher");
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
    constructor(path, logger = winstonlogger_1.default) {
        this._processing = false;
        if (path == null) {
            throw new verror_1.VError("path is null");
        }
        this._logger = logger;
        this._actualContent = new pathtree_1.PathTree({ allowRootAsFile: true });
        this.content = {
            listenChanges: (cb) => this._actualContent.listenChanges(cb),
            exists: (p) => this._actualContent.exists(p),
            get: (p) => this._actualContent.get(p).content,
            isDir: (p) => this._actualContent.isDir(p),
            list: (p) => this._actualContent.list(p),
            listAll: () => this._actualContent.listAll(),
        };
        this._path = path;
        this._outofSyncEmitter = change_emitter_1.createChangeEmitter();
    }
    /**
     * Register a callback that is called whenever there's something new to process.
     * @param cb the callback
     * @returns a token to unlisten, keep it around and call unlisten when you're done
     */
    listenOutOfSync(cb) {
        return { unlisten: this._outofSyncEmitter.listen(cb) };
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
        return __awaiter(this, void 0, void 0, function* () {
            if (this._watcherCancelToken != null) {
                throw new verror_1.VError("Call stop before start.");
            }
            const restartQueue = () => {
                let rootStat = null;
                try {
                    rootStat = fs.statSync(this._path);
                }
                catch (e) {
                    if (this._actualContent.exists("")) {
                        if (this._actualContent.isDir("")) {
                            this._queue.push({ eventType: ipathchangeevent_1.PathEventType.UnlinkDir, path: "" });
                        }
                        else {
                            this._queue.push({ eventType: ipathchangeevent_1.PathEventType.Unlink, path: "" });
                        }
                        this.emitOutOfSync();
                    }
                    return;
                }
                if (rootStat.isDirectory()) {
                    this._queue.push({ eventType: ipathchangeevent_1.PathEventType.AddDir, path: "" });
                }
                else {
                    this._queue.push({ eventType: ipathchangeevent_1.PathEventType.Add, path: "" });
                }
                this.emitOutOfSync();
            };
            const emitEvent = (ev) => {
                /* istanbul ignore next */
                if (this._watcherCancelToken != null) {
                    this._queue.push(ev);
                    this.emitOutOfSync();
                }
            };
            this._watcherCancelToken = yield dirwatcher_1.DirWatcher.watch(this._path, emitEvent, restartQueue, this._logger);
            this._queue = new pathchangequeue_1.PathChangeQueue(restartQueue);
            restartQueue();
        });
    }
    /**
     * Stops the watching mechanism on the director.
     * @throws VError if stop was already called before or start was never called.
     */
    stop() {
        if (this._watcherCancelToken == null) {
            throw new verror_1.VError("Call start before stop.");
        }
        this._watcherCancelToken.cancel();
        this._watcherCancelToken = null;
    }
    /**
     * Resets the processing, reading everything again from the Filesystem
     * @throws VError if reset is called without start first
     */
    reset() {
        if (this._watcherCancelToken == null) {
            throw new verror_1.VError("Call start before reset.");
        }
        this._queue.reset();
    }
    /**
     * This method will make one syncing operation. It will dequeue one addition/change/removal in the filesystem
     * and process it. The @see MemDir.sync method calls this until it has nothing to do.
     * @returns Promise of a boolean that is true if succesful, false if an error occurred.
     * @throws VError if start was not called.
     */
    syncOne() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._watcherCancelToken == null) {
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
                    this._logger.logWarn("[MemDir] Failed to read %s with err %s", fullPath, err);
                    return null;
                }
                return () => {
                    // usually an unlinkDir will come, but we put this here just in case
                    /* istanbul ignore next */
                    if (this._actualContent.exists(path) && this._actualContent.isDir(path)) {
                        this._actualContent.remove(path); // there was a dir before
                    }
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
            const handler = {
                handleFileAdded: fileAddedAndChangedHandler,
                handleFileChanged: fileAddedAndChangedHandler,
                handleFileRemoved: pathRemovedHandler,
                handleFolderAdded: (path) => __awaiter(this, void 0, void 0, function* () {
                    return () => {
                        // usually an unlink will come, but we put this here just in case
                        /* istanbul ignore next */
                        if (this._actualContent.exists(path)) {
                            this._actualContent.remove(path); // was a file before.
                        }
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
                        this._logger.logWarn("[MemDir] Failed to stat file %s with err %s", fullPath, err);
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
                        this._logger.logWarn("[MemDir] Failed to read dir %s with err %s", fullPath, err);
                        return null;
                    }
                }),
            };
            this._processing = true;
            const processSuccessful = yield pathchangeprocessingutils_1.PathChangeProcessingUtils.processOne(this._queue, handler, this._logger, this._syncActionMidProcessing);
            this._processing = false;
            /* istanbul ignore next */
            if (!processSuccessful) {
                this._logger.logError("[MemDir] processing failed. Resetting...");
                this._queue.reset();
                return false;
            }
            return true;
        });
    }
    /**
     * This method will look a directory and load everything there into memory.
     * The first time, everything gets loaded, but afterwards, only the changes that occurred
     * are efficiently loaded. The current state is in @see MemDir.content
     * @returns Promise that is true if successful, false if there was an error.
     * @throws VError if start was not called.
     */
    sync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._watcherCancelToken == null) {
                throw new verror_1.VError("Call start before sync.");
            }
            while (this.isOutOfSync()) {
                const res = yield this.syncOne();
                /* istanbul ignore next */
                if (!res) {
                    return false;
                }
            }
            return true;
        });
    }
    emitOutOfSync() {
        // could be that event is redundant. Also can't call hasChanges if processing.
        if (!this._processing && this._queue.hasChanges()) {
            this._outofSyncEmitter.emit();
        }
    }
}
exports.MemDir = MemDir;
//# sourceMappingURL=memdir.js.map