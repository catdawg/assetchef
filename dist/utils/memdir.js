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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
}
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs-extra"));
const pathutils = __importStar(require("path"));
const semaphore_async_await_1 = __importDefault(require("semaphore-async-await"));
const verror_1 = require("verror");
const dirwatcher_1 = require("./dirwatcher");
const logger = __importStar(require("./logger"));
const pathchangeevent_1 = require("./path/pathchangeevent");
const pathchangeprocessor_1 = require("./path/pathchangeprocessor");
const pathtree_1 = require("./path/pathtree");
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
        this._content = new pathtree_1.PathTree();
        this._path = path;
        this._syncInterruptionSemaphoreForTesting = new semaphore_async_await_1.default(1);
        this._syncInterruptionSemaphoreForTesting2 = new semaphore_async_await_1.default(1);
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
        const reset = () => {
            this._filter.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.AddDir, ""));
        };
        this._filter = new pathchangeprocessor_1.PathChangeProcessor(reset);
        reset();
        this._watcher.addListener("pathchanged", (e) => {
            /* istanbul ignore else */
            if (this._watcher != null) {
                this._filter.push(e);
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
     * are efficiently loaded.
     * @throws VError if start was not called.
     */
    sync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._watcher == null) {
                throw new verror_1.VError("Call start before sync.");
            }
            yield this._filter.process((event) => __awaiter(this, void 0, void 0, function* () {
                if (!this._syncInterruptionSemaphoreForTesting.tryAcquire()) {
                    /* istanbul ignore else */
                    if (this._syncInterruptionActionForTesting != null) {
                        yield this._syncInterruptionActionForTesting();
                    }
                    this._syncInterruptionSemaphoreForTesting.acquire();
                }
                this._syncInterruptionSemaphoreForTesting.release();
                const relativePath = event.path;
                const fullPath = pathutils.join(this._path, event.path);
                switch (event.eventType) {
                    case (pathchangeevent_1.PathEventType.Add):
                    case (pathchangeevent_1.PathEventType.Change): {
                        let filecontent = null;
                        try {
                            filecontent = yield fs.readFile(fullPath);
                        }
                        catch (err) {
                            logger.logWarn("[MemDir] Failed to read %s with err %s", fullPath, err);
                            return null;
                        }
                        return () => {
                            this._content.set(event.path, { path: relativePath, content: filecontent });
                        };
                    }
                    case (pathchangeevent_1.PathEventType.UnlinkDir):
                    case (pathchangeevent_1.PathEventType.Unlink):
                        return () => {
                            this._content.remove(event.path);
                        };
                    case (pathchangeevent_1.PathEventType.AddDir): {
                        let dircontent = null;
                        try {
                            dircontent = yield fs.readdir(fullPath);
                        }
                        catch (err) {
                            logger.logWarn("[MemDir] Failed to read dir %s with err %s", fullPath, err);
                            return null;
                        }
                        if (!this._syncInterruptionSemaphoreForTesting2.tryAcquire()) {
                            /* istanbul ignore else */
                            if (this._syncInterruptionActionForTesting2 != null) {
                                yield this._syncInterruptionActionForTesting2();
                            }
                            this._syncInterruptionSemaphoreForTesting2.acquire();
                        }
                        this._syncInterruptionSemaphoreForTesting2.release();
                        const newEvents = [];
                        for (const entry of dircontent) {
                            const entryFullPath = pathutils.join(fullPath, entry);
                            const entryRelativePath = pathutils.join(event.path, entry);
                            try {
                                const stat = yield fs.stat(entryFullPath);
                                if (stat.isDirectory()) {
                                    newEvents.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.AddDir, entryRelativePath));
                                }
                                else {
                                    newEvents.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.Add, entryRelativePath));
                                }
                            }
                            catch (err) {
                                logger.logWarn("[MemDir] Failed to stat file %s with err %s", fullPath, err);
                                return null;
                            }
                        }
                        return () => {
                            this._content.mkdir(relativePath);
                            for (const ev of newEvents) {
                                this._filter.push(ev);
                            }
                        };
                    }
                }
                /* istanbul ignore next */
                return null;
            }));
            return this._content;
        });
    }
}
exports.MemDir = MemDir;
//# sourceMappingURL=memdir.js.map