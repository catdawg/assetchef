"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const chokidar = __importStar(require("chokidar"));
const pathutils = __importStar(require("path"));
const util = __importStar(require("util"));
const ipathchangeevent_1 = require("../../plugin/ipathchangeevent");
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
function runDirWatcher(directory) {
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
    chokidarWatcher.on("ready", () => {
        log("[DirWatcher] now watching %s", directory);
        process.send({ type: "Started" });
        /* istanbul ignore next */
        chokidarWatcher.on("error", (error) => {
            /* istanbul ignore next */
            logWarn("[DirWatcher] %s error %s", directory, error);
        });
        chokidarWatcher.on("add", (path) => {
            path = removeDirectoryFromPath(path);
            log("[DirWatcher] %s detected add %s", directory, path);
            sendEvent({ eventType: ipathchangeevent_1.PathEventType.Add, path });
        });
        chokidarWatcher.on("addDir", (path) => {
            path = removeDirectoryFromPath(path);
            log("[DirWatcher] %s detected addDir %s", directory, path);
            sendEvent({ eventType: ipathchangeevent_1.PathEventType.AddDir, path });
        });
        chokidarWatcher.on("change", (path) => {
            path = removeDirectoryFromPath(path);
            log("[DirWatcher] %s detected change %s", directory, path);
            sendEvent({ eventType: ipathchangeevent_1.PathEventType.Change, path });
        });
        chokidarWatcher.on("unlink", (path) => {
            path = removeDirectoryFromPath(path);
            log("[DirWatcher] %s detected unlink %s", directory, path);
            sendEvent({ eventType: ipathchangeevent_1.PathEventType.Unlink, path });
        });
        chokidarWatcher.on("unlinkDir", (path) => {
            path = removeDirectoryFromPath(path);
            log("[DirWatcher] %s detected unlinkDir %s", directory, path);
            sendEvent({ eventType: ipathchangeevent_1.PathEventType.UnlinkDir, path });
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