import * as fs from "fs";
import * as pathutils from "path";
import { VError } from "verror";

import * as logger from "../logger";
import timeout from "../timeout";
import { PathChangeEvent, PathEventComparisonEnum, PathEventType } from "./pathchangeevent";
import { PathTree } from "./pathtree";

/**
 * In case something goes wrong with the proceessing, this callback will be called.
 * Users of the processor should reset and process everything again.
 */
export type OnProcessingReset = () => void;

export type ProcessCommitMethod = () => void;

/**
 * Processor instance that is used to hold the state of a path change processor.
 */
class Process  {
    private _currentEventBeingProcessed: PathChangeEvent;
    private _currentEventObsolete: boolean;
    private _currentEventChanged: boolean;
    private _resetMethod: () => void;
    private _stop: boolean;
    private _changeTree: PathTree<PathEventType>;

    constructor(changeTree: PathTree<PathEventType>, resetMethod: () => void) {
        this._currentEventBeingProcessed = null;
        this._currentEventObsolete = null;
        this._currentEventChanged = null;
        this._changeTree = changeTree;
        this._resetMethod = resetMethod;
    }

    public async process(
        handleEvent: (
            event: PathChangeEvent,
        ) => Promise<ProcessCommitMethod>,
    ) {
        let evToProcess: PathChangeEvent;

        const popEvent = (): PathChangeEvent => {
            if (!this._changeTree.exists("")) {
                return null;
            }

            if (!this._changeTree.isDir("")) {
                const evType = this._changeTree.get("");
                this._changeTree.remove("");
                return new PathChangeEvent(evType, "");
            }

            const directoriesToVisit: string[] = [""];
            while (directoriesToVisit.length !== 0) {
                const directory = directoriesToVisit.pop();
                for (const entry of this._changeTree.list(directory)) {
                    const path = pathutils.join(directory, entry);
                    if (!this._changeTree.isDir(path)) {
                        const evType = this._changeTree.get(path);
                        this._changeTree.remove(path);
                        return new PathChangeEvent(evType, path);
                    } else {
                        directoriesToVisit.push(path);
                    }
                }
            }
            return null;
        };

        while (!this._stop && (evToProcess = popEvent()) != null) {
            while (true) {
                this._currentEventObsolete = false;
                this._currentEventChanged = false;
                this._currentEventBeingProcessed = evToProcess;
                logger.logInfo("[Processor] Handling event %s %s", evToProcess.eventType, evToProcess.path);
                const commitMethod = await handleEvent(this._currentEventBeingProcessed);

                if (commitMethod == null) {
                    logger.logInfo(
                        "[Processor] Event '%s:%s' processing error. Waiting 2500ms to see if it needs a reset...",
                        evToProcess.eventType, evToProcess.path);
                    await timeout(2500); // an error occurred, so wait a bit to see if it's a retry or obsolete.
                }

                if (this._currentEventChanged) {
                    logger.logInfo("[Processor] Retrying event '%s:%s'", evToProcess.eventType, evToProcess.path);
                    continue;
                }

                if (this._currentEventObsolete) {
                    logger.logInfo("[Processor] Cancelled event '%s:%s'", evToProcess.eventType, evToProcess.path);
                    break;
                }

                if (commitMethod == null) {
                    logger.logWarn("[Processor] Processing of '%s:%s' failure confirmed, resetting processor.",
                        evToProcess.eventType, evToProcess.path);
                    this._resetMethod();
                    return;
                }
                this._currentEventBeingProcessed = null;

                logger.logInfo("[Processor] Committing event '%s:%s'", evToProcess.eventType, evToProcess.path);
                commitMethod();
                break;
            }
        }
    }

    public getEventBeingProcessed(): PathChangeEvent {
        return this._currentEventBeingProcessed;
    }

    public currentEventChanged() {
        this._currentEventChanged = true;
    }

    public currentEventIsObsolete() {
        this._currentEventObsolete = true;
    }

    public stop() {
        this._stop = true;
    }
}

/**
 * This class receives directory event changes and smartly filters out events that are duplicates.
 * The process method allows the asynchronous handling of those events while recovering from errors.
 * Errors are for example if you're processing a directory that gets deleted.
 */
export class PathChangeProcessor {

    private _resetCallback: OnProcessingReset;
    private _changeTree: PathTree<PathEventType>;
    private _currentProcess: Process;

    constructor(resetCallback: OnProcessingReset) {
        if (resetCallback == null) {
            throw new VError("Callback can't be null");
        }

        this._changeTree = new PathTree<PathEventType>();
        this._resetCallback = resetCallback;
    }

    /**
     * This is the most important method in this class. It allows the processing of PathChangeEvents
     * The handling of each PathChangeEvent results in a method that committs that handling.
     * The processor will then determine to commit or not depending on what happened in the mean time,
     * for example, while handling a AddDir event, the directory could have changed, so the handling should be retried.
     * Another example is that while handling an Add event, the containing folder could have been removed.
     * On an error, the handle method should return null, and if the event being handled was not made obsolete, then
     * the system will reset since this is an error state.
     * @param handleEvent the processing method.
     */
    public async process(
        handleEvent: (
            event: PathChangeEvent,
        ) => Promise<ProcessCommitMethod>,
    ) {
        if (this._currentProcess != null) {
            throw new VError("Only one process at a time.");
        }

        this._currentProcess = new Process(this._changeTree, () => {
            this._resetWithCallback();
        });
        await this._currentProcess.process(handleEvent);
        this._currentProcess = null;
    }

    /**
     * Checks if there is something to process.
     */
    public hasChanges(): boolean {
        for (const path of this._changeTree.listAll()) {
            if (!this._changeTree.isDir(path)) {
                return true;
            }
        }

        return false;
    }

    /**
     * reset the processing.
     */
    public reset(): void {
        this._changeTree = new PathTree<PathEventType>();
        if (this._currentProcess != null) {
            this._currentProcess.stop();
            this._currentProcess = null;
        }
    }

    /**
     * Pushes into the queue a change. This function uses the PathChangeEvent.compareEvents method to filter the event.
     * If a process is current in progress, it will also notify the processor if the current event being processed
     * is affected by the new event.
     * @param {PathChangeEvent} event the event to push
     * @returns {void}
     */
    public push(newEvent: PathChangeEvent): void {
        logger.logInfo("[Processor:Push] New event '%s:%s'...", newEvent.eventType, newEvent.path);

        let existingRelevantEvent: PathChangeEvent = null;
        const currentEventBeingProcessed =
            this._currentProcess != null ? this._currentProcess.getEventBeingProcessed() : null;

        if (currentEventBeingProcessed != null &&
            PathChangeEvent.areRelatedEvents(newEvent, currentEventBeingProcessed)) {
            existingRelevantEvent = currentEventBeingProcessed;
        } else {
            if (!this._changeTree.exists(newEvent.path)) {
                if (this._changeTree.exists("")) {
                    if (!this._changeTree.isDir("")) {
                        existingRelevantEvent = new PathChangeEvent(this._changeTree.get(""), "");
                    } else {
                        const tokens = newEvent.path.split(pathutils.sep);
                        tokens.pop();
                        if (tokens.length !== 0) {
                            while (tokens.length > 0) {
                                const parentPath = tokens.join(pathutils.sep);

                                if (this._changeTree.exists(parentPath)) {
                                    if (!this._changeTree.isDir(parentPath)) {
                                        existingRelevantEvent =
                                            new PathChangeEvent(this._changeTree.get(parentPath), parentPath);
                                    }
                                    break;
                                }

                                tokens.pop();
                            }
                        }
                    }
                }
            } else { // path exists

                if (!this._changeTree.isDir(newEvent.path)) {
                    existingRelevantEvent = new PathChangeEvent(this._changeTree.get(newEvent.path), newEvent.path);
                }
            }
        }

        if (this._changeTree.exists(newEvent.path) && this._changeTree.isDir(newEvent.path)) {
            if (newEvent.eventType === PathEventType.AddDir || newEvent.eventType === PathEventType.UnlinkDir) {
                this._changeTree.remove(newEvent.path);
            } else {
                logger.logWarn(
                    "[Processor:Push] '%s:%s' Was a file and this is a directory event. Inconsistent state! Resetting.",
                    newEvent.eventType, newEvent.path);
                this._resetWithCallback();
                return;
            }
        }

        if (existingRelevantEvent == null) {
            logger.logInfo("[Processor:Push] ... queued.");
            this._changeTree.set(newEvent.path, newEvent.eventType);
            return;
        }

        const compareResult = PathChangeEvent.compareEvents(existingRelevantEvent, newEvent);

        if (existingRelevantEvent === currentEventBeingProcessed) {
            logger.logInfo(
                "[Processor:Push] ... currently processed event is relevant: '%s:%s' with relationship: %s ...",
                existingRelevantEvent.eventType, existingRelevantEvent.path,
                compareResult);
        } else {
            logger.logInfo(
                "[Processor:Push] ... has existing relevant event: '%s:%s' with relationship: %s ...",
                existingRelevantEvent.eventType, existingRelevantEvent.path,
                compareResult);
        }

        switch (compareResult) {
            case PathEventComparisonEnum.NewUpdatesOld:
                if (existingRelevantEvent === currentEventBeingProcessed) {
                    logger.logInfo("[Processor:Push] ... Retry on currently processed event!");
                    this._currentProcess.currentEventChanged();
                } else {
                    logger.logInfo("[Processor:Push] ... Ignored!");
                }
                break;
            case PathEventComparisonEnum.BothObsolete:
                if (existingRelevantEvent === currentEventBeingProcessed) {
                    logger.logInfo(
                        "[Processor:Push] ... Abort on currently processed event!",
                    );
                    this._currentProcess.currentEventIsObsolete();
                } else {
                    logger.logInfo(
                        "[Processor:Push] ... Ignored and relevant event is also removed!",
                    );
                    this._changeTree.remove(existingRelevantEvent.path);
                }
                break;
            case PathEventComparisonEnum.NewMakesOldObsolete:
                if (existingRelevantEvent === currentEventBeingProcessed) {
                    logger.logInfo(
                        "[Processor:Push] ... Queued! With abort on currently processed event!",
                    );
                    this._currentProcess.currentEventIsObsolete();
                } else {
                    logger.logInfo("[Processor:Push] ... Queued! Removing existing relevant event");
                    this._changeTree.remove(existingRelevantEvent.path);
                }
                this._changeTree.set(newEvent.path, newEvent.eventType);
                break;
            case PathEventComparisonEnum.Inconsistent:
                logger.logWarn("[Processor:Push] ... Inconsistent state! Triggering reset!" +
                    "Received '%s:%s' and had '%s:%s'.",
                    newEvent.eventType, newEvent.path,
                    existingRelevantEvent.eventType, existingRelevantEvent.path,
                );
                this._resetWithCallback();
                break;
            /* istanbul ignore next */
            case PathEventComparisonEnum.Different:
                throw new VError("Incosistent state, old ev %s in path %s should be relevant " +
                    "to ev %s in path %s, but it's not",
                existingRelevantEvent.eventType, existingRelevantEvent.path, newEvent.eventType, newEvent.path);
        }
    }

    private _resetWithCallback(): void {
        this.reset();
        this._resetCallback();
    }
}
