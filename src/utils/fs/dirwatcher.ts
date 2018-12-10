import { ChildProcess, fork } from "child_process";
import * as pathutils from "path";
import { VError } from "verror";

import { ILogger } from "../../plugin/ilogger";
import { IPathChangeEvent } from "../../plugin/ipathchangeevent";
import winstonlogger from "../winstonlogger";
import { IFSEventMessage, ILogMessage, ILogWarnMessage, IStartMessage } from "./dirwatcher_messages";

export class DirWatcher {

    public static async watch(
        directory: string,
        eventCallback: (ev: IPathChangeEvent) => void,
        resetCallback: () => void,
        logger: ILogger = winstonlogger): Promise<{cancel: () => void}> {

        if (directory == null) {
            throw new VError("directory is null");
        }

        if (eventCallback == null) {
            throw new VError("eventCallback is null");
        }

        if (resetCallback == null) {
            throw new VError("resetCallback is null");
        }

        let childProcess: ChildProcess = null;
        const isStopped = () => {
            return childProcess == null;
        };

        let startProcess: () => Promise<void>;
        startProcess = async () => {
            await new Promise((resolve, reject) => {
                childProcess = fork(
                    pathutils.join(__dirname, "..", "..", "..", "dist", "utils", "fs", "dirwatcher_fork.js"),
                    [],
                    {execArgv: []},
                );

                childProcess.on("close", (code) => {
                    if (isStopped()) {
                        return;
                    }

                    logger.logWarn(
                        "[DirWatcher] watcher on '%s' exited with code '%s', restarting...", directory, code);
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
                            const typedMessage: ILogMessage = msg;
                            logger.logInfo(typedMessage.msg);
                            return;
                        }

                        if (msg.type === "LogWarn") {
                            const typedMessage: ILogWarnMessage = msg;
                            logger.logWarn(typedMessage.msg);
                            return;
                        }

                        if (msg.type === "FSEvent") {
                            const typedMessage: IFSEventMessage = msg;
                            eventCallback(typedMessage.ev);
                            return;
                        }
                    }
                });

                const setupMessage: IStartMessage = {
                    type: "Start",
                    path: directory,
                };

                childProcess.send(setupMessage);
            });
        };
        await startProcess();

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
    }
}
