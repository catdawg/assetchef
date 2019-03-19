import { addPrefixToLogger } from "../comm/addprefixtologger";
import { ILogger } from "../comm/ilogger";
import { IPathChangeEvent, PathEventType } from "./ipathchangeevent";
import { IPathTreeAsyncReadonly } from "./ipathtreeasyncreadonly";
import { IPathTreeReadonly } from "./ipathtreereadonly";
import {
    IPathChangeProcessorHandler,
    PathChangeProcessingUtils,
    ProcessCommitMethod } from "./pathchangeprocessingutils";
import { PathChangeQueue } from "./pathchangequeue";
import { PathTree } from "./pathtree";

export type AsyncToSyncPathTreeFilter = (path: string, partial: boolean) => boolean;

/**
 * This class provides a conversion of an Async tree api into a sync one.
 * The Async tree contents will be collected into a Sync API overtime with calls to
 * the update method.
 */
export class AsyncToSyncPathTree<T> implements IPathTreeReadonly<T> {
    private asyncPathTree: IPathTreeAsyncReadonly<T>;
    private syncPathTree: PathTree<T>;

    private logger: ILogger;
    private isPathIncluded: AsyncToSyncPathTreeFilter;

    private queue: PathChangeQueue;

    constructor(
        logger: ILogger,
        asyncPathTree: IPathTreeAsyncReadonly<T>,
        isPathIncluded: AsyncToSyncPathTreeFilter = () => true) {
        this.asyncPathTree = asyncPathTree;
        this.syncPathTree = new PathTree<T>();
        this.logger = logger;
        this.isPathIncluded = isPathIncluded;
    }

    /**
     * Call to know if there are any changes to the wrapped async tree that need to be processed.
     */
    public needsUpdate(): boolean {
        return this.queue == null || this.queue.hasChanges();
    }

    /**
     * Process one change in the async tree into the sync tree.
     */
    public async update(): Promise<void> {
        let queue = this.queue;
        if (queue == null) {
            queue = await this.createQueue();
            this.queue = queue;
        }

        this.logger.logInfo("update started");

        const fileAddedAndChangedHandler = async (path: string): Promise<ProcessCommitMethod> => {
            if (!this.isPathIncluded(path, false)) {
                return () => {
                    return;
                };
            }

            let filecontent: T = null;
            try {
                filecontent = await this.asyncPathTree.get(path);
            } catch (err) {
                this.logger.logWarn("Failed to read %s with err %s", path, err);
                return null;
            }

            return () => {
                // usually an unlinkDir will come, but we put this here just in case
                /* istanbul ignore next */
                if (this.syncPathTree.exists(path) && this.syncPathTree.isDir(path)) {
                    this.syncPathTree.remove(path); // there was a dir before
                }
                this.syncPathTree.set(path, filecontent);
            };
        };

        const pathRemovedHandler = async (path: string): Promise<ProcessCommitMethod> => {
            return () => {
                // unlinkDir can be handled before all the unlink events under it arrive.
                /* istanbul ignore next */
                if (this.syncPathTree.exists(path)) {
                    this.syncPathTree.remove(path);
                }
            };
        };

        const handler: IPathChangeProcessorHandler = {
            handleFileAdded: fileAddedAndChangedHandler,
            handleFileChanged: fileAddedAndChangedHandler,
            handleFileRemoved: pathRemovedHandler,
            handleFolderAdded: async (path): Promise<ProcessCommitMethod> => {
                return () => {
                    if (!this.isPathIncluded(path, true)) {
                        return;
                    }
                    // usually an unlink will come, but we put this here just in case
                    /* istanbul ignore next */
                    if (this.syncPathTree.exists(path)) {
                        this.syncPathTree.remove(path); // was a file before.
                    }
                    this.syncPathTree.createFolder(path);
                };
            },
            handleFolderRemoved: pathRemovedHandler,
            isDir: async (path): Promise<boolean> => {
                try {
                    const stat = await this.asyncPathTree.getInfo(path);
                    return stat.isDirectory();
                } catch (err) {
                    this.logger.logWarn("Failed to stat file %s with err %s", path, err);
                    return null;
                }
            },
            list: async (path): Promise<string[]> => {
                if (!this.isPathIncluded(path, true)) {
                    return [];
                }

                try {
                    return await this.asyncPathTree.list(path);
                } catch (err) {
                    this.logger.logWarn("Failed to read dir %s with err %s", path, err);
                    return null;
                }
            },
        };

        const processSuccessful = await PathChangeProcessingUtils.processOne(
            queue, handler, addPrefixToLogger(this.logger, "processor: "), this.asyncPathTree.delayMs);

        /* istanbul ignore next */
        if (!processSuccessful) {
            this.logger.logError("processing failed. Resetting...");
            queue.reset();
            return;
        }

        this.logger.logInfo("update finished");

    }

    /**
     * Add an event that happened in the async tree to be processed.
     * @param ev the event
     */
    public pushPathChangeEvent(ev: IPathChangeEvent) {
        if (this.queue != null) {
            this.queue.push(ev);
        }
    }

    /**
     * Resets the processing, processing everything again.
     * @param ev the event
     */
    public resetEventProcessing() {
        this.queue = null;
    }

    /**
     * Part of the IPathTreeReadonly API
     * @param cb
     */
    public listenChanges(cb: (ev: IPathChangeEvent) => void): { unlisten: () => void; } {
        return this.syncPathTree.listenChanges(cb);
    }

    /**
     * Part of the IPathTreeReadonly API
     * @param cb
     */
    public list(path: string): IterableIterator<string> {
        return this.syncPathTree.list(path);
    }

    /**
     * Part of the IPathTreeReadonly API
     * @param cb
     */
    public listAll(): IterableIterator<string> {
        return this.syncPathTree.listAll();
    }

    /**
     * Part of the IPathTreeReadonly API
     * @param cb
     */
    public isDir(path: string): boolean {
        return this.syncPathTree.isDir(path);
    }

    /**
     * Part of the IPathTreeReadonly API
     * @param cb
     */
    public exists(path: string): boolean {
        return this.syncPathTree.exists(path);
    }

    /**
     * Part of the IPathTreeReadonly API
     * @param cb
     */
    public get(path: string): T {
        return this.syncPathTree.get(path);
    }

    private async createQueue(): Promise<PathChangeQueue> {
        const queue = new PathChangeQueue(
            () => this.queue = null, addPrefixToLogger(this.logger, "pathchangequeue: "));

        let rootStat = null;
        try {
            rootStat = await this.asyncPathTree.getInfo("");
        } catch (e) {
            // doesn't exist
        }

        if (rootStat == null) {
            if (this.syncPathTree.exists("")) {
                if (this.syncPathTree.isDir("")) {
                    queue.push({eventType: PathEventType.UnlinkDir, path: ""});
                } else {
                    queue.push({eventType: PathEventType.Unlink, path: ""});
                }
            }
        } else {
            if (this.syncPathTree.exists("")) {
                if (this.syncPathTree.isDir("")) {
                    queue.push({eventType: PathEventType.UnlinkDir, path: ""});
                } else {
                    queue.push({eventType: PathEventType.Unlink, path: ""});
                }
            }

            if (rootStat.isDirectory()) {
                    queue.push({eventType: PathEventType.AddDir, path: ""});
            } else {
                    queue.push({eventType: PathEventType.Add, path: ""});
            }
        }

        return queue;
    }
}
