import * as chokidar from "chokidar";
import EventEmitter from "events";
import * as fs from "fs";
import * as pathutils from "path";
import { VError } from "verror";

import { ILogger } from "../../plugin/ilogger";
import { PathEventType } from "../../plugin/ipathchangeevent";
import winstonlogger from "../winstonlogger";

/**
 * @fires DirWatcher#pathchanged
 */
export class DirWatcher extends EventEmitter {
    private _chokidarWatcher: chokidar.FSWatcher;
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

        const removeDirectoryFromPath = (path: string) => {
            let newPath = path.substr(directory.length);
            while (newPath.charAt(0) === pathutils.sep) {
                newPath = newPath.substr(1);
            }
            return newPath;
        };

        this._directory = directory;
        this._chokidarWatcher = chokidar.watch(directory);

        this._chokidarWatcher.on("ready", () => {
            this._logger.logInfo("[Watch] now watching %s", directory);

            // this._chokidarWatcher.on("raw", (event: string, path: string, details: any) => {
                // this._logger.logDebug(
                //    "[Watch] %s raw event detected %s:%s details:%s", directory, event, path, details);
            // });

            /* istanbul ignore next */
            this._chokidarWatcher.on("error", (error: any) => {
                /* istanbul ignore next */
                this._logger.logWarn("[Watch] %s error %s", directory, error);
            });

            this._chokidarWatcher.on("add", (path: string) => {
                path = removeDirectoryFromPath(path);
                this._logger.logInfo("[Watch] %s detected add %s", directory, path);
                this.emit("pathchanged", {eventType: PathEventType.Add, path});
            });

            this._chokidarWatcher.on("addDir", (path: string) => {
                path = removeDirectoryFromPath(path);
                this._logger.logInfo("[Watch] %s detected addDir %s", directory, path);
                this.emit("pathchanged", {eventType: PathEventType.AddDir, path});
            });

            this._chokidarWatcher.on("change", (path: string) => {
                path = removeDirectoryFromPath(path);
                this._logger.logInfo("[Watch] %s detected change %s", directory, path);
                this.emit("pathchanged", {eventType: PathEventType.Change, path});
            });

            this._chokidarWatcher.on("unlink", (path: string) => {
                path = removeDirectoryFromPath(path);
                this._logger.logInfo("[Watch] %s detected unlink %s", directory, path);
                this.emit("pathchanged", {eventType: PathEventType.Unlink, path});
            });

            this._chokidarWatcher.on("unlinkDir", (path: string) => {
                path = removeDirectoryFromPath(path);
                this._logger.logInfo("[Watch] %s detected unlinkDir %s", directory, path);
                this.emit("pathchanged", {eventType: PathEventType.UnlinkDir, path});
            });
        });

    }

    /**
     * Call this to cancel the watch
     * @returns {void}
     */
    public cancel(): void {

        if (this._chokidarWatcher != null) {
            this._logger.logInfo("[Watch] cancelled watch on %s", this._directory);
            this._chokidarWatcher.close();
            this._chokidarWatcher = null;
        }
    }
}
