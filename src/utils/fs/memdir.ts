
import { ChangeEmitter, createChangeEmitter } from "change-emitter";
import * as fs from "fs-extra";
import { Stats } from "fs-extra";
import * as pathutils from "path";
import { VError } from "verror";

import { IFSWatchListener } from "../../plugin/ifswatch";
import { ILogger } from "../../plugin/ilogger";
import { IPathChangeEvent, PathEventType } from "../../plugin/ipathchangeevent";
import { IPathTreeReadonly } from "../../plugin/ipathtreereadonly";
import addPrefixToLogger from "../addprefixtologger";
import { IPathChangeProcessorHandler, PathChangeProcessingUtils, ProcessCommitMethod,
    } from "../path/pathchangeprocessingutils";
import { PathChangeQueue } from "../path/pathchangequeue";
import { PathTree } from "../path/pathtree";

/**
 * This class allows you to efficiently keep a path in memory. Connect the watchListener to
 * a filesystem watching system that is pointing at the path passed in the constructor. Call start,
 * and then sync to put data into tree interface "content". Note that in between sync calls,
 * the events in the directory will be tracked so that the sync does the minimum necessary.
 */
export class MemDir {
    public _syncActionForTestingBeforeFileRead: () => Promise<void>;
    public _syncActionForTestingBeforeDirRead: () => Promise<void>;
    public _syncActionForTestingBeforeStat: () => Promise<void>;
    public _syncActionMidProcessing: () => Promise<void>;

    public content: IPathTreeReadonly<Buffer>;

    public watchListener: IFSWatchListener = {
        onEvent: (ev) => this.onFSWatchEvent(ev),
        onReset: /* istanbul ignore next */ () =>  {
            this.onFSWatchReset();
        },
    };

    private _collectingChanges: boolean;
    private _actualContent: PathTree<Buffer>;
    private _queue: PathChangeQueue;
    private _path: string;
    private _logger: ILogger;
    private _outofSyncEmitter: ChangeEmitter;
    private _processing: boolean = false;

    /**
     * @param path The path you want to sync
     * @param logger the logger instance to log into
     */
    constructor(path: string, logger: ILogger) {
        if (path == null) {
            throw new VError("path is null");
        }

        if (logger == null) {
            throw new VError("logger can't be null");
        }

        this._logger = logger;

        this._actualContent = new PathTree<Buffer>({allowRootAsFile: true});
        this.content = {
            listenChanges: (cb) => this._actualContent.listenChanges(cb),
            exists: (p) => this._actualContent.exists(p),
            get: (p) => this._actualContent.get(p),
            isDir: (p) => this._actualContent.isDir(p),
            list: (p) => this._actualContent.list(p),
            listAll: () => this._actualContent.listAll(),
        };
        this._path = path;
        this._outofSyncEmitter = createChangeEmitter();
        this._collectingChanges = false;
        this._queue = new PathChangeQueue(
            () => this.onFSWatchReset(), addPrefixToLogger(this._logger, "pathchangequeue: "));
    }

    /**
     * Register a callback that is called whenever there's something new to process.
     * @param cb the callback
     * @returns a token to unlisten, keep it around and call unlisten when you're done
     */
    public listenOutOfSync(cb: () => void): {unlisten: () => void} {
        return {unlisten: this._outofSyncEmitter.listen(cb)};
    }

    /**
     * Checks if any changes happened since the last sync.
     */
    public isOutOfSync(): boolean {
        return this._queue.hasChanges();
    }

    /**
     * Starts collecting changes dispatched into the watchListener. Allows calling sync/syncOne
     * @throws VError if start was already called before.
     */
    public start() {
        if (this._collectingChanges)  {
            throw new VError("Call stop before start.");
        }

        this._collectingChanges = true;
        this.onFSWatchReset();
    }

    /**
     * Stops the watching mechanism on the director.
     * @throws VError if stop was already called before or start was never called.
     */
    public stop(): void {
        if (!this._collectingChanges)  {
            throw new VError("Call start before stop.");
        }
        this._collectingChanges = false;
        this._queue.reset();
    }

    /**
     * Resets the processing, reading everything again from the Filesystem
     * @throws VError if reset is called without start first
     */
    public reset(): void {
        if (!this._collectingChanges)  {
            throw new VError("Call start before reset.");
        }

        this._queue.reset();
    }

    /**
     * This method will make one syncing operation. It will dequeue one addition/change/removal in the filesystem
     * and process it. The @see MemDir.sync method calls this until it has nothing to do.
     * @returns Promise of a boolean that is true if succesful, false if an error occurred.
     * @throws VError if start was not called.
     */
    public async syncOne(): Promise<boolean> {
        if (!this._collectingChanges)  {
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
                this._logger.logWarn("Failed to read %s with err %s", fullPath, err);
                return null;
            }

            return () => {
                // usually an unlinkDir will come, but we put this here just in case
                /* istanbul ignore next */
                if (this._actualContent.exists(path) && this._actualContent.isDir(path)) {
                    this._actualContent.remove(path); // there was a dir before
                }
                this._actualContent.set(path, filecontent);
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
                    this._logger.logWarn("Failed to stat file %s with err %s", fullPath, err);
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
                    this._logger.logWarn("Failed to read dir %s with err %s", fullPath, err);
                    return null;
                }
            },
        };

        this._processing = true;
        const processSuccessful = await PathChangeProcessingUtils.processOne(
            this._queue, handler, addPrefixToLogger(this._logger, "processor: "), this._syncActionMidProcessing);
        this._processing = false;

        /* istanbul ignore next */
        if (!processSuccessful) {
            this._logger.logError("processing failed. Resetting...");
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
        if (!this._collectingChanges)  {
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

    private onFSWatchEvent(ev: IPathChangeEvent) {
        if (!this._collectingChanges)  {
            return;
        }

        this._queue.push(ev);
        this.emitOutOfSync();
    }

    private onFSWatchReset() {
        if (!this._collectingChanges)  {
            return;
        }

        let rootStat: Stats = null;

        try {
            rootStat = fs.statSync(this._path);
        } catch (e) {
            rootStat = null;
        }

        if (rootStat == null) {
            if (this._actualContent.exists("")) {
                this._queue.push({eventType: PathEventType.UnlinkDir, path: ""});
                this.emitOutOfSync();
            }
        } else {
            if (rootStat.isDirectory()) {
                this._queue.push({eventType: PathEventType.AddDir, path: ""});
            } else {
                this._queue.push({eventType: PathEventType.UnlinkDir, path: ""});
            }
            this.emitOutOfSync();
        }
    }

    private emitOutOfSync() {
        // could be that event is redundant. Also can't call hasChanges if processing.
        if (!this._processing && this._queue.hasChanges()) {
            this._outofSyncEmitter.emit();
        }
    }
}
