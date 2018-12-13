import * as chokidar from "chokidar";
import * as fse from "fs-extra";
import { Stats } from "fs-extra";
import * as pathutils from "path";
import * as util from "util";

import { IPathChangeEvent, PathEventType } from "../../plugin/ipathchangeevent";
import { timeout } from "../timeout";
import { IFSEventMessage, ILogMessage, ILogWarnMessage, IStartedMessage, IStartMessage } from "./dirwatcher_messages";

const POLLING_TIMEOUT = 1000;

function log(msg: string, ...args: any[]) {
    const formattedMsg = util.format.apply(null, [msg, ...args]);
    process.send({type: "Log", msg: formattedMsg} as ILogMessage);
}
function logWarn(msg: string, ...args: any[]) {
    const formattedMsg = util.format.apply(null, [msg, ...args]);
    process.send({type: "LogWarn", msg: formattedMsg} as ILogWarnMessage);
}
function sendEvent(ev: IPathChangeEvent) {
    process.send({type: "FSEvent", ev} as IFSEventMessage);
}

function getStat(path: string): Stats {
    let rootStat: Stats = null;
    try {
        rootStat = fse.statSync(path);
    } catch (e) {
        return null;
    }

    return rootStat;
}

async function runDirWatcher(directory: string) {
    const removeDirectoryFromPath = (path: string) => {
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

    let rootDetected: boolean = null;
    let prevRootStat: Stats = null;
    const rootPoller = async () => {
        while (true) {
            const rootStat: Stats = getStat(directory);

            if (rootDetected == null) {
                rootDetected = rootStat != null;
                prevRootStat = rootStat;

                await timeout(POLLING_TIMEOUT);
                continue;
            }

            if (rootStat == null && !rootDetected) {

                await timeout(POLLING_TIMEOUT);
                continue;
            }

            if (rootStat != null && rootDetected && rootStat.isDirectory() === prevRootStat.isDirectory()) {

                if (!prevRootStat.isDirectory()) {
                    if (prevRootStat.mtimeMs !== rootStat.mtimeMs) {
                        log("[DirWatcher] %s detected root change", directory);
                        sendEvent({eventType: PathEventType.Change, path: ""});
                    }
                }
                prevRootStat = rootStat;
                await timeout(POLLING_TIMEOUT);
                continue;
            }

            if (rootStat == null) {
                if (prevRootStat.isDirectory()) {
                    log("[DirWatcher] %s detected root unlinkDir", directory);
                    sendEvent({eventType: PathEventType.UnlinkDir, path: ""});
                } else {
                    log("[DirWatcher] %s detected root unlink", directory);
                    sendEvent({eventType: PathEventType.Unlink, path: ""});
                }

                rootDetected = false;

            } else {
                if (rootDetected) {
                    if (prevRootStat.isDirectory()) {
                        log("[DirWatcher] %s detected root unlinkDir", directory);
                        sendEvent({eventType: PathEventType.UnlinkDir, path: ""});
                    } else {
                        log("[DirWatcher] %s detected root unlink", directory);
                        sendEvent({eventType: PathEventType.Unlink, path: ""});
                    }
                }

                if (rootStat.isDirectory()) {
                    log("[DirWatcher] %s detected root addDir", directory);
                    sendEvent({eventType: PathEventType.AddDir, path: ""});
                } else {
                    log("[DirWatcher] %s detected root add", directory);
                    sendEvent({eventType: PathEventType.Add, path: ""});
                }

                prevRootStat = rootStat;
                rootDetected = true;
            }
            await timeout(POLLING_TIMEOUT);
            continue;
        }
    };

    chokidarWatcher.on("ready", () => {
        log("[DirWatcher] now watching %s", directory);
        process.send({type: "Started"} as IStartedMessage);

        rootPoller(); // async execution

        /* istanbul ignore next */
        chokidarWatcher.on("error", (error: any) => {
            /* istanbul ignore next */
            logWarn("[DirWatcher] %s error %s", directory, error);
        });

        chokidarWatcher.on("add", (path: string) => {
            path = removeDirectoryFromPath(path);
            if (path === "" || !rootDetected) {
                return;
            }
            log("[DirWatcher] %s detected add %s", directory, path);
            sendEvent({eventType: PathEventType.Add, path});
        });

        chokidarWatcher.on("addDir", (path: string) => {
            path = removeDirectoryFromPath(path);
            if (path === "" || !rootDetected) {
                return;
            }
            log("[DirWatcher] %s detected addDir %s", directory, path);
            sendEvent({eventType: PathEventType.AddDir, path});
        });

        chokidarWatcher.on("change", (path: string) => {
            path = removeDirectoryFromPath(path);
            if (path === "" || !rootDetected) {
                return;
            }
            log("[DirWatcher] %s detected change %s", directory, path);
            sendEvent({eventType: PathEventType.Change, path});
        });

        chokidarWatcher.on("unlink", (path: string) => {
            path = removeDirectoryFromPath(path);
            if (path === "" || !rootDetected) {
                return;
            }
            log("[DirWatcher] %s detected unlink %s", directory, path);
            sendEvent({eventType: PathEventType.Unlink, path});
        });

        chokidarWatcher.on("unlinkDir", (path: string) => {
            path = removeDirectoryFromPath(path);
            if (path === "" || !rootDetected) {
                return;
            }
            log("[DirWatcher] %s detected unlinkDir %s", directory, path);
            sendEvent({eventType: PathEventType.UnlinkDir, path});
        });
    });
}

process.on("message", (msg) => {
    if (msg.type == null) {
        return;
    }

    if (msg.type === "Start") {
        const typedMessage: IStartMessage = msg;

        runDirWatcher(typedMessage.path);
        return;
    }

    if (msg.type === "DebugExit") {
        process.exit(1);
    }
});
