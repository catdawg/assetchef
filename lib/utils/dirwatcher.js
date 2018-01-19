"use strict";
const VError = require("verror").VError;
const fs = require("fs");
const chokidar = require("chokidar");
const logger = require("./logger");
const EventEmitter = require("events");
const DirChangeEvent = require("./dirchangeevent");
const DirEventType = DirChangeEvent.DirEventType;

/**
 * @fires DirWatcher#dirchanged
 */
module.exports = class DirWatcher extends EventEmitter {
    /**
     * Add DirEvent
     *
     * @event DirWatcher#dirchanged
     * @param {DirChangeEvent} event - see dirchangeevent.js
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
    
            this._chokidarWatcher.on("add", (path) => {
    
                logger.logInfo("[Watch] detected add %s", path);
                this.emit("dirchanged", new DirChangeEvent(DirEventType.Add, path));
            });
    
            this._chokidarWatcher.on("addDir", (path) => {
                logger.logInfo("[Watch] detected addDir %s", path);
                this.emit("dirchanged", new DirChangeEvent(DirEventType.AddDir, path));
            });
        
            this._chokidarWatcher.on("change", (path) => {
                logger.logInfo("[Watch] detected change %s", path);
                this.emit("dirchanged", new DirChangeEvent(DirEventType.Change, path));
            });
    
            this._chokidarWatcher.on("unlink", (path) => {
                logger.logInfo("[Watch] detected unlink %s", path);
                this.emit("dirchanged", new DirChangeEvent(DirEventType.Unlink, path));
            });
    
            this._chokidarWatcher.on("unlinkDir", (path) => {
                logger.logInfo("[Watch] detected unlinkDir %s", path);
                this.emit("dirchanged", new DirChangeEvent(DirEventType.UnlinkDir, path));
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
