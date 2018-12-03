import EventEmitter from "events";
import * as fs from "fs";
import sane from "sane";
import { VError } from "verror";

import { ILogger } from "../../plugin/ilogger";
import { PathEventType } from "../../plugin/ipathchangeevent";
import winstonlogger from "../winstonlogger";

/**
 * @fires DirWatcher#pathchanged
 */
export class DirWatcher extends EventEmitter {
    private _saneWatcher: sane.Watcher;
    private _directory: string;
    private _logger: ILogger;

    /**
     * DirEvent
     *
     * @event DirWatcher#pathchanged
     * @param {IPathChangeEvent} event - see pathchangeevent.ts
     */

    /**
     * @param {string} directory - The directory to watch
     * @throws {verror.VError} if arguments are null or directory doesn't exist
     */
    constructor(directory: string, logger: ILogger = winstonlogger) {

        if (directory == null) {
            throw new VError("directory is null");
        }

        if (!fs.existsSync(directory)) {
            throw new VError("directory does not exist");
        }

        super();

        this._logger = logger;

        this._directory = directory;
        this._saneWatcher = sane(directory); // chokidar.watch(directory);

        const directoriesSet: Set<string> = new Set();

        this._saneWatcher.on("ready", () => {
            this._logger.logInfo("[Watch] now watching %s", directory);

            /* istanbul ignore next */
            this._saneWatcher.on("error", (error: any) => {
                /* istanbul ignore next */
                this._logger.logWarn("[Watch] %s error %s", directory, error);
            });

            this._saneWatcher.on("add", (path: string, root: string, stat: fs.Stats) => {
                if (stat.isDirectory()) {
                    directoriesSet.add(path);
                    this._logger.logInfo("[Watch] %s detected addDir %s", directory, path);
                    this.emit("pathchanged", {eventType: PathEventType.AddDir, path});
                } else {
                    this._logger.logInfo("[Watch] %s detected add %s", directory, path);
                    this.emit("pathchanged", {eventType: PathEventType.Add, path});
                }
            });
            this._saneWatcher.on("change", (path: string) => {
                this._logger.logInfo("[Watch] %s detected change %s", directory, path);
                this.emit("pathchanged", {eventType: PathEventType.Change, path});
            });

            this._saneWatcher.on("delete", (path: string, root: string) => {
                if (directoriesSet.has(path)) {
                    this._logger.logInfo("[Watch] %s detected unlinkDir %s", directory, path);
                    this.emit("pathchanged", {eventType: PathEventType.UnlinkDir, path});
                    directoriesSet.delete(path);
                } else {
                    this._logger.logInfo("[Watch] %s detected unlink %s", directory, path);
                    this.emit("pathchanged", {eventType: PathEventType.Unlink, path});
                }
            });
        });

    }

    /**
     * Call this to cancel the watch
     * @returns {void}
     */
    public cancel(): void {

        if (this._saneWatcher != null) {
            this._logger.logInfo("[Watch] cancelled watch on %s", this._directory);
            this._saneWatcher.close();
            this._saneWatcher = null;
        }
    }
}
