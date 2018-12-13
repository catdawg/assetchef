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
const chokidar = __importStar(require("chokidar"));
const fse = __importStar(require("fs-extra"));
const pathutils = __importStar(require("path"));
const util = __importStar(require("util"));
const ipathchangeevent_1 = require("../../plugin/ipathchangeevent");
const timeout_1 = require("../timeout");
const POLLING_TIMEOUT = 1000;
function log(msg, ...args) {
    const formattedMsg = util.format.apply(null, [msg, ...args]);
    process.send({ type: "Log", msg: formattedMsg });
}
function logWarn(msg, ...args) {
    const formattedMsg = util.format.apply(null, [msg, ...args]);
    process.send({ type: "LogWarn", msg: formattedMsg });
}
function sendEvent(ev) {
    process.send({ type: "FSEvent", ev });
}
function getStat(path) {
    let rootStat = null;
    try {
        rootStat = fse.statSync(path);
    }
    catch (e) {
        return null;
    }
    return rootStat;
}
function runDirWatcher(directory) {
    return __awaiter(this, void 0, void 0, function* () {
        const removeDirectoryFromPath = (path) => {
            let newPath = path.substr(directory.length);
            while (newPath.charAt(0) === pathutils.sep) {
                newPath = newPath.substr(1);
            }
            return newPath;
        };
        const chokidarWatcher = chokidar.watch(directory, {
            awaitWriteFinish: {
                pollInterval: 200,
                stabilityThreshold: 1000,
            },
        });
        let rootDetected = null;
        let prevRootStat = null;
        const rootPoller = () => __awaiter(this, void 0, void 0, function* () {
            while (true) {
                const rootStat = getStat(directory);
                if (rootDetected == null) {
                    rootDetected = rootStat != null;
                    prevRootStat = rootStat;
                    yield timeout_1.timeout(POLLING_TIMEOUT);
                    continue;
                }
                if (rootStat == null && !rootDetected) {
                    yield timeout_1.timeout(POLLING_TIMEOUT);
                    continue;
                }
                if (rootStat != null && rootDetected && rootStat.isDirectory() === prevRootStat.isDirectory()) {
                    if (!prevRootStat.isDirectory()) {
                        if (prevRootStat.mtimeMs !== rootStat.mtimeMs) {
                            log("[DirWatcher] %s detected root change", directory);
                            sendEvent({ eventType: ipathchangeevent_1.PathEventType.Change, path: "" });
                        }
                    }
                    prevRootStat = rootStat;
                    yield timeout_1.timeout(POLLING_TIMEOUT);
                    continue;
                }
                if (rootStat == null) {
                    if (prevRootStat.isDirectory()) {
                        log("[DirWatcher] %s detected root unlinkDir", directory);
                        sendEvent({ eventType: ipathchangeevent_1.PathEventType.UnlinkDir, path: "" });
                    }
                    else {
                        log("[DirWatcher] %s detected root unlink", directory);
                        sendEvent({ eventType: ipathchangeevent_1.PathEventType.Unlink, path: "" });
                    }
                    rootDetected = false;
                }
                else {
                    if (rootDetected) {
                        if (prevRootStat.isDirectory()) {
                            log("[DirWatcher] %s detected root unlinkDir", directory);
                            sendEvent({ eventType: ipathchangeevent_1.PathEventType.UnlinkDir, path: "" });
                        }
                        else {
                            log("[DirWatcher] %s detected root unlink", directory);
                            sendEvent({ eventType: ipathchangeevent_1.PathEventType.Unlink, path: "" });
                        }
                    }
                    if (rootStat.isDirectory()) {
                        log("[DirWatcher] %s detected root addDir", directory);
                        sendEvent({ eventType: ipathchangeevent_1.PathEventType.AddDir, path: "" });
                    }
                    else {
                        log("[DirWatcher] %s detected root add", directory);
                        sendEvent({ eventType: ipathchangeevent_1.PathEventType.Add, path: "" });
                    }
                    prevRootStat = rootStat;
                    rootDetected = true;
                }
                yield timeout_1.timeout(POLLING_TIMEOUT);
                continue;
            }
        });
        chokidarWatcher.on("ready", () => {
            log("[DirWatcher] now watching %s", directory);
            process.send({ type: "Started" });
            rootPoller(); // async execution
            /* istanbul ignore next */
            chokidarWatcher.on("error", (error) => {
                /* istanbul ignore next */
                logWarn("[DirWatcher] %s error %s", directory, error);
            });
            chokidarWatcher.on("add", (path) => {
                path = removeDirectoryFromPath(path);
                if (path === "" || !rootDetected) {
                    return;
                }
                log("[DirWatcher] %s detected add %s", directory, path);
                sendEvent({ eventType: ipathchangeevent_1.PathEventType.Add, path });
            });
            chokidarWatcher.on("addDir", (path) => {
                path = removeDirectoryFromPath(path);
                if (path === "" || !rootDetected) {
                    return;
                }
                log("[DirWatcher] %s detected addDir %s", directory, path);
                sendEvent({ eventType: ipathchangeevent_1.PathEventType.AddDir, path });
            });
            chokidarWatcher.on("change", (path) => {
                path = removeDirectoryFromPath(path);
                if (path === "" || !rootDetected) {
                    return;
                }
                log("[DirWatcher] %s detected change %s", directory, path);
                sendEvent({ eventType: ipathchangeevent_1.PathEventType.Change, path });
            });
            chokidarWatcher.on("unlink", (path) => {
                path = removeDirectoryFromPath(path);
                if (path === "" || !rootDetected) {
                    return;
                }
                log("[DirWatcher] %s detected unlink %s", directory, path);
                sendEvent({ eventType: ipathchangeevent_1.PathEventType.Unlink, path });
            });
            chokidarWatcher.on("unlinkDir", (path) => {
                path = removeDirectoryFromPath(path);
                if (path === "" || !rootDetected) {
                    return;
                }
                log("[DirWatcher] %s detected unlinkDir %s", directory, path);
                sendEvent({ eventType: ipathchangeevent_1.PathEventType.UnlinkDir, path });
            });
        });
    });
}
process.on("message", (msg) => {
    if (msg.type == null) {
        return;
    }
    if (msg.type === "Start") {
        const typedMessage = msg;
        runDirWatcher(typedMessage.path);
        return;
    }
    if (msg.type === "DebugExit") {
        process.exit(1);
    }
});
//# sourceMappingURL=dirwatcher_fork.js.map