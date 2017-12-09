"use strict";
const VError = require("verror").VError;
const fs = require("fs");

const watchdirectory = module.exports = {};

/**
 * This callback is called when the first change happens in a directory.
 *
 * @callback WatchForAChangeCallbackFunction
 */

/** 
 * Function to be called to cancel watching a directory
 * @name WatchForAChangeCancelFunction
 * @function
*/

/** 
 * Object containing the watch context that allows the cancellation of the watch.
 * @typedef WatchForAChangeCancelToken
 * @type {object}
 * @property {WatchForAChangeCancelFunction} cancelMethod - call this to cancel watching
 */

/**
 * Watches for any first change in the given directory. If you don't need this anymore, call .cancel() on the returned object.
 * @param {string} directory - The directory to watch
 * @param {WatchForAChangeCallbackFunction} callback - the callback when something changes
 * @return {WatchForAChangeCancelToken} - returns a token that can be used to cancel the watch
 * @throws {verror.VError} if arguments are null or directory doesn't exist
 */
watchdirectory.watchForAChange = function (directory, callback) {

    if (directory == null) {
        throw new VError("directory is null");
    }
    if (callback == null) {
        throw new VError("callback is null");
    }
    if (!fs.existsSync(directory)) {
        throw new VError("directory does not exist");
    }

    let watcher = fs.watch(directory, {recursive : true}, function () {
        if (watcher != null) {
            callback();
            watcher.close();
            watcher = null;
        }
    });
   
    return {
        cancel: () => {
            if (watcher != null) {
                watcher.close();
                watcher = null;
            }
        }
    };
};
