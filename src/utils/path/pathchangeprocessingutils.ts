import * as pathutils from "path";
import { VError } from "verror";

import { ILogger } from "../../plugin/ilogger";
import { IPathChangeEvent, PathEventType } from "../../plugin/ipathchangeevent";
import { timeout } from "../timeout";
import { PathChangeQueue } from "./pathchangequeue";

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

export abstract class PathChangeProcessingUtils {
    /**
     * Process one event in the queue.
     * @param queue the queue
     * @param handler the handler for processing the event
     * @param logger dependency injection of the logger, defaults to using the winston library
     * @param _debugActionAfterProcess debug function for unit tests
     * @returns Promise that is true if successful, or false if there is an error.
     */
    public static async processOne(
        queue: PathChangeQueue,
        handler: IPathChangeProcessorHandler,
        logger: ILogger,
        _debugActionAfterProcess: () => void = () => {return; },

    ): Promise<boolean> {

        if (queue == null) {
            throw new VError("queue can't be null");
        }

        if (handler == null) {
            throw new VError("handler can't be null");
        }

        if (logger == null) {
            throw new VError("logger can't be null");
        }

        if (_debugActionAfterProcess == null) {
            throw new VError("debugaction can't be null");
        }

        const evToProcess = queue.peek();

        if (evToProcess == null) {
            return true;
        }

        const stageHandler = queue.stage(evToProcess);

        while (true) {
            logger.logInfo("Handling event %s %s", evToProcess.eventType, evToProcess.path);
            let handleResult: ProcessCommitMethod;

            const eventType = evToProcess.eventType;
            const eventPath = evToProcess.path;

            let newEvents: IPathChangeEvent[] = null;

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
                                newEvents.push({eventType: PathEventType.AddDir, path});
                            } else {
                                newEvents.push({eventType: PathEventType.Add, path});
                            }
                        }
                    }
                    break;
            }

            await _debugActionAfterProcess();

            if (handleResult == null) {
                logger.logInfo(
                    "Event '%s:%s' processing error. Waiting 2500ms to see if it really failed...",
                    eventType, eventPath);
                await timeout(2500); // an error occurred, so wait a bit to see if it's a retry or obsolete.
            }

            if (stageHandler.didStagedEventChange()) {
                logger.logInfo("Retrying event '%s:%s'", eventType, eventPath);
                continue;
            }

            if (stageHandler.isStagedEventObsolete()) {
                logger.logInfo("Cancelled event '%s:%s'", eventType, eventPath);
                stageHandler.finishProcessingStagedEvent();

                return true;
            }

            if (handleResult == null) {
                logger.logError("Processing of '%s:%s' failed.",
                    eventType, eventPath);
                stageHandler.finishProcessingStagedEvent();
                return false;
            }

            logger.logInfo("Committing event '%s:%s'", eventType, eventPath);
            stageHandler.finishProcessingStagedEvent();
            handleResult();
            if (newEvents != null) {
                for (const ev of newEvents) {
                    queue.push(ev);
                }
            }

            return true;
        }
    }

    /**
     * Process all events. Calls processOne until there is nothing left.
     * @param queue the queue
     * @param handler the handler for processing
     * @param logger dependency injection of the logging, defaults to winston library
     * @returns Promise that is true if successful, false if there is an error.
     */
    public static async processAll(
        queue: PathChangeQueue,
        handler: IPathChangeProcessorHandler,
        logger: ILogger,
    ): Promise<boolean> {

        if (queue == null) {
            throw new VError("queue can't be null");
        }

        while (queue.hasChanges()) {
            const res = await this.processOne(queue, handler, logger);
            if (!res) {
                return false;
            }
        }
        return true;
    }
}
