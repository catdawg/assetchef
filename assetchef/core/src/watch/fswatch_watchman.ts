import { ChildProcess, fork } from "child_process";
import * as fse from "fs-extra";
import { VError } from "verror";

import { ILogger } from "../comm/ilogger";
import { IPathChangeEvent, PathEventType } from "../path/ipathchangeevent";
import { PathUtils } from "../path/pathutils";
import { ICancelWatch, IFSWatch, IFSWatchListener } from "../watch/ifswatch";
import { FSPoller, IActiveFSPoll } from "./fspoller";
import { FSUtils, StatsComparisonResult } from "./fsutils";
import { IFSEventMessage, ILogMessage, ILogWarnMessage, IStartMessage } from "./fswatchmessages_watchman";

const forkPath = PathUtils.join(
    __dirname, "..", "..", "dist", "watch", "fswatch_watchman_fork.js");

/**
 * Implementation of a IFSWatch interface that uses Watchman.
 * Since watchman doesn't support having the root of a watch be a file, we
 * poll the root, and only enable watchman if a root is a directory.
 */
export class WatchmanFSWatch implements IFSWatch {

    /**
     * Starts a watch on a given directory.
     * @param logger logger to direct all logging from the watch
     * @param path the path to watch
     */
    public static async watchPath(logger: ILogger, path: string): Promise<WatchmanFSWatch> {
        const watcher = new WatchmanFSWatch();
        return watcher.Setup(logger, path);
    }

    private directory: string;
    private logger: ILogger;

    private listeners: IFSWatchListener[] = [];

    private childProcess: ChildProcess;
    private pathPoller: IActiveFSPoll;
    private currentRootStat: fse.Stats;
    private cancelled: boolean = false;

    private settingUp: boolean = false;

    private constructor() {}

    /**
     * part of the ifswatch interface, adds a listener to the watch.
     * @param listener the listener callback.
     */
    public addListener(listener: IFSWatchListener): ICancelWatch {
        if (listener == null) {
            throw new VError("listener can't be null");
        }

        this.listeners.push(listener);

        const cancelToken: ICancelWatch = {
            unlisten: () => {
                const index = this.listeners.indexOf(listener);

                if (index !== -1) {
                    this.listeners.splice(index, 1);
                }
            },
        };

        return cancelToken;
    }

    /**
     * Cancel the watch.
     */
    public cancel() {
        if (this.cancelled) {
            return;
        }

        this.logger.logInfo("stopped watching project.");
        this.listeners = [];
        this.cancelled = true;
        this.pathPoller.cancel();
        if (this.childProcess == null) {
            return;
        }
        this.killProcess();
    }

    private broadcastReset() {
        for (const listener of this.listeners) {
            listener.onReset();
        }
    }

    private broadcastMessage(ev: IPathChangeEvent) {
        /* istanbul ignore next */
        if (this.settingUp) {
            return;
        }
        this.logger.logInfo("broadcasting %s: '%s'", ev.eventType, ev.path);
        for (const listener of this.listeners) {
            listener.onEvent(ev);
        }
    }

    private async startProcess() {
        this.logger.logInfo("startProcess");
        await new Promise((resolve, reject) => {
            this.childProcess = fork(
                forkPath,
                [],
                {execArgv: []},
            );
            this.logger.logInfo("process created");

            this.childProcess.on("close", (code) => {
                resolve(); // might not have any effect if already ran before.
                if (this.isStopped()) {
                    return;
                }

                this.logger.logWarn(
                    "watchman subprocess exited with code '%s', restarting...", this.directory, code);
                this.startProcess().then(() => {
                    this.broadcastReset();
                });
            });

            this.childProcess.on("message", (msg) => {
                /* istanbul ignore next */
                if (this.cancelled) {
                    return;
                }

                /* istanbul ignore else */
                if (msg != null && msg.type != null) {

                    if (msg.type === "Started") {
                        this.logger.logInfo("watchman started");
                        resolve(); // might not have any effect if already ran before.
                        return;
                    }

                    if (msg.type === "Log") {
                        const typedMessage: ILogMessage = msg;
                        this.logger.logInfo("watchman: " + typedMessage.msg);
                        return;
                    }

                    /* istanbul ignore next */
                    if (msg.type === "LogWarn") {
                        const typedMessage: ILogWarnMessage = msg;
                        this.logger.logWarn("watchman: " + typedMessage.msg);
                        return;
                    }

                    /* istanbul ignore else */
                    if (msg.type === "FSEvent") {
                        const typedMessage: IFSEventMessage = msg;
                        /* istanbul ignore next */
                        if (typedMessage.ev.path === "") {
                            return;
                        }
                        this.broadcastMessage(typedMessage.ev);
                    }
                }
            });

            const setupMessage: IStartMessage = {
                type: "Start",
                path: this.directory,
            };

            this.childProcess.send(setupMessage);
        });
    }

    private killProcess() {
        const savedChildProcess = this.childProcess;
        this.childProcess = null;
        savedChildProcess.kill();
    }

    private isStopped() {
        return this.cancelled || !this.isCurrentRootADirectory();
    }

    private isCurrentRootADirectory() {
        return this.currentRootStat != null && this.currentRootStat.isDirectory();
    }

    private async Setup(logger: ILogger, directory: string): Promise<WatchmanFSWatch> {

        if (logger == null) {
            throw new VError("logger is null");
        }

        if (directory == null) {
            throw new VError("directory is null");
        }

        this.settingUp = true;

        this.logger = logger;
        this.directory = directory;

        try {
            await fse.stat(forkPath);
        } catch (e) {
            /* istanbul ignore next */
            throw new VError("fork file '%s' not found, please make sure the file exists.", forkPath);
        }

        const handleNewStat = (stat: fse.Stats, first: boolean) => {
            const oldStat = this.currentRootStat;
            const newStat = stat;
            this.currentRootStat = stat;

            const comparison = FSUtils.compareStats(oldStat, newStat);

            switch (comparison) {
                case StatsComparisonResult.NoChange:
                    break;
                case StatsComparisonResult.Changed:
                    if (!oldStat.isDirectory()) {
                        this.broadcastMessage({eventType: PathEventType.Change, path: ""});
                    }
                    break;
                case StatsComparisonResult.DirDeleted:
                    this.broadcastMessage({eventType: PathEventType.UnlinkDir, path: ""});
                    break;
                case StatsComparisonResult.FileDeleted:
                    this.broadcastMessage({eventType: PathEventType.Unlink, path: ""});
                    break;
                case StatsComparisonResult.NewDir:
                    this.broadcastMessage({eventType: PathEventType.AddDir, path: ""});
                    break;
                case StatsComparisonResult.NewFile:
                    this.broadcastMessage({eventType: PathEventType.Add, path: ""});
                    break;
                case StatsComparisonResult.WasDirNowFile:
                    this.broadcastMessage({eventType: PathEventType.UnlinkDir, path: ""});
                    this.broadcastMessage({eventType: PathEventType.Add, path: ""});
                    break;
                case StatsComparisonResult.WasFileNowDir:
                    this.broadcastMessage({eventType: PathEventType.Unlink, path: ""});
                    this.broadcastMessage({eventType: PathEventType.AddDir, path: ""});
                    break;
            }

            if (first) {
                return; // dont handle process stuff
            }

            switch (comparison) {
                case StatsComparisonResult.NoChange:
                case StatsComparisonResult.Changed:
                    break;
                case StatsComparisonResult.DirDeleted:
                case StatsComparisonResult.WasDirNowFile:
                    /* istanbul ignore else */
                    if (this.childProcess != null) {
                        this.logger.logWarn("project path doesn't exist or is not a directory. Disabling watchman.");
                        this.killProcess();
                    }
                    break;
                case StatsComparisonResult.WasFileNowDir:
                case StatsComparisonResult.NewDir:
                    /* istanbul ignore else */
                    if (this.childProcess == null) {
                        this.logger.logWarn("project path now a directory, starting watchman.");
                        this.startProcess();
                    }
                    break;
            }
        };

        const startPoller = async () => {
            this.pathPoller = await FSPoller.poll(directory, (stat) => {
                /* istanbul ignore next */
                if (this.cancelled) {
                    return;
                }
                handleNewStat(stat, false);

            });
        };

        let rootStat: fse.Stats = null;
        try {
            rootStat = await fse.stat(directory);

            if (rootStat.isDirectory()) {
                await this.startProcess();
            }
        } catch (e) {
            // nop
        }
        this.settingUp = false;
        handleNewStat(rootStat, true);
        await startPoller();
        this.logger.logInfo("ended setup");
        return this;
    }
}
