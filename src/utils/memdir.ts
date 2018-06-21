import * as fs from "fs-extra";
import * as pathutils from "path";
import Semaphore from "semaphore-async-await";
import { VError } from "verror";

import { DirWatcher } from "./dirwatcher";
import * as logger from "./logger";
import { IPathTreeReadonly } from "./path/ipathtreereadonly";
import { PathChangeEvent, PathEventType} from "./path/pathchangeevent";
import { PathChangeProcessor, ProcessCommitMethod} from "./path/pathchangeprocessor";
import { PathTree } from "./path/pathtree";

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
    public _syncInterruptionSemaphoreForTesting: Semaphore;
    public _syncInterruptionActionForTesting: () => Promise<void>;

    public _syncInterruptionSemaphoreForTesting2: Semaphore;
    public _syncInterruptionActionForTesting2: () => Promise<void>;

    public content: IPathTreeReadonly<Buffer>;

    private _actualContent: PathTree<IMemDirFile>;
    private _watcher: DirWatcher;
    private _filter: PathChangeProcessor;
    private _path: string;

    /**
     * @param path The path you want to sync
     */
    constructor(path: string) {
        if (path == null) {
            throw new VError("path is null");
        }

        this._actualContent = new PathTree<IMemDirFile>();
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
        this._syncInterruptionSemaphoreForTesting = new Semaphore(1);
        this._syncInterruptionSemaphoreForTesting2 = new Semaphore(1);
    }

    /**
     * Checks if any changes happened since the last sync.
     */
    public isOutOfSync(): boolean {
        return this._filter.hasChanges();
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

        const reset = () => {
            this._filter.push(new PathChangeEvent(PathEventType.AddDir, ""));
        };

        this._filter = new PathChangeProcessor(reset);

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
    public stop(): void {
        if (this._watcher == null)  {
            throw new VError("Call start before stop.");
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
    public async sync(): Promise<void> {
        if (this._watcher == null)  {
            throw new VError("Call start before sync.");
        }
        await this._filter.process(async (
            event: PathChangeEvent): Promise<ProcessCommitMethod> => {

                if (!this._syncInterruptionSemaphoreForTesting.tryAcquire()) {
                    /* istanbul ignore else */
                    if (this._syncInterruptionActionForTesting != null) {
                        await this._syncInterruptionActionForTesting();
                    }
                    this._syncInterruptionSemaphoreForTesting.acquire();
                }
                this._syncInterruptionSemaphoreForTesting.release();

                const relativePath = event.path;
                const fullPath = pathutils.join(this._path, event.path);
                switch (event.eventType) {
                    case (PathEventType.Add):
                    case (PathEventType.Change): {
                        let filecontent: Buffer = null;
                        try {
                            filecontent = await fs.readFile(fullPath);
                        } catch (err) {
                            logger.logWarn("[MemDir] Failed to read %s with err %s", fullPath, err);
                            return null;
                        }

                        return () => {
                            this._actualContent.set(event.path, {path: relativePath, content: filecontent});
                        };
                    }
                    case (PathEventType.UnlinkDir):
                    case (PathEventType.Unlink):
                        return () => {
                            this._actualContent.remove(event.path);
                        };
                    case (PathEventType.AddDir): {

                        let dircontent: string[] = null;
                        try {
                            dircontent = await fs.readdir(fullPath);
                        } catch (err) {
                            logger.logWarn("[MemDir] Failed to read dir %s with err %s", fullPath, err);
                            return null;
                        }

                        if (!this._syncInterruptionSemaphoreForTesting2.tryAcquire()) {
                            /* istanbul ignore else */
                            if (this._syncInterruptionActionForTesting2 != null) {
                                await this._syncInterruptionActionForTesting2();
                            }
                            this._syncInterruptionSemaphoreForTesting2.acquire();
                        }
                        this._syncInterruptionSemaphoreForTesting2.release();

                        const newEvents: PathChangeEvent[] = [];
                        for (const entry of dircontent) {
                            const entryFullPath = pathutils.join(fullPath, entry);
                            const entryRelativePath = pathutils.join(event.path, entry);
                            try {
                                const stat = await fs.stat(entryFullPath);
                                if (stat.isDirectory()) {
                                    newEvents.push(new PathChangeEvent(PathEventType.AddDir, entryRelativePath));
                                } else {
                                    newEvents.push(
                                        new PathChangeEvent(PathEventType.Add, entryRelativePath));
                                }
                            } catch (err) {
                                logger.logWarn("[MemDir] Failed to stat file %s with err %s", fullPath, err);
                                return null;
                            }
                        }

                        return () => {
                            this._actualContent.mkdir(relativePath);
                            for (const ev of newEvents) {
                                this._filter.push(ev);
                            }
                        };
                    }
                }
                /* istanbul ignore next */
                return null;
        });
    }
}
