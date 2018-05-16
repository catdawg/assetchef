"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
}
Object.defineProperty(exports, "__esModule", { value: true });
const pathutils = __importStar(require("path"));
const verror_1 = require("verror");
const logger = __importStar(require("../logger"));
const pathchangeevent_1 = require("./pathchangeevent");
const pathtree_1 = require("./pathtree");
/**
 * Processor instance that is used to hold the state of a path change processor.
 */
class Process {
    constructor(changeTree, resetMethod) {
        this._currentEventBeingProcessed = null;
        this._currentEventObsolete = null;
        this._currentEventChanged = null;
        this._changeTree = changeTree;
        this._resetMethod = resetMethod;
    }
    process(handleEvent) {
        return __awaiter(this, void 0, void 0, function* () {
            let evToProcess;
            const popEvent = () => {
                if (!this._changeTree.exists("")) {
                    return null;
                }
                if (!this._changeTree.isDir("")) {
                    const evType = this._changeTree.get("");
                    this._changeTree.remove("");
                    return new pathchangeevent_1.PathChangeEvent(evType, "");
                }
                const directoriesToVisit = [""];
                while (directoriesToVisit.length !== 0) {
                    const directory = directoriesToVisit.pop();
                    for (const entry of this._changeTree.list(directory)) {
                        const path = pathutils.join(directory, entry);
                        if (!this._changeTree.isDir(path)) {
                            const evType = this._changeTree.get(path);
                            this._changeTree.remove(path);
                            return new pathchangeevent_1.PathChangeEvent(evType, path);
                        }
                        else {
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
                    const commitMethod = yield handleEvent(this._currentEventBeingProcessed);
                    if (this._currentEventChanged) {
                        logger.logInfo("[Processor] Retrying event '%s:%s'", evToProcess.eventType, evToProcess.path);
                        continue;
                    }
                    if (this._currentEventObsolete) {
                        logger.logInfo("[Processor] Cancelled event '%s:%s'", evToProcess.eventType, evToProcess.path);
                        break;
                    }
                    if (commitMethod == null) {
                        logger.logWarn("[Processor] Processing of '%s:%s' failed, resetting processor.", evToProcess.eventType, evToProcess.path);
                        this._resetMethod();
                        return;
                    }
                    this._currentEventBeingProcessed = null;
                    logger.logInfo("[Processor] Committing event '%s:%s'", evToProcess.eventType, evToProcess.path);
                    commitMethod();
                    break;
                }
            }
        });
    }
    getEventBeingProcessed() {
        return this._currentEventBeingProcessed;
    }
    currentEventChanged() {
        this._currentEventChanged = true;
    }
    currentEventIsObsolete() {
        this._currentEventObsolete = true;
    }
    stop() {
        this._stop = true;
    }
}
/**
 * This class receives directory event changes and smartly filters out events that are duplicates.
 * The process method allows the asynchronous handling of those events while recovering from errors.
 * Errors are for example if you're processing a directory that gets deleted.
 */
class PathChangeProcessor {
    constructor(resetCallback) {
        if (resetCallback == null) {
            throw new verror_1.VError("Callback can't be null");
        }
        this._changeTree = new pathtree_1.PathTree();
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
    process(handleEvent) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._currentProcess != null) {
                throw new verror_1.VError("Only one process at a time.");
            }
            this._currentProcess = new Process(this._changeTree, () => {
                this._resetWithCallback();
            });
            yield this._currentProcess.process(handleEvent);
            this._currentProcess = null;
        });
    }
    /**
     * reset the processing.
     */
    reset() {
        this._changeTree = new pathtree_1.PathTree();
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
    push(newEvent) {
        logger.logInfo("[Processor:Push] New event '%s:%s'...", newEvent.eventType, newEvent.path);
        let existingRelevantEvent = null;
        const currentEventBeingProcessed = this._currentProcess != null ? this._currentProcess.getEventBeingProcessed() : null;
        if (currentEventBeingProcessed != null &&
            pathchangeevent_1.PathChangeEvent.areRelatedEvents(newEvent, currentEventBeingProcessed)) {
            existingRelevantEvent = currentEventBeingProcessed;
        }
        else {
            if (!this._changeTree.exists(newEvent.path)) {
                const tokens = newEvent.path.split(pathutils.sep);
                tokens.pop();
                if (tokens.length === 0) {
                    if (this._changeTree.exists("")) {
                        if (!this._changeTree.isDir("")) {
                            existingRelevantEvent = new pathchangeevent_1.PathChangeEvent(this._changeTree.get(""), "");
                        }
                    }
                }
                else {
                    while (tokens.length > 0) {
                        const parentPath = tokens.join(pathutils.sep);
                        if (this._changeTree.exists(parentPath)) {
                            if (!this._changeTree.isDir(parentPath)) {
                                existingRelevantEvent =
                                    new pathchangeevent_1.PathChangeEvent(this._changeTree.get(parentPath), parentPath);
                            }
                            break;
                        }
                        tokens.pop();
                    }
                }
            }
            else {
                if (!this._changeTree.isDir(newEvent.path)) {
                    existingRelevantEvent = new pathchangeevent_1.PathChangeEvent(this._changeTree.get(newEvent.path), newEvent.path);
                }
            }
        }
        if (this._changeTree.exists(newEvent.path) && this._changeTree.isDir(newEvent.path)) {
            if (newEvent.eventType === pathchangeevent_1.PathEventType.AddDir || newEvent.eventType === pathchangeevent_1.PathEventType.UnlinkDir) {
                this._changeTree.remove(newEvent.path);
            }
            else {
                logger.logWarn("[Processor:Push] '%s:%s' Was a file and this is a directory event. Inconsistent state! Resetting.", newEvent.eventType, newEvent.path);
                this._resetWithCallback();
                return;
            }
        }
        if (existingRelevantEvent == null) {
            logger.logInfo("[Processor:Push] ... queued.");
            this._changeTree.set(newEvent.path, newEvent.eventType);
            return;
        }
        const compareResult = pathchangeevent_1.PathChangeEvent.compareEvents(existingRelevantEvent, newEvent);
        if (existingRelevantEvent === currentEventBeingProcessed) {
            logger.logInfo("[Processor:Push] ... currently processed event is relevant: '%s:%s' with relationship: %s ...", existingRelevantEvent.eventType, existingRelevantEvent.path, compareResult);
        }
        else {
            logger.logInfo("[Processor:Push] ... has existing relevant event: '%s:%s' with relationship: %s ...", existingRelevantEvent.eventType, existingRelevantEvent.path, compareResult);
        }
        switch (compareResult) {
            case pathchangeevent_1.PathEventComparisonEnum.NewUpdatesOld:
                if (existingRelevantEvent === currentEventBeingProcessed) {
                    logger.logInfo("[Processor:Push] ... Retry on currently processed event!");
                    this._currentProcess.currentEventChanged();
                }
                else {
                    logger.logInfo("[Processor:Push] ... Ignored!");
                }
                break;
            case pathchangeevent_1.PathEventComparisonEnum.BothObsolete:
                if (existingRelevantEvent === currentEventBeingProcessed) {
                    logger.logInfo("[Processor:Push] ... Abort on currently processed event!");
                    this._currentProcess.currentEventIsObsolete();
                }
                else {
                    logger.logInfo("[Processor:Push] ... Ignored and relevant event is also removed!");
                    this._changeTree.remove(existingRelevantEvent.path);
                }
                break;
            case pathchangeevent_1.PathEventComparisonEnum.NewMakesOldObsolete:
                if (existingRelevantEvent === currentEventBeingProcessed) {
                    logger.logInfo("[Processor:Push] ... Queued! With abort on currently processed event!");
                    this._currentProcess.currentEventIsObsolete();
                }
                else {
                    logger.logInfo("[Processor:Push] ... Queued! Removing existing relevant event");
                    this._changeTree.remove(existingRelevantEvent.path);
                }
                this._changeTree.set(newEvent.path, newEvent.eventType);
                break;
            case pathchangeevent_1.PathEventComparisonEnum.Inconsistent:
                logger.logWarn("[Processor:Push] ... Inconsistent state! Triggering reset!" +
                    "Received '%s:%s' and had '%s:%s'.", newEvent.eventType, newEvent.path, existingRelevantEvent.eventType, existingRelevantEvent.path);
                this._resetWithCallback();
                break;
            /* istanbul ignore next */
            case pathchangeevent_1.PathEventComparisonEnum.Different:
                throw new verror_1.VError("Incosistent state, old ev %s in path %s should be relevant " +
                    "to ev %s in path %s, but it's not", existingRelevantEvent.eventType, existingRelevantEvent.path, newEvent.eventType, newEvent.path);
        }
    }
    _resetWithCallback() {
        this.reset();
        this._resetCallback();
    }
}
exports.PathChangeProcessor = PathChangeProcessor;
//# sourceMappingURL=pathchangeprocessor.js.map