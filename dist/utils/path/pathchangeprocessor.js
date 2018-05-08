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
const pathchangeevent_1 = require("./pathchangeevent");
const pathtree_1 = require("./pathtree");
/**
 * Processor instance that is used to hold the state of a path change processor.
 */
class Process {
    constructor(changeTree) {
        this._currentEventBeingProcessed = null;
        this._currentEventObsolete = null;
        this._currentEventChanged = null;
        this._changeTree = changeTree;
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
                    for (const path of this._changeTree.list(directory)) {
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
                this._currentEventObsolete = false;
                this._currentEventChanged = false;
                this._currentEventBeingProcessed = evToProcess;
                yield handleEvent(this._currentEventBeingProcessed, () => this._currentEventObsolete, () => this._currentEventChanged);
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
     * This is the most important method in this class. It allows the processing of pathchangeevents
     * while handling errors properly. For example, if the handleEvent method receives a AddDir event,
     * and while it is processing it, a new file is added to the directory being read. The retryCheck method would
     * start returning true, meaning that if the directory processing is halfway finished, it should be restarted.
     * If the directory is actually removed, then cancelCheck would start returning true and the processing should
     * clear and return.
     * @param handleEvent the processing method.
     */
    process(handleEvent) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._currentProcess != null) {
                throw new verror_1.VError("Only one process at a time.");
            }
            this._currentProcess = new Process(this._changeTree);
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
                while (tokens.length > 0) {
                    const parentPath = tokens.join(pathutils.sep);
                    if (this._changeTree.exists(parentPath)) {
                        if (!this._changeTree.isDir(parentPath)) {
                            existingRelevantEvent = new pathchangeevent_1.PathChangeEvent(this._changeTree.get(parentPath), parentPath);
                        }
                        break;
                    }
                    tokens.pop();
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
                this._resetWithError("Received event %s in path %s " +
                    "which is inconsistent with current state. Resetting processing.");
            }
        }
        if (existingRelevantEvent == null) {
            this._changeTree.set(newEvent.path, newEvent.eventType);
            return;
        }
        const compareResult = pathchangeevent_1.PathChangeEvent.compareEvents(existingRelevantEvent, newEvent);
        switch (compareResult) {
            case pathchangeevent_1.PathEventComparisonEnum.NewUpdatesOld:
                if (existingRelevantEvent === currentEventBeingProcessed) {
                    this._currentProcess.currentEventChanged();
                }
                break;
            case pathchangeevent_1.PathEventComparisonEnum.BothObsolete:
                if (existingRelevantEvent === currentEventBeingProcessed) {
                    this._currentProcess.currentEventIsObsolete();
                }
                else {
                    this._changeTree.remove(existingRelevantEvent.path);
                }
                break;
            case pathchangeevent_1.PathEventComparisonEnum.NewMakesOldObsolete:
                if (existingRelevantEvent === currentEventBeingProcessed) {
                    this._currentProcess.currentEventIsObsolete();
                }
                else {
                    this._changeTree.remove(existingRelevantEvent.path);
                }
                this._changeTree.set(newEvent.path, newEvent.eventType);
                break;
            case pathchangeevent_1.PathEventComparisonEnum.Inconsistent:
                this._resetWithError("Received event %s in path %s, " +
                    "but an event %s in path %s was already logged, which creates an incosistent state");
                break;
            /* istanbul ignore next */
            case pathchangeevent_1.PathEventComparisonEnum.Different:
                throw new verror_1.VError("Incosistent state, old ev %s in path %s should be relevant " +
                    "to ev %s in path %s, but it's not", existingRelevantEvent.eventType, existingRelevantEvent.path, newEvent.eventType, newEvent.path);
        }
    }
    _resetWithError(error) {
        this.reset();
        this._resetCallback(error);
    }
}
exports.PathChangeProcessor = PathChangeProcessor;
//# sourceMappingURL=pathchangeprocessor.js.map