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
const child_process_1 = require("child_process");
const pathutils = __importStar(require("path"));
const verror_1 = require("verror");
const winstonlogger_1 = __importDefault(require("../winstonlogger"));
class DirWatcher {
    static watch(directory, eventCallback, resetCallback, logger = winstonlogger_1.default) {
        return __awaiter(this, void 0, void 0, function* () {
            if (directory == null) {
                throw new verror_1.VError("directory is null");
            }
            if (eventCallback == null) {
                throw new verror_1.VError("eventCallback is null");
            }
            if (resetCallback == null) {
                throw new verror_1.VError("resetCallback is null");
            }
            let childProcess = null;
            const isStopped = () => {
                return childProcess == null;
            };
            let startProcess;
            startProcess = () => __awaiter(this, void 0, void 0, function* () {
                yield new Promise((resolve, reject) => {
                    childProcess = child_process_1.fork(pathutils.join(__dirname, "..", "..", "..", "dist", "utils", "fs", "dirwatcher_fork.js"), [], { execArgv: [] });
                    childProcess.on("close", (code) => {
                        if (isStopped()) {
                            return;
                        }
                        logger.logWarn("[DirWatcher] watcher on '%s' exited with code '%s', restarting...", directory, code);
                        resetCallback();
                        startProcess().then(() => {
                            resetCallback();
                        });
                    });
                    childProcess.on("message", (msg) => {
                        if (isStopped()) {
                            return;
                        }
                        if (msg != null && msg.type != null) {
                            if (msg.type === "Started") {
                                resolve();
                                return;
                            }
                            if (msg.type === "Log") {
                                const typedMessage = msg;
                                logger.logInfo(typedMessage.msg);
                                return;
                            }
                            if (msg.type === "LogWarn") {
                                const typedMessage = msg;
                                logger.logWarn(typedMessage.msg);
                                return;
                            }
                            if (msg.type === "FSEvent") {
                                const typedMessage = msg;
                                eventCallback(typedMessage.ev);
                                return;
                            }
                        }
                    });
                    const setupMessage = {
                        type: "Start",
                        path: directory,
                    };
                    childProcess.send(setupMessage);
                });
            });
            yield startProcess();
            return {
                cancel: () => {
                    if (isStopped()) {
                        return;
                    }
                    const savedChildProcess = childProcess;
                    childProcess = null;
                    savedChildProcess.kill();
                },
            };
        });
    }
}
exports.DirWatcher = DirWatcher;
//# sourceMappingURL=dirwatcher.js.map