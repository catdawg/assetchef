"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const pathutils = __importStar(require("path"));
const verror_1 = require("verror");
const pathchangeevent_1 = require("path/pathchangeevent");
const pathtree_1 = require("path/pathtree");
const logger_1 = require("utils/logger");
/**
 * This class receives path event changes and smartly filters out events that are duplicates,
 * or cleans up obsolete events. For example, if we have a events under a specific directory,
 * if that directory is removed, the events under it are also removed.
 */
class PathChangeQueue {
    constructor(resetCallback) {
        if (resetCallback == null) {
            throw new verror_1.VError("Callback can't be null");
        }
        this._changeTree = new pathtree_1.PathTree();
        this._resetCallback = resetCallback;
    }
    stage(event) {
        if (this._currentlyStaged != null) {
            throw new verror_1.VError("must finish processing the previously staged event.");
        }
        if (event == null) {
            throw new verror_1.VError("event can't be null.");
        }
        if (!this._changeTree.exists(event.path) ||
            this._changeTree.isDir(event.path) ||
            this._changeTree.get(event.path).ev.eventType !== event.eventType) {
            throw new verror_1.VError("attempted to stage event that wasn't on the queue, or was different.");
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
                    logger_1.logWarn("[PathChangeQueue:Stage] Event '%s:%s' was processed too fast.", this._currentlyStaged.ev.eventType, this._currentlyStaged.ev.path);
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
    hasChanges() {
        if (this._currentlyStaged != null) {
            throw new verror_1.VError("While staging an event, this method is not usable.");
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
    reset() {
        this._changeTree = new pathtree_1.PathTree();
        if (this._currentlyStaged != null) {
            this._currentlyStagedIsObsolete = true;
        }
        this._resetCallback();
    }
    /**
     * Get an event from the queue. This will return the oldest event on the queue.
     */
    peek() {
        if (this._currentlyStaged != null) {
            throw new verror_1.VError("While staging an event, this method is not usable.");
        }
        let oldestNode = null;
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
    *listAll() {
        const checkForStaging = () => {
            if (this._currentlyStaged != null) {
                throw new verror_1.VError("While staging an event, this method is not usable.");
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
    push(newEvent) {
        logger_1.logInfo("[PathChangeQueue:Push] New event '%s:%s'...", newEvent.eventType, newEvent.path);
        let existingRelevantNode = null;
        if (this._currentlyStaged != null &&
            pathchangeevent_1.PathChangeEvent.areRelatedEvents(newEvent, this._currentlyStaged.ev)) {
            existingRelevantNode = this._currentlyStaged;
        }
        else {
            if (!this._changeTree.exists(newEvent.path)) {
                if (this._changeTree.exists("")) {
                    if (!this._changeTree.isDir("")) {
                        existingRelevantNode = this._changeTree.get("");
                    }
                    else {
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
            }
            else { // path exists
                if (!this._changeTree.isDir(newEvent.path)) {
                    existingRelevantNode = this._changeTree.get(newEvent.path);
                }
            }
        }
        if (this._changeTree.exists(newEvent.path) && this._changeTree.isDir(newEvent.path)) {
            if (newEvent.eventType === pathchangeevent_1.PathEventType.AddDir || newEvent.eventType === pathchangeevent_1.PathEventType.UnlinkDir) {
                this._changeTree.remove(newEvent.path);
            }
            else {
                logger_1.logWarn("[PathChangeQueue:Push] '%s:%s' Was a file and this is a dir event. Inconsistent state! Resetting.", newEvent.eventType, newEvent.path);
                this.reset();
                return;
            }
        }
        if (existingRelevantNode == null) {
            logger_1.logInfo("[PathChangeQueue:Push] ... queued.");
            this._changeTree.set(newEvent.path, {
                ev: newEvent,
                time: Date.now(),
            });
            return;
        }
        const compareResult = pathchangeevent_1.PathChangeEvent.compareEvents(existingRelevantNode.ev, newEvent);
        if (existingRelevantNode === this._currentlyStaged) {
            logger_1.logInfo("[PathChangeQueue:Push] ... currently processed event is relevant: '%s:%s' with relationship: %s ...", existingRelevantNode.ev.eventType, existingRelevantNode.ev.path, compareResult);
        }
        else {
            logger_1.logInfo("[PathChangeQueue:Push] ... has existing relevant event: '%s:%s' with relationship: %s ...", existingRelevantNode.ev.eventType, existingRelevantNode.ev.path, compareResult);
        }
        switch (compareResult) {
            case pathchangeevent_1.PathEventComparisonEnum.NewUpdatesOld:
                if (existingRelevantNode === this._currentlyStaged) {
                    logger_1.logInfo("[PathChangeQueue:Push] ... Retry on currently processed event!");
                    this._currentlyStagedChanged = true;
                }
                else {
                    logger_1.logInfo("[PathChangeQueue:Push] ... Ignored!");
                }
                existingRelevantNode.time = Date.now();
                break;
            case pathchangeevent_1.PathEventComparisonEnum.BothObsolete:
                if (existingRelevantNode === this._currentlyStaged) {
                    logger_1.logInfo("[PathChangeQueue:Push] ... Abort on currently processed event!");
                    this._currentlyStagedIsObsolete = true;
                }
                else {
                    logger_1.logInfo("[PathChangeQueue:Push] ... Ignored and relevant event is also removed!");
                    this._changeTree.remove(existingRelevantNode.ev.path);
                }
                break;
            case pathchangeevent_1.PathEventComparisonEnum.NewMakesOldObsolete:
                if (existingRelevantNode === this._currentlyStaged) {
                    logger_1.logInfo("[PathChangeQueue:Push] ... Queued! With abort on currently processed event!");
                    this._currentlyStagedIsObsolete = true;
                }
                else {
                    logger_1.logInfo("[PathChangeQueue:Push] ... Queued! Removing existing relevant event");
                    this._changeTree.remove(existingRelevantNode.ev.path);
                }
                this._changeTree.set(newEvent.path, {
                    ev: newEvent,
                    time: Date.now(),
                });
                break;
            case pathchangeevent_1.PathEventComparisonEnum.Inconsistent:
                logger_1.logWarn("[PathChangeQueue:Push] ... Inconsistent state! Triggering reset!" +
                    "Received '%s:%s' and had '%s:%s'.", newEvent.eventType, newEvent.path, existingRelevantNode.ev.eventType, existingRelevantNode.ev.path);
                this.reset();
                break;
            /* istanbul ignore next */
            case pathchangeevent_1.PathEventComparisonEnum.Different:
                throw new verror_1.VError("Incosistent state, old ev %s in path %s should be relevant " +
                    "to ev %s in path %s, but it's not", existingRelevantNode.ev.eventType, existingRelevantNode.ev.path, newEvent.eventType, newEvent.path);
        }
    }
}
exports.PathChangeQueue = PathChangeQueue;
//# sourceMappingURL=pathchangequeue.js.map