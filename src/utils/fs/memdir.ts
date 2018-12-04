import * as fs from "fs-extra";
import * as pathutils from "path";
import { VError } from "verror";

import { ILogger } from "../../plugin/ilogger";
import { PathEventType } from "../../plugin/ipathchangeevent";
import { IPathTreeReadonly } from "../../plugin/ipathtreereadonly";
import { IPathChangeProcessorHandler, PathChangeProcessingUtils, ProcessCommitMethod,
    } from "../path/pathchangeprocessingutils";
import { PathChangeQueue } from "../path/pathchangequeue";
import { PathTree } from "../path/pathtree";
import winstonlogger from "../winstonlogger";
import { DirWatcher } from "./dirwatcher";

/**
 * Syncing a directory into memory returns a @see PathTree that has this interface as items.
 */
export interface IMemDirFile {
    path: string;
    content: Buffer;
}

/**
 * This class allows you to efficiently keep a directory in memory.
 * Call start to listen to changes in a directory. When you're ready call sync and you will
 * get a @see PathTree that contains all the data in a directory. Note that in between sync calls,
 * the events in the directory will be tracked so that the sync does the minimum necessary.
 */
export class MemDir {
    public _syncActionForTestingBeforeFileRead: () => Promise<void>;
    public _syncActionForTestingBeforeDirRead: () => Promise<void>;
    public _syncActionForTestingBeforeStat: () => Promise<void>;
    public _syncActionMidProcessing: () => Promise<void>;

    public content: IPathTreeReadonly<Buffer>;

    private _actualContent: PathTree<IMemDirFile>;
    private _watcher: DirWatcher;
    private _queue: PathChangeQueue;
    private _path: string;
    private _logger: ILogger;

    /**
     * @param path The path you want to sync
     */
    constructor(path: string, logger: ILogger = winstonlogger) {
        if (path == null) {
            throw new VError("path is null");
        }

        this._logger = logger;

        this._actualContent = new PathTree<IMemDirFile>();
        this.content = {
            listenChanges: (cb) => this._actualContent.listenChanges(cb),
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
    public isOutOfSync(): boolean {
        return this._queue.hasChanges();
    }

    /**
     * Starts the watching mechanism on the directory to handle changes and sync efficiently.
     * @throws VError if start was already called before.
     */
    public start() {
        if (this._watcher != null)  {
            throw new VError("Call stop before start.");
        }
        this._watcher = new DirWatcher(this._path);

        const restartQueue = () => {
            this._queue.push({eventType: PathEventType.AddDir, path: ""});
        };

        this._queue = new PathChangeQueue(restartQueue);

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
    public stop(): void {
        if (this._watcher == null)  {
            throw new VError("Call start before stop.");
        }
        this._watcher.cancel();
        this._watcher = null;
    }

    /**
     * This method will make one syncing operation. It will dequeue one addition/change/removal in the filesystem
     * and process it. The @see MemDir.sync method calls this until it has nothing to do.
     * @returns Promise of a boolean that is true if succesful, false if an error occurred.
     * @throws VError if start was not called.
     */
    public async syncOne(): Promise<boolean> {
        if (this._watcher == null)  {
            throw new VError("Call start before sync.");
        }

        const fileAddedAndChangedHandler = async (path: string): Promise<ProcessCommitMethod> => {
            // used for testing readFile error
            if (this._syncActionForTestingBeforeFileRead != null) {
                const syncAction = this._syncActionForTestingBeforeFileRead;
                this._syncActionForTestingBeforeFileRead = null;
                await syncAction();
            }

            const fullPath = pathutils.join(this._path, path);

            let filecontent: Buffer = null;
            try {
                filecontent = await fs.readFile(fullPath);
            } catch (err) {
                this._logger.logWarn("[MemDir] Failed to read %s with err %s", fullPath, err);
                return null;
            }

            return () => {
                // usually an unlinkDir will come, but we put this here just in case
                /* istanbul ignore next */
                if (this._actualContent.exists(path) && this._actualContent.isDir(path)) {
                    this._actualContent.remove(path); // there was a dir before
                }
                this._actualContent.set(path, {path, content: filecontent});
            };
        };

        const pathRemovedHandler = async (path: string): Promise<ProcessCommitMethod> => {
            return () => {
                // unlinkDir can be handled before all the unlink events under it arrive.
                /* istanbul ignore next */
                if (this._actualContent.exists(path)) {
                    this._actualContent.remove(path);
                }
            };
        };

        const handler: IPathChangeProcessorHandler = {
            handleFileAdded: fileAddedAndChangedHandler,
            handleFileChanged: fileAddedAndChangedHandler,
            handleFileRemoved: pathRemovedHandler,
            handleFolderAdded: async (path): Promise<ProcessCommitMethod> => {
                return () => {
                    // usually an unlink will come, but we put this here just in case
                    /* istanbul ignore next */
                    if (this._actualContent.exists(path)) {
                        this._actualContent.remove(path); // was a file before.
                    }
                    this._actualContent.mkdir(path);
                };
            },
            handleFolderRemoved: pathRemovedHandler,
            isDir: async (path): Promise<boolean> => {
                /// used to test stat exception
                if (this._syncActionForTestingBeforeStat != null) {
                    const syncAction = this._syncActionForTestingBeforeStat;
                    this._syncActionForTestingBeforeStat = null;
                    await syncAction();
                }

                const fullPath = pathutils.join(this._path, path);
                try {
                    const stat = await fs.stat(fullPath);
                    return stat.isDirectory();
                } catch (err) {
                    this._logger.logWarn("[MemDir] Failed to stat file %s with err %s", fullPath, err);
                    return null;
                }
            },
            list: async (path): Promise<string[]> => {
                /// used to test readdir exception
                if (this._syncActionForTestingBeforeDirRead != null) {
                    const syncAction = this._syncActionForTestingBeforeDirRead;
                    this._syncActionForTestingBeforeDirRead = null;
                    await syncAction();
                }

                const fullPath = pathutils.join(this._path, path);
                try {
                    return await fs.readdir(fullPath);
                } catch (err) {
                    this._logger.logWarn("[MemDir] Failed to read dir %s with err %s", fullPath, err);
                    return null;
                }
            },
        };

        const processSuccessful = await PathChangeProcessingUtils.processOne(
            this._queue, handler, this._logger, this._syncActionMidProcessing);

        /* istanbul ignore next */
        if (!processSuccessful) {
            this._logger.logError("[MemDir] processing failed. Resetting...");
            this._queue.reset();
            return false;
        }

        return true;
    }

    /**
     * This method will look a directory and load everything there into memory.
     * The first time, everything gets loaded, but afterwards, only the changes that occurred
     * are efficiently loaded. The current state is in @see MemDir.content
     * @returns Promise that is true if successful, false if there was an error.
     * @throws VError if start was not called.
     */
    public async sync(): Promise<boolean> {
        if (this._watcher == null)  {
            throw new VError("Call start before sync.");
        }
        while (this.isOutOfSync()) {
            const res = await this.syncOne();
            /* istanbul ignore next */
            if (!res) {
                return false;
            }
        }

        return true;
    }
}
