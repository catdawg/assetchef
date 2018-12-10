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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pathutils = __importStar(require("path"));
const verror_1 = require("verror");
const ipathchangeevent_1 = require("../../plugin/ipathchangeevent");
const timeout_1 = require("../timeout");
const winstonlogger_1 = __importDefault(require("../winstonlogger"));
class PathChangeProcessingUtils {
    /**
     * Process one event in the queue.
     * @param queue the queue
     * @param handler the handler for processing the event
     * @param logger dependency injection of the logger, defaults to using the winston library
     * @param _debugActionAfterProcess debug function for unit tests
     * @returns Promise that is true if successful, or false if there is an error.
     */
    static processOne(queue, handler, logger = winstonlogger_1.default, _debugActionAfterProcess = () => { return; }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (queue == null) {
                throw new verror_1.VError("queue can't be null");
            }
            if (handler == null) {
                throw new verror_1.VError("handler can't be null");
            }
            if (logger == null) {
                throw new verror_1.VError("logger can't be null");
            }
            if (_debugActionAfterProcess == null) {
                throw new verror_1.VError("debugaction can't be null");
            }
            const evToProcess = queue.peek();
            if (evToProcess == null) {
                return true;
            }
            const stageHandler = queue.stage(evToProcess);
            while (true) {
                logger.logInfo("[Processor] Handling event %s %s", evToProcess.eventType, evToProcess.path);
                let handleResult;
                const eventType = evToProcess.eventType;
                const eventPath = evToProcess.path;
                let newEvents = null;
                switch (eventType) {
                    case (ipathchangeevent_1.PathEventType.Add):
                        handleResult = yield handler.handleFileAdded(eventPath);
                        break;
                    case (ipathchangeevent_1.PathEventType.Change):
                        handleResult = yield handler.handleFileChanged(eventPath);
                        break;
                    case (ipathchangeevent_1.PathEventType.Unlink):
                        handleResult = yield handler.handleFileRemoved(eventPath);
                        break;
                    case (ipathchangeevent_1.PathEventType.UnlinkDir):
                        handleResult = yield handler.handleFolderRemoved(eventPath);
                        break;
                    case (ipathchangeevent_1.PathEventType.AddDir):
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
                                    newEvents.push({ eventType: ipathchangeevent_1.PathEventType.AddDir, path });
                                }
                                else {
                                    newEvents.push({ eventType: ipathchangeevent_1.PathEventType.Add, path });
                                }
                            }
                        }
                        break;
                }
                yield _debugActionAfterProcess();
                if (handleResult == null) {
                    logger.logInfo("[Processor] Event '%s:%s' processing error. Waiting 2500ms to see if it really failed...", eventType, eventPath);
                    yield timeout_1.timeout(2500); // an error occurred, so wait a bit to see if it's a retry or obsolete.
                }
                if (stageHandler.didStagedEventChange()) {
                    logger.logInfo("[Processor] Retrying event '%s:%s'", eventType, eventPath);
                    continue;
                }
                if (stageHandler.isStagedEventObsolete()) {
                    logger.logInfo("[Processor] Cancelled event '%s:%s'", eventType, eventPath);
                    stageHandler.finishProcessingStagedEvent();
                    return true;
                }
                if (handleResult == null) {
                    logger.logError("[Processor] Processing of '%s:%s' failed.", eventType, eventPath);
                    stageHandler.finishProcessingStagedEvent();
                    return false;
                }
                logger.logInfo("[Processor] Committing event '%s:%s'", eventType, eventPath);
                stageHandler.finishProcessingStagedEvent();
                handleResult();
                if (newEvents != null) {
                    for (const ev of newEvents) {
                        queue.push(ev);
                    }
                }
                return true;
            }
        });
    }
    /**
     * Process all events. Calls processOne until there is nothing left.
     * @param queue the queue
     * @param handler the handler for processing
     * @param logger dependency injection of the logging, defaults to winston library
     * @returns Promise that is true if successful, false if there is an error.
     */
    static processAll(queue, handler, logger = winstonlogger_1.default) {
        return __awaiter(this, void 0, void 0, function* () {
            if (queue == null) {
                throw new verror_1.VError("queue can't be null");
            }
            while (queue.hasChanges()) {
                const res = yield this.processOne(queue, handler, logger);
                if (!res) {
                    return false;
                }
            }
            return true;
        });
    }
}
exports.PathChangeProcessingUtils = PathChangeProcessingUtils;
//# sourceMappingURL=pathchangeprocessingutils.js.map