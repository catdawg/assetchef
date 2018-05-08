import * as fs from "fs";
import * as pathutils from "path";
import { VError } from "verror";

import { PathChangeEvent, PathEventComparisonEnum, PathEventType } from "./pathchangeevent";
import { PathTree } from "./pathtree";

/**
 * In case something goes wrong with the proceessing, this callback will be called.
 * Users of the processor should reset and process everything again.
 */
type OnProcessingReset = (error: string) => void;

/**
 * Processor instance that is used to hold the state of a path change processor.
 */
class Process  {
    private _currentEventBeingProcessed: PathChangeEvent;
    private _currentEventObsolete: boolean;
    private _currentEventChanged: boolean;
    private _stop: boolean;
    private _changeTree: PathTree<PathEventType>;

    constructor(changeTree: PathTree<PathEventType>) {
        this._currentEventBeingProcessed = null;
        this._currentEventObsolete = null;
        this._currentEventChanged = null;
        this._changeTree = changeTree;
    }

    public async process(
        handleEvent: (
            event: PathChangeEvent,
            obsoleteCheck: () => boolean,
            retryCheck: () => boolean,
        ) => Promise<void>,
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
                for (const path of this._changeTree.list(directory)) {
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
            this._currentEventObsolete = false;
            this._currentEventChanged = false;
            this._currentEventBeingProcessed = evToProcess;
            await handleEvent(
                this._currentEventBeingProcessed, () => this._currentEventObsolete, () => this._currentEventChanged,
            );
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
     * This is the most important method in this class. It allows the processing of pathchangeevents
     * while handling errors properly. For example, if the handleEvent method receives a AddDir event,
     * and while it is processing it, a new file is added to the directory being read. The retryCheck method would
     * start returning true, meaning that if the directory processing is halfway finished, it should be restarted.
     * If the directory is actually removed, then cancelCheck would start returning true and the processing should
     * clear and return.
     * @param handleEvent the processing method.
     */
    public async process(
        handleEvent: (
            event: PathChangeEvent,
            cancelCheck: () => boolean,
            retryCheck: () => boolean,
        ) => Promise<void>,
    ) {
        if (this._currentProcess != null) {
            throw new VError("Only one process at a time.");
        }

        this._currentProcess = new Process(this._changeTree);
        await this._currentProcess.process(handleEvent);
        this._currentProcess = null;
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
        let existingRelevantEvent: PathChangeEvent = null;
        const currentEventBeingProcessed =
            this._currentProcess != null ? this._currentProcess.getEventBeingProcessed() : null;

        if (currentEventBeingProcessed != null &&
            PathChangeEvent.areRelatedEvents(newEvent, currentEventBeingProcessed)) {
            existingRelevantEvent = currentEventBeingProcessed;
        } else {
            if (!this._changeTree.exists(newEvent.path)) {
                const tokens = newEvent.path.split(pathutils.sep);
                tokens.pop();

                while (tokens.length > 0) {
                    const parentPath = tokens.join(pathutils.sep);

                    if (this._changeTree.exists(parentPath)) {
                        if (!this._changeTree.isDir(parentPath)) {
                            existingRelevantEvent = new PathChangeEvent(this._changeTree.get(parentPath), parentPath);
                        }
                        break;
                    }

                    tokens.pop();
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
                this._resetWithError("Received event %s in path %s " +
                    "which is inconsistent with current state. Resetting processing.");
            }
        }

        if (existingRelevantEvent == null) {
            this._changeTree.set(newEvent.path, newEvent.eventType);
            return;
        }

        const compareResult = PathChangeEvent.compareEvents(existingRelevantEvent, newEvent);

        switch (compareResult) {
            case PathEventComparisonEnum.NewUpdatesOld:
                if (existingRelevantEvent === currentEventBeingProcessed) {
                    this._currentProcess.currentEventChanged();
                }
                break;
            case PathEventComparisonEnum.BothObsolete:
                if (existingRelevantEvent === currentEventBeingProcessed) {
                    this._currentProcess.currentEventIsObsolete();
                } else {
                    this._changeTree.remove(existingRelevantEvent.path);
                }
                break;
            case PathEventComparisonEnum.NewMakesOldObsolete:
                if (existingRelevantEvent === currentEventBeingProcessed) {
                    this._currentProcess.currentEventIsObsolete();
                } else {
                    this._changeTree.remove(existingRelevantEvent.path);
                }
                this._changeTree.set(newEvent.path, newEvent.eventType);
                break;
            case PathEventComparisonEnum.Inconsistent:
                this._resetWithError("Received event %s in path %s, " +
                    "but an event %s in path %s was already logged, which creates an incosistent state");
                break;
            /* istanbul ignore next */
            case PathEventComparisonEnum.Different:
                throw new VError("Incosistent state, old ev %s in path %s should be relevant " +
                    "to ev %s in path %s, but it's not",
                existingRelevantEvent.eventType, existingRelevantEvent.path, newEvent.eventType, newEvent.path);
        }
    }

    private _resetWithError(error: string): void {
        this.reset();
        this._resetCallback(error);
    }
}
