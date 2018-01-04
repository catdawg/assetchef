"use strict";
const VError = require("verror").VError;
const fs = require("fs");
const chokidar = require("chokidar");
const logger = require("./logger");
const EventEmitter = require("events");

/**
 * @fires DirWatcher#dirchanged
 */
module.exports = class DirWatcher extends EventEmitter {
    /**
     * Add DirEvent
     *
     * @event DirWatcher#dirchanged
     * @param {string} changeType - can be "add", "addDir", "change", "unlink", "unlinkDir"
     * @param {string} path - the path to the file/directory that changed
     * @param {fs.Stats} stat - the stat for the path when applicable {@see http://nodejs.org/api/fs.html#fs_class_fs_stats}
     */

    /**
     * 
     * @param {string} directory - The directory to watch
     * @throws {verror.VError} if arguments are null or directory doesn't exist
     */
    constructor(directory) {

        if (directory == null) {
            throw new VError("directory is null");
        }

        if (!fs.existsSync(directory)) {
            throw new VError("directory does not exist");
        }

        super();

        this._directory = directory;
        this._chokidarWatcher = chokidar.watch(directory, {alwaysStat: true, awaitWriteFinish: true});
    
        this._chokidarWatcher.on("ready", () => {
            logger.logInfo("[Watch] now watching %s", directory);
    
            this._chokidarWatcher.on("add", (path, stat) => {
    
                logger.logInfo("[Watch] detected add %s", path);
                this.emit("dirchanged", "add", path, stat);
            });
    
            this._chokidarWatcher.on("addDir", (path, stat) => {
                logger.logInfo("[Watch] detected addDir %s", path);
                this.emit("dirchanged", "addDir", path, stat);
            });
        
            this._chokidarWatcher.on("change", (path, stat) => {
                logger.logInfo("[Watch] detected change %s", path);
                this.emit("dirchanged", "change", path, stat);
            });
    
            this._chokidarWatcher.on("unlink", (path) => {
                logger.logInfo("[Watch] detected unlink %s", path);
                this.emit("dirchanged", "unlink", path);
            });
    
            this._chokidarWatcher.on("unlinkDir", (path) => {
                logger.logInfo("[Watch] detected unlinkDir %s", path);
                this.emit("dirchanged", "unlinkDir", path);
            });
        });

    }

    /**
     * Call this to cancel the watch
     * @returns {void}
     */
    cancel() {

        if (this._chokidarWatcher != null)
        {
            logger.logInfo("[Watch] cancelled watch on %s", this._directory);
            this._chokidarWatcher.close();
            this._chokidarWatcher = null;
        }
    }
};
