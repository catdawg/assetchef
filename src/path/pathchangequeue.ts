import * as pathutils from "path";
import { VError } from "verror";

import { PathChangeEvent, PathEventComparisonEnum, PathEventType } from "path/pathchangeevent";
import { PathTree } from "path/pathtree";
import { logInfo, logWarn } from "utils/logger";

interface IChangeTreeNode {
    ev: PathChangeEvent;
    time: number;
}

/**
 * In case something goes wrong with the processing, this callback will be called.
 * Users of the processor should reset and process everything again.
 */
export type OnQueueReset = () => void;

/**
 * When staging something, this is the interface to know if
 * the event staged is obsolete, should be retried, or finally
 * to confirm the ending of the processing.
 */
export interface IStageHandler {
    isStagedEventObsolete(): boolean;
    didStagedEventChange(): boolean;
    finishProcessingStagedEvent(): void;
}

/**
 * This class receives path event changes and smartly filters out events that are duplicates,
 * or cleans up obsolete events. For example, if we have a events under a specific directory,
 * if that directory is removed, the events under it are also removed.
 */
export class PathChangeQueue {
    private _resetCallback: OnQueueReset;
    private _changeTree: PathTree<IChangeTreeNode>;

    private _currentlyStaged: IChangeTreeNode;
    private _currentlyStagedIsObsolete: boolean;
    private _currentlyStagedChanged: boolean;

    constructor(resetCallback: OnQueueReset) {
        if (resetCallback == null) {
            throw new VError("Callback can't be null");
        }

        this._changeTree = new PathTree<IChangeTreeNode>();
        this._resetCallback = resetCallback;
    }

    public stage(event: PathChangeEvent): IStageHandler {
        if (this._currentlyStaged != null) {
            throw new VError("must finish processing the previously staged event.");
        }

        if (event == null) {
            throw new VError("event can't be null.");
        }

        if (!this._changeTree.exists(event.path) ||
            this._changeTree.isDir(event.path) ||
            this._changeTree.get(event.path).ev.eventType !== event.eventType) {
            throw new VError(
                "attempted to stage event that wasn't on the queue, or was different.");
        }

        this._currentlyStaged = this._changeTree.get(event.path);
        this._changeTree.remove(event.path);
        this._currentlyStagedIsObsolete = false;
        this._currentlyStagedChanged = false;

        return {
            didStagedEventChange: () => {
                const state = this._currentlyStagedChanged;
                this._currentlyStagedChanged = false;
                return state;
            },
            isStagedEventObsolete: () => this._currentlyStagedIsObsolete,
            finishProcessingStagedEvent: () => {

                if (Date.now() - this._currentlyStaged.time < 2000) {
                    logWarn("[PathChangeQueue:Stage] Event '%s:%s' was processed too fast.",
                        this._currentlyStaged.ev.eventType,
                        this._currentlyStaged.ev.path,
                    );
                }
                this._currentlyStaged = null;
                this._currentlyStagedIsObsolete = false;
                this._currentlyStagedChanged = false;
            },
        };
    }

    /**
     * Checks if there is something to process.
     */
    public hasChanges(): boolean {
        if (this._currentlyStaged != null) {
            throw new VError("While staging an event, this method is not usable.");
        }
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
        this._changeTree = new PathTree<IChangeTreeNode>();

        if (this._currentlyStaged != null) {
            this._currentlyStagedIsObsolete = true;
        }

        this._resetCallback();
    }

    /**
     * Get an event from the queue. This will return the oldest event on the queue.
     */
    public peek(): PathChangeEvent {
        if (this._currentlyStaged != null) {
            throw new VError("While staging an event, this method is not usable.");
        }

        let oldestNode: IChangeTreeNode = null;

        for (const p of this._changeTree.listAll()) {
            if (this._changeTree.isDir(p)) {
                continue;
            }
            const node = this._changeTree.get(p);
            if (oldestNode == null || node.time > oldestNode.time) {
                oldestNode = node;
            }
        }

        return oldestNode != null ? oldestNode.ev : null;
    }

    /**
     * List all of the events in the queue.
     * Not working when an event is currently staged.
     */
    public *listAll(): IterableIterator<PathChangeEvent> {
        const checkForStaging = () => {
            if (this._currentlyStaged != null) {
                throw new VError("While staging an event, this method is not usable.");
            }
        };

        checkForStaging();
        for (const p of this._changeTree.listAll()) {
            if (!this._changeTree.isDir(p)) {
                yield this._changeTree.get(p).ev;
                checkForStaging();
            }
        }
    }

    /**
     * Pushes into the queue a change. This function uses the PathChangeEvent.compareEvents method to filter the event.
     * If an event is staged, it will also notify the stager if the current event being staged
     * is affected by the new event.
     * @param {PathChangeEvent} event the event to push
     * @returns {void}
     */
    public push(newEvent: PathChangeEvent): void {
        logInfo("[PathChangeQueue:Push] New event '%s:%s'...", newEvent.eventType, newEvent.path);

        let existingRelevantNode: IChangeTreeNode = null;

        if (this._currentlyStaged != null &&
            PathChangeEvent.areRelatedEvents(newEvent, this._currentlyStaged.ev)) {
            existingRelevantNode = this._currentlyStaged;
        } else {
            if (!this._changeTree.exists(newEvent.path)) {
                if (this._changeTree.exists("")) {
                    if (!this._changeTree.isDir("")) {
                        existingRelevantNode = this._changeTree.get("");
                    } else {
                        const tokens = newEvent.path.split(pathutils.sep);
                        tokens.pop();
                        if (tokens.length !== 0) {
                            while (tokens.length > 0) {
                                const parentPath = tokens.join(pathutils.sep);

                                if (this._changeTree.exists(parentPath)) {
                                    if (!this._changeTree.isDir(parentPath)) {
                                        existingRelevantNode = this._changeTree.get(parentPath);
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
                    existingRelevantNode = this._changeTree.get(newEvent.path);
                }
            }
        }

        if (this._changeTree.exists(newEvent.path) && this._changeTree.isDir(newEvent.path)) {
            if (newEvent.eventType === PathEventType.AddDir || newEvent.eventType === PathEventType.UnlinkDir) {
                this._changeTree.remove(newEvent.path);
            } else {
                logWarn(
                    "[PathChangeQueue:Push] '%s:%s' Was a file and this is a dir event. Inconsistent state! Resetting.",
                    newEvent.eventType, newEvent.path);
                this.reset();
                return;
            }
        }

        if (existingRelevantNode == null) {
            logInfo("[PathChangeQueue:Push] ... queued.");
            this._changeTree.set(newEvent.path, {
                ev: newEvent,
                time: Date.now(),
            });
            return;
        }

        const compareResult = PathChangeEvent.compareEvents(existingRelevantNode.ev, newEvent);

        if (existingRelevantNode === this._currentlyStaged) {
            logInfo(
                "[PathChangeQueue:Push] ... currently processed event is relevant: '%s:%s' with relationship: %s ...",
                existingRelevantNode.ev.eventType, existingRelevantNode.ev.path,
                compareResult);
        } else {
            logInfo(
                "[PathChangeQueue:Push] ... has existing relevant event: '%s:%s' with relationship: %s ...",
                existingRelevantNode.ev.eventType, existingRelevantNode.ev.path,
                compareResult);
        }

        switch (compareResult) {
            case PathEventComparisonEnum.NewUpdatesOld:
                if (existingRelevantNode === this._currentlyStaged) {
                    logInfo("[PathChangeQueue:Push] ... Retry on currently processed event!");
                    this._currentlyStagedChanged = true;
                } else {
                    logInfo("[PathChangeQueue:Push] ... Ignored!");
                }
                existingRelevantNode.time = Date.now();
                break;
            case PathEventComparisonEnum.BothObsolete:
                if (existingRelevantNode === this._currentlyStaged) {
                    logInfo(
                        "[PathChangeQueue:Push] ... Abort on currently processed event!",
                    );
                    this._currentlyStagedIsObsolete = true;
                } else {
                    logInfo(
                        "[PathChangeQueue:Push] ... Ignored and relevant event is also removed!",
                    );
                    this._changeTree.remove(existingRelevantNode.ev.path);
                }
                break;
            case PathEventComparisonEnum.NewMakesOldObsolete:
                if (existingRelevantNode === this._currentlyStaged) {
                    logInfo(
                        "[PathChangeQueue:Push] ... Queued! With abort on currently processed event!",
                    );
                    this._currentlyStagedIsObsolete = true;
                } else {
                    logInfo("[PathChangeQueue:Push] ... Queued! Removing existing relevant event");
                    this._changeTree.remove(existingRelevantNode.ev.path);
                }
                this._changeTree.set(newEvent.path, {
                    ev: newEvent,
                    time: Date.now(),
                });
                break;
            case PathEventComparisonEnum.Inconsistent:
                logWarn("[PathChangeQueue:Push] ... Inconsistent state! Triggering reset!" +
                    "Received '%s:%s' and had '%s:%s'.",
                    newEvent.eventType, newEvent.path,
                    existingRelevantNode.ev.eventType, existingRelevantNode.ev.path,
                );
                this.reset();
                break;
            /* istanbul ignore next */
            case PathEventComparisonEnum.Different:
                throw new VError("Incosistent state, old ev %s in path %s should be relevant " +
                    "to ev %s in path %s, but it's not",
                existingRelevantNode.ev.eventType, existingRelevantNode.ev.path, newEvent.eventType, newEvent.path);
        }
    }
}
