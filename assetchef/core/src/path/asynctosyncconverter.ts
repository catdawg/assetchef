import { ChangeEmitter, createChangeEmitter } from "change-emitter";

import { addPrefixToLogger } from "../comm/addprefixtologger";
import { ILogger } from "../comm/ilogger";
import { IPathChangeEvent, PathEventType } from "./ipathchangeevent";
import { ICancelListen, IPathTreeAsyncRead } from "./ipathtreeasyncread";
import { IPathTreeRead } from "./ipathtreeread";
import { IPathTreeWrite } from "./ipathtreewrite";
import {
    IPathChangeProcessorHandler,
    PathChangeProcessingUtils,
    ProcessCommitMethod } from "./pathchangeprocessingutils";
import { PathChangeQueue } from "./pathchangequeue";
import { PathRelationship, PathUtils } from "./pathutils";

export type AsyncToSyncFilter = (path: string, partial: boolean) => boolean;

/**
 * This class provides a conversion of an Async tree api into a sync one.
 * The Async tree contents will be collected into a Sync API overtime with calls to
 * the update method.
 */
export class AsyncToSyncConverter<T> {
    private asyncPathTree: IPathTreeAsyncRead<T>;
    private syncPathTree: IPathTreeRead<T> & IPathTreeWrite<T>;

    private logger: ILogger;
    private isPathIncluded: AsyncToSyncFilter;
    private pathInAsync: string;

    private queue: PathChangeQueue;
    private cancelListen: ICancelListen;

    private needsUpdateEmitter: ChangeEmitter;

    constructor(
        logger: ILogger,
        asyncPathTree: IPathTreeAsyncRead<T>,
        syncPathTree: IPathTreeRead<T> & IPathTreeWrite<T>,
        pathInAsync: string,
        isPathIncluded: AsyncToSyncFilter = () => true) {
        this.asyncPathTree = asyncPathTree;
        this.pathInAsync = pathInAsync === "." ? "" : pathInAsync;
        this.syncPathTree = syncPathTree;
        this.needsUpdateEmitter = createChangeEmitter();
        this.logger = logger;
        this.isPathIncluded = isPathIncluded;

        this.cancelListen = asyncPathTree.listenChanges({
            onEvent: (ev: IPathChangeEvent) => {
                if (this.queue != null) {
                    switch (PathUtils.getPathRelationship(ev.path, this.pathInAsync)) {
                        case PathRelationship.Path1DirectlyInsidePath2:
                        case PathRelationship.Path1InsidePath2:
                        case PathRelationship.Equal:
                            this.queue.push(ev);
                            this.needsUpdateEmitter.emit();
                            break;
                    }
                }
            },
            onReset: () => {
                this.reset();
            },
        });
    }

    /**
     * Call this to stop the sync operation.
     */
    public cancel() {
        /* istanbul ignore else */
        if (this.cancelListen != null) {
            this.cancelListen.unlisten();
            this.cancelListen = null;
        }
    }

    /**
     * Resets the processing
     */
    public reset() {
        this.queue = null;
        this.needsUpdateEmitter.emit();
    }

    /**
     * Call to know if there are any changes to the wrapped async tree that need to be processed.
     */
    public needsUpdate(): boolean {
        return this.queue == null || this.queue.hasChanges();
    }

    /**
     * Register to listen for when needsUpdate becomes true
     * @param cb the callback
     */
    public listenToNeedsUpdate(cb: () => void): {cancel: () => void} {
        return {
            cancel: this.needsUpdateEmitter.listen(cb),
        };
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

            const pathWithoutPrefix = this.removePathPrefix(path);

            return () => {
                // usually an unlinkDir will come, but we put this here just in case
                /* istanbul ignore next */
                if (this.syncPathTree.exists(pathWithoutPrefix) && this.syncPathTree.isDir(pathWithoutPrefix)) {
                    this.syncPathTree.remove(pathWithoutPrefix); // there was a dir before
                }
                this.syncPathTree.set(pathWithoutPrefix, filecontent);
            };
        };

        const pathRemovedHandler = async (path: string): Promise<ProcessCommitMethod> => {
            const pathWithoutPrefix = this.removePathPrefix(path);

            return () => {
                // unlinkDir can be handled before all the unlink events under it arrive.
                /* istanbul ignore next */
                if (this.syncPathTree.exists(pathWithoutPrefix)) {
                    this.syncPathTree.remove(pathWithoutPrefix);
                }
            };
        };

        const handler: IPathChangeProcessorHandler = {
            handleFileAdded: fileAddedAndChangedHandler,
            handleFileChanged: fileAddedAndChangedHandler,
            handleFileRemoved: pathRemovedHandler,
            handleFolderAdded: async (path): Promise<ProcessCommitMethod> => {
                const pathWithoutPrefix = this.removePathPrefix(path);
                return () => {
                    if (!this.isPathIncluded(path, true)) {
                        return;
                    }
                    // usually an unlink will come, but we put this here just in case
                    /* istanbul ignore next */
                    if (this.syncPathTree.exists(pathWithoutPrefix)) {
                        this.syncPathTree.remove(pathWithoutPrefix); // was a file before.
                    }
                    this.syncPathTree.createFolder(pathWithoutPrefix);
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

    private async createQueue(): Promise<PathChangeQueue> {
        const queue = new PathChangeQueue(
            () => this.reset(), addPrefixToLogger(this.logger, "pathchangequeue: "));

        let rootStat = null;
        try {
            rootStat = await this.asyncPathTree.getInfo(this.pathInAsync);
        } catch (e) {
            // doesn't exist
        }

        if (rootStat == null) {
            if (this.syncPathTree.exists("")) {
                if (this.syncPathTree.isDir("")) {
                    queue.push({eventType: PathEventType.UnlinkDir, path: this.pathInAsync});
                } else {
                    queue.push({eventType: PathEventType.Unlink, path: this.pathInAsync});
                }
            }
        } else {
            if (this.syncPathTree.exists("")) {
                if (this.syncPathTree.isDir("")) {
                    queue.push({eventType: PathEventType.UnlinkDir, path: this.pathInAsync});
                } else {
                    queue.push({eventType: PathEventType.Unlink, path: this.pathInAsync});
                }
            }

            if (rootStat.isDirectory()) {
                    queue.push({eventType: PathEventType.AddDir, path: this.pathInAsync});
            } else {
                    queue.push({eventType: PathEventType.Add, path: this.pathInAsync});
            }
        }

        return queue;
    }

    private removePathPrefix(path: string): string {
        return path.substring(
            this.pathInAsync !== "." ? this.pathInAsync.length : 0);
    }
}
