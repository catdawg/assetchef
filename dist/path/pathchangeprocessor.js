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
};
Object.defineProperty(exports, "__esModule", { value: true });
const pathutils = __importStar(require("path"));
const verror_1 = require("verror");
const logger_1 = require("../utils/logger");
const timeout_1 = require("../utils/timeout");
const pathchangeevent_1 = require("./pathchangeevent");
/**
 * Processor instance that is used to hold the state of a path change processor.
 */
class PathChangeProcessor {
    constructor(queue) {
        if (queue == null) {
            throw new verror_1.VError("queue can't be null");
        }
        this._queue = queue;
    }
    /**
     * Process one event in the queue.
     * @param handler the process handler.
     */
    processOne(handler) {
        return __awaiter(this, void 0, void 0, function* () {
            const evToProcess = this._queue.peek();
            if (evToProcess == null) {
                return {
                    processed: false,
                };
            }
            const stageHandler = this._queue.stage(evToProcess);
            while (true) {
                logger_1.logInfo("[Processor] Handling event %s %s", evToProcess.eventType, evToProcess.path);
                let handleResult;
                const eventType = evToProcess.eventType;
                const eventPath = evToProcess.path;
                let newEvents = null;
                switch (eventType) {
                    case (pathchangeevent_1.PathEventType.Add):
                        handleResult = yield handler.handleFileAdded(eventPath);
                        break;
                    case (pathchangeevent_1.PathEventType.Change):
                        handleResult = yield handler.handleFileChanged(eventPath);
                        break;
                    case (pathchangeevent_1.PathEventType.Unlink):
                        handleResult = yield handler.handleFileRemoved(eventPath);
                        break;
                    case (pathchangeevent_1.PathEventType.UnlinkDir):
                        handleResult = yield handler.handleFolderRemoved(eventPath);
                        break;
                    case (pathchangeevent_1.PathEventType.AddDir):
                        handleResult = yield handler.handleFolderAdded(eventPath);
                        newEvents = [];
                        const list = yield handler.list(eventPath);
                        if (list == null) {
                            handleResult = null; // error occurred
                        }
                        else {
                            for (const p of list) {
                                const path = pathutils.join(eventPath, p);
                                const isdir = yield handler.isDir(path);
                                if (isdir == null) {
                                    handleResult = null; // error occurred
                                    break;
                                }
                                else if (isdir) {
                                    newEvents.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.AddDir, path));
                                }
                                else {
                                    newEvents.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.Add, path));
                                }
                            }
                        }
                        break;
                }
                if (this._debugActionAfterProcess != null) {
                    const debugAction = this._debugActionAfterProcess;
                    this._debugActionAfterProcess = null;
                    yield debugAction();
                }
                if (handleResult == null) {
                    logger_1.logInfo("[Processor] Event '%s:%s' processing error. Waiting 2500ms to see if it really failed...", eventType, eventPath);
                    yield timeout_1.timeout(2500); // an error occurred, so wait a bit to see if it's a retry or obsolete.
                }
                if (stageHandler.didStagedEventChange()) {
                    logger_1.logInfo("[Processor] Retrying event '%s:%s'", eventType, eventPath);
                    continue;
                }
                if (stageHandler.isStagedEventObsolete()) {
                    logger_1.logInfo("[Processor] Cancelled event '%s:%s'", eventType, eventPath);
                    stageHandler.finishProcessingStagedEvent();
                    return {
                        processed: true,
                    };
                }
                if (handleResult == null) {
                    logger_1.logError("[Processor] Processing of '%s:%s' failed.", eventType, eventPath);
                    stageHandler.finishProcessingStagedEvent();
                    return {
                        processed: false,
                        error: "Processing failed, see log to understand what happened.",
                    };
                }
                logger_1.logInfo("[Processor] Committing event '%s:%s'", eventType, eventPath);
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
        });
    }
    /**
     * Process events on the queue until it is empty.
     * @param handler the process handler.
     */
    processAll(handler) {
        return __awaiter(this, void 0, void 0, function* () {
            let res;
            while ((res = yield this.processOne(handler)).processed) {
                continue;
            }
            return res;
        });
    }
}
exports.PathChangeProcessor = PathChangeProcessor;
//# sourceMappingURL=pathchangeprocessor.js.map