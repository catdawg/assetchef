import { VError } from "verror";

import { ILogger } from "../comm/ilogger";
import { IPathChangeEvent, PathEventType } from "./ipathchangeevent";

import { PathChangeEventUtils, PathEventComparisonEnum } from "./pathchangeeventutils";
import { PathTree } from "./pathtree";
import { PathUtils } from "./pathutils";

interface IChangeTreeNode {
    ev: IPathChangeEvent;
    time: number;
}

/**
 * In case something goes wrong with the incoming events, this callback will be called.
 * Users of the queue should reset and process everything again.
 */
export type OnQueueReset = () => void;

/**
 * When staging something, this is the interface to know if
 * the event staged is obsolete, should be retried, or finally
 * to confirm the ending of the stage.
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

    private _logger: ILogger;

    constructor(
        resetCallback: OnQueueReset,
        logger: ILogger,
    ) {
        if (resetCallback == null) {
            throw new VError("Callback can't be null");
        }
        if (logger == null) {
            throw new VError("logger can't be null");
        }

        this._logger = logger;

        this._changeTree = new PathTree<IChangeTreeNode>();
        this._resetCallback = resetCallback;
    }

    /**
     * Stages an event for handling.
     * While staged, if something is queued that affects this, the stage handler will be notified.
     * This will throw if the event is not on the queue, if it's null or if something else was staged already.
     * @param event the event to stage.
     */
    public stage(event: IPathChangeEvent): IStageHandler {
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
                if (!this._currentlyStagedIsObsolete &&
                    (
                        this._currentlyStaged.ev.eventType === PathEventType.Add ||
                        this._currentlyStaged.ev.eventType === PathEventType.Change
                    ) &&
                    Date.now() - this._currentlyStaged.time < 2000) {
                    this._logger.logWarn("Event '%s:%s' was processed too fast.",
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
     * @throws VError in case it has an event staged.
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
     * reset the queue.
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
    public peek(): IPathChangeEvent {
        if (this._currentlyStaged != null) {
            throw new VError("While staging an event, this method is not usable.");
        }

        let oldestNode: IChangeTreeNode = null;

        for (const p of this._changeTree.listAll()) {
            if (this._changeTree.isDir(p)) {
                continue;
            }
            const node = this._changeTree.get(p);

            oldestNode = this.comparePriority(oldestNode, node);
        }

        return oldestNode != null ? oldestNode.ev : null;
    }

    /**
     * List all of the events in the queue.
     * Not working when an event is currently staged.
     */
    public *listAll(): IterableIterator<IPathChangeEvent> {
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
     * Pushes into the queue a change.
     * This function uses the pathchangeeventutils.ts.compareEvents method to filter the event.
     * If an event is staged, it will also notify the stager if the current event being staged
     * is affected by the new event.
     * @param {IPathChangeEvent} event the event to push
     * @returns {void}
     */
    public push(newEvent: IPathChangeEvent): void {
        this._logger.logInfo("New event '%s:%s'...", newEvent.eventType, newEvent.path);

        let existingRelevantNode: IChangeTreeNode = null;

        if (this._currentlyStaged != null && !this._currentlyStagedIsObsolete &&
            PathChangeEventUtils.areRelatedEvents(newEvent, this._currentlyStaged.ev)) {
            existingRelevantNode = this._currentlyStaged;
        } else {
            existingRelevantNode = this.getRelevantNode(newEvent.path);
        }

        if (this._changeTree.exists(newEvent.path) && this._changeTree.isDir(newEvent.path)) {
            if (newEvent.eventType === PathEventType.AddDir || newEvent.eventType === PathEventType.UnlinkDir) {
                this._changeTree.remove(newEvent.path); // remove all changes under it.
            } else {
                this._logger.logWarn(
                    "'%s:%s' Was a file and this is a dir event. Inconsistent state! Resetting.",
                    newEvent.eventType, newEvent.path);
                this.reset();
                return;
            }
        }

        if (existingRelevantNode == null) {
            this._logger.logInfo("... queued.");
            this._changeTree.set(newEvent.path, {
                ev: newEvent,
                time: Date.now(),
            });
            return;
        }

        const compareResult = PathChangeEventUtils.compareEvents(existingRelevantNode.ev, newEvent);

        if (existingRelevantNode === this._currentlyStaged) {
            this._logger.logInfo(
                "... currently processed event is relevant: '%s:%s' with relationship: %s ...",
                existingRelevantNode.ev.eventType, existingRelevantNode.ev.path,
                compareResult);
        } else {
            this._logger.logInfo(
                "... has existing relevant event: '%s:%s' with relationship: %s ...",
                existingRelevantNode.ev.eventType, existingRelevantNode.ev.path,
                compareResult);
        }

        switch (compareResult) {
            case PathEventComparisonEnum.NewUpdatesOld:
                if (existingRelevantNode === this._currentlyStaged) {
                    this._logger.logInfo("... Retry on currently processed event!");
                    this._currentlyStagedChanged = true;
                } else {
                    this._logger.logInfo("... Ignored!");
                }
                existingRelevantNode.time = Date.now();
                break;
            case PathEventComparisonEnum.NewMakesOldObsolete:
                if (existingRelevantNode === this._currentlyStaged) {
                    this._logger.logInfo(
                        "... Queued! With abort on currently processed event!",
                    );
                    this._currentlyStagedIsObsolete = true;
                } else {
                    this._logger.logInfo("... Queued! Removing existing relevant event");
                    this._changeTree.remove(existingRelevantNode.ev.path);
                }
                this._changeTree.set(newEvent.path, {
                    ev: newEvent,
                    time: Date.now(),
                });
                break;
            case PathEventComparisonEnum.Inconsistent:
                this._logger.logWarn("... Inconsistent state! Triggering reset!" +
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

    private getRelevantNode(path: string): IChangeTreeNode {
        if (this._changeTree.exists(path)) {
            if (!this._changeTree.isDir(path)) {
                return this._changeTree.get(path);
            }
            return null;
        }

        if (this._changeTree.exists("")) {
            if (!this._changeTree.isDir("")) {
                return this._changeTree.get("");
            }

            const tokens = PathUtils.split(path);
            tokens.pop();
            while (tokens.length > 0) {
                const parentPath = tokens.join(PathUtils.sep);

                if (this._changeTree.exists(parentPath)) {
                    if (!this._changeTree.isDir(parentPath)) {
                        return this._changeTree.get(parentPath);
                    }
                    break;
                }

                tokens.pop();
            }
        }
    }

    private comparePriority(existingNode: IChangeTreeNode, newNode: IChangeTreeNode): IChangeTreeNode {
        if (existingNode == null) {
            return newNode;
        }

        if (
            existingNode.ev.eventType === PathEventType.Add ||
            existingNode.ev.eventType === PathEventType.Change
        ) {
            if (newNode.ev.eventType !== PathEventType.Add &&
                newNode.ev.eventType !== PathEventType.Change) {
                return newNode;
            }
        }

        return newNode.time > existingNode.time ? existingNode : newNode;
    }
}
