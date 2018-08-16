import * as pathutils from "path";
import { VError } from "verror";

import { PathChangeEvent, PathEventType } from "path/pathchangeevent";
import { PathChangeQueue } from "path/pathchangequeue";
import { logError, logInfo } from "utils/logger";
import { timeout } from "utils/timeout";

/**
 * Since a directory or file can change while it is being processed, the
 * processor handler method should return a callback that commits what is handled.
 * The callback will called only if nothing changed while the event is processed.
 */
export type ProcessCommitMethod = () => void;

/**
 * When processing, these methods will be called.
 */
export interface IPathChangeProcessorHandler {
    /**
     * Process the file change, e.g. read it from a tree and do something with it
     * @param file the file that changed
     */
    handleFileChanged(file: string): Promise<ProcessCommitMethod>;
    /**
     * Process the file added, e.g. read it from a tree and do something with it
     * @param file the file that was added
     */
    handleFileAdded(file: string): Promise<ProcessCommitMethod>;
    /**
     * Process the file removed, e.g. remove the result from it's previous addition
     * @param file the file that was removed
     */
    handleFileRemoved(file: string): Promise<ProcessCommitMethod>;
    /**
     * Process the folder removed, e.g. remove the result from all the files under it.
     * @param folder the folder that was removed.
     */
    handleFolderRemoved(folder: string): Promise<ProcessCommitMethod>;
    /**
     * Process the folder added. Don't read the contents though. List will be called after this, and
     * the contents will come in as events.
     * @param folder the folder that was added.
     */
    handleFolderAdded(folder: string): Promise<ProcessCommitMethod>;
    /**
     * list all paths in the folder.
     */
    list(folder: string): Promise<string[]>;
    /**
     * check if the path is a folder or file.
     */
    isDir(path: string): Promise<boolean>;
}

/**
 * the result of the processing. If error is not null, then there was an error.
 * If processed is false and error is null, there was nothing to do.
 */
export interface IProcessingResult {
    processed: boolean;
    error?: string;
}

/**
 * Processor instance that is used to hold the state of a path change processor.
 */
export class PathChangeProcessor  {
    public _debugActionAfterProcess: () => Promise<void>;
    private _queue: PathChangeQueue;

    constructor(queue: PathChangeQueue) {
        if (queue == null) {
            throw new VError("queue can't be null");
        }

        this._queue = queue;
    }

    /**
     * Process one event in the queue.
     * @param handler the process handler.
     */
    public async processOne(
        handler: IPathChangeProcessorHandler,
    ): Promise<IProcessingResult> {
        const evToProcess = this._queue.peek();

        if (evToProcess == null) {
            return {
                processed: false,
            };
        }

        const stageHandler = this._queue.stage(evToProcess);

        while (true) {
            logInfo("[Processor] Handling event %s %s", evToProcess.eventType, evToProcess.path);
            let handleResult: ProcessCommitMethod;

            const eventType = evToProcess.eventType;
            const eventPath = evToProcess.path;

            let newEvents: PathChangeEvent[] = null;

            switch (eventType) {
                case (PathEventType.Add):
                    handleResult = await handler.handleFileAdded(eventPath);
                    break;
                case (PathEventType.Change):
                    handleResult = await handler.handleFileChanged(eventPath);
                    break;
                case (PathEventType.Unlink):
                    handleResult = await handler.handleFileRemoved(eventPath);
                    break;
                case (PathEventType.UnlinkDir):
                    handleResult = await handler.handleFolderRemoved(eventPath);
                    break;
                case (PathEventType.AddDir):
                    handleResult = await handler.handleFolderAdded(eventPath);
                    newEvents = [];
                    const list = await handler.list(eventPath);
                    if (list == null) {
                        handleResult = null; // error occurred
                    } else {
                        for (const p of list) {
                            const path = pathutils.join(eventPath, p);
                            const isdir = await handler.isDir(path);
                            if (isdir == null) {
                                handleResult = null; // error occurred
                                break;
                            } else if (isdir) {
                                newEvents.push(new PathChangeEvent(PathEventType.AddDir, path));
                            } else {
                                newEvents.push(new PathChangeEvent(PathEventType.Add, path));
                            }
                        }
                    }
                    break;
            }

            if (this._debugActionAfterProcess != null) {
                const debugAction = this._debugActionAfterProcess;
                this._debugActionAfterProcess = null;
                await debugAction();
            }

            if (handleResult == null) {
                logInfo(
                    "[Processor] Event '%s:%s' processing error. Waiting 2500ms to see if it really failed...",
                    eventType, eventPath);
                await timeout(2500); // an error occurred, so wait a bit to see if it's a retry or obsolete.
            }

            if (stageHandler.didStagedEventChange()) {
                logInfo("[Processor] Retrying event '%s:%s'", eventType, eventPath);
                continue;
            }

            if (stageHandler.isStagedEventObsolete()) {
                logInfo("[Processor] Cancelled event '%s:%s'", eventType, eventPath);
                stageHandler.finishProcessingStagedEvent();

                return {
                    processed: true,
                };
            }

            if (handleResult == null) {
                logError("[Processor] Processing of '%s:%s' failed.",
                    eventType, eventPath);
                stageHandler.finishProcessingStagedEvent();
                return {
                    processed: false,
                    error: "Processing failed, see log to understand what happened.",
                };
            }

            logInfo("[Processor] Committing event '%s:%s'", eventType, eventPath);
            stageHandler.finishProcessingStagedEvent();
            handleResult();
            if (newEvents != null) {
                for (const ev of newEvents) {
                    this._queue.push(ev);
                }
            }

            return {
                processed: true,
            };
        }
    }

    /**
     * Process events on the queue until it is empty.
     * @param handler the process handler.
     */
    public async processAll(
        handler: IPathChangeProcessorHandler,
    ) {
        let res: IProcessingResult;
        while ((res = await this.processOne(handler)).processed) {
            continue;
        }
        return res;
    }
}
