import * as pathutils from "path";
import { VError } from "verror";

import * as logger from "../utils/logger";
import timeout from "../utils/timeout";
import { PathChangeEvent, PathEventType } from "./pathchangeevent";
import { PathChangeQueue } from "./pathchangequeue";

/**
 * In case something goes wrong with the processing, this callback will be called.
 * Users of the processor should reset and process everything again.
 */
export type OnProcessingReset = () => void;

/**
 * Since a directory or file can change while it is being processed, the
 * processor handler method should return a callback that commits what is handled.
 * The callback will called only if nothing changed while the event is processed.
 */
export type ProcessCommitMethod = () => void;

export interface IFolder {
    folder: string;
}

export interface IFile {
    file: string;
}

export interface IPathChangeProcessorHandler {
    handleFileChanged(file: string): Promise<ProcessCommitMethod>;
    handleFileAdded(file: string): Promise<ProcessCommitMethod>;
    handleFileRemoved(file: string): Promise<ProcessCommitMethod>;
    handleFolderRemoved(folder: string): Promise<ProcessCommitMethod>;
    handleFolderAdded(folder: string): Promise<ProcessCommitMethod>;
    list(folder: string): Promise<string[]>;
    isDir(path: string): Promise<boolean>;
}

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
            logger.logInfo("[Processor] Handling event %s %s", evToProcess.eventType, evToProcess.path);
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
                logger.logInfo(
                    "[Processor] Event '%s:%s' processing error. Waiting 2500ms to see if it really failed...",
                    eventType, eventPath);
                await timeout(2500); // an error occurred, so wait a bit to see if it's a retry or obsolete.
            }

            if (stageHandler.didStagedEventChange()) {
                logger.logInfo("[Processor] Retrying event '%s:%s'", eventType, eventPath);
                continue;
            }

            if (stageHandler.isStagedEventObsolete()) {
                logger.logInfo("[Processor] Cancelled event '%s:%s'", eventType, eventPath);
                stageHandler.finishProcessingStagedEvent();

                return {
                    processed: true,
                };
            }

            if (handleResult == null) {
                logger.logError("[Processor] Processing of '%s:%s' failed.",
                    eventType, eventPath);
                stageHandler.finishProcessingStagedEvent();
                return {
                    processed: false,
                    error: "Processing failed, see log to understand what happened.",
                };
            }

            logger.logInfo("[Processor] Committing event '%s:%s'", eventType, eventPath);
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
