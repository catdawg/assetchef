"use strict";
const VError = require("verror").VError;
const fs = require("fs");
const chokidar = require("chokidar");
const logger = require("./logger");

const watchdirectory = module.exports = {};

/**
 * This callback is called when something changes
 *
 * @callback WatchForChangesCallbackFunction
 * @param {string} eventType - can be "add", "addDir", "change", "unlink", "unlinkDir"
 * @param {string} path - the path to the file/directory that changed
 * @param {fs.Stats} stat - the stat for the path when applicable {@see http://nodejs.org/api/fs.html#fs_class_fs_stats}
 */

/** 
 * Function to be called to cancel watching a directory
 * @name WatchForChangesCancelFunction
 * @function
*/

/** 
 * Object containing the watch context that allows the cancellation of the watch.
 * @typedef WatchForChangesCancelToken
 * @type {object}
 * @property {WatchForChangesCancelFunction} cancelMethod - call this to cancel watching
 */

/**
 * Watches for changes in the given directory. If you don't need this anymore, call .cancel() on the returned object.
 * @param {string} directory - The directory to watch
 * @param {WatchForChangesCallbackFunction} callback - the callback when something changes
 * @returns {WatchForChangesCancelToken} - returns a token that can be used to cancel the watch
 * @throws {verror.VError} if arguments are null or directory doesn't exist
 */
watchdirectory.watchForChanges = function (directory, callback) {

    if (directory == null) {
        throw new VError("directory is null");
    }
    if (callback == null) {
        throw new VError("callback is null");
    }
    if (!fs.existsSync(directory)) {
        throw new VError("directory does not exist");
    }
    
    let watcher = chokidar.watch(directory, {alwaysStat: true, awaitWriteFinish: true});

    watcher.on("ready", function () {
        logger.logInfo("[Watch] now watching %s", directory);

        watcher.on("add", function(path, stat) {

            logger.logInfo("[Watch] detected add %s", path);

            callback("add", path, stat);
        });

        watcher.on("addDir", function(path, stat) {
            logger.logInfo("[Watch] detected addDir %s", path);

            callback("addDir", path, stat);
        });
    
        watcher.on("change", function(path, stat) {
            logger.logInfo("[Watch] detected change %s", path);

            callback("change", path, stat);
        });

        watcher.on("unlink", function(path) {
            logger.logInfo("[Watch] detected unlink %s", path);

            callback("unlink", path);
        });

        watcher.on("unlinkDir", function(path) {
            logger.logInfo("[Watch] detected unlinkDir %s", path);

            callback("unlinkDir", path);
        });
    });

    return {
        cancel() {
            if (watcher != null)
            {
                logger.logInfo("[Watch] cancelled watch on %s", directory);
                watcher.close();
                watcher = null;
            }
        }
    };
};
