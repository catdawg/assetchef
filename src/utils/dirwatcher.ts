"use strict";
import * as chokidar from "chokidar";
import EventEmitter from "events";
import * as fs from "fs";
import * as pathutils from "path";
import { VError } from "verror";

import * as logger from "./logger";
import {PathChangeEvent, PathEventType} from "./path/pathchangeevent";

/**
 * @fires DirWatcher#pathchanged
 */
export class DirWatcher extends EventEmitter {
    private _chokidarWatcher: chokidar.FSWatcher;
    private _directory: string;
    /**
     * DirEvent
     *
     * @event DirWatcher#pathchanged
     * @param {PathChangeEvent} event - see pathchangeevent.ts
     */

    /**
     * @param {string} directory - The directory to watch
     * @throws {verror.VError} if arguments are null or directory doesn't exist
     */
    constructor(directory: string) {

        if (directory == null) {
            throw new VError("directory is null");
        }

        if (!fs.existsSync(directory)) {
            throw new VError("directory does not exist");
        }

        super();

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
            logger.logInfo("[Watch] now watching %s", directory);

            this._chokidarWatcher.on("add", (path: string) => {
                path = removeDirectoryFromPath(path);
                logger.logInfo("[Watch] %s detected add %s", directory, path);
                this.emit("pathchanged", new PathChangeEvent(PathEventType.Add, path));
            });

            this._chokidarWatcher.on("addDir", (path: string) => {
                path = removeDirectoryFromPath(path);
                logger.logInfo("[Watch] %s detected addDir %s", directory, path);
                this.emit("pathchanged", new PathChangeEvent(PathEventType.AddDir, path));
            });

            this._chokidarWatcher.on("change", (path: string) => {
                path = removeDirectoryFromPath(path);
                logger.logInfo("[Watch] %s detected change %s", directory, path);
                this.emit("pathchanged", new PathChangeEvent(PathEventType.Change, path));
            });

            this._chokidarWatcher.on("unlink", (path: string) => {
                path = removeDirectoryFromPath(path);
                logger.logInfo("[Watch] %s detected unlink %s", directory, path);
                this.emit("pathchanged", new PathChangeEvent(PathEventType.Unlink, path));
            });

            this._chokidarWatcher.on("unlinkDir", (path: string) => {
                path = removeDirectoryFromPath(path);
                logger.logInfo("[Watch] %s detected unlinkDir %s", directory, path);
                this.emit("pathchanged", new PathChangeEvent(PathEventType.UnlinkDir, path));
            });
        });

    }

    /**
     * Call this to cancel the watch
     * @returns {void}
     */
    public cancel() {

        if (this._chokidarWatcher != null) {
            logger.logInfo("[Watch] cancelled watch on %s", this._directory);
            this._chokidarWatcher.close();
            this._chokidarWatcher = null;
        }
    }
}