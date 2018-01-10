"use strict";
const VError = require("verror").VError;
const path = require("path");
const fs = require("fs-extra");
const hashutil = require("./hash");
const logger = require("./logger");

/**
 * Holder object for a file and its hash.
 */
class FileElem {

    /**
     * @param {string} path - the full path to the file
     * @param {string} hash - the current hash of the file
     */
    constructor(path, hash) {
        this.path = path;
        this.hash = hash;
    }
}

/**
 * Holder object for a directory and it's contents, which is a list or FileElem and DirElem.
 * Initially it has no content, it is meant to be filled later.
 */
class DirElem {

    /**
     * @param {string} path - the full path to the directory
     * @throws {VError} if the path is null
     */
    constructor(path) {
        this.path = path;
    }

    /**
     * Set contents of the directory.
     * @param {array} contents the contents of the directory
     * @returns {void}
     */
    setContents(contents) {
        this.contents = contents;
    }
}

/**
 * This class builds a representation of the directory, which can later be compared to look for changes.
 */
module.exports = class Dir {

    /**
     * @param {string} path - the full path to the directory
     * @throws {VError} if the path is null
     */
    constructor(path) {

        if (path == null) {
            throw new VError("path is null");
        }

        this.path = path;
        this.cancelled = false;
        this.contents = [];

        this._debugWaitPromise = null;
        this._debugWaitTicks = 0;
    }

    /**
     * Traverses the directory to retrieve it's structure recursively and the hashes of the files.
     * @returns {bool} returns true if the build finishes successfully, otherwise, returns false
     */
    async build() {
        this.cancelled = false;
        
        const directoriesToProcess = [new DirElem(this.path)];

        /**
         * Test method to stop the app in specific places.
         * @returns {Promise} the wait promise
         */
        const debugRunWaitTick = async (...loggingArgs) => {

            --this._debugWaitTicks;
            logger.logInfo.apply(this, loggingArgs);

            if (this._debugWaitTicks === 0) {
                logger.logInfo("[Dir] Debug running tick promise");
                await this._debugWaitPromise();
                this._debugWaitPromise = null;
            }
        };
    
        while (directoriesToProcess.length > 0) {
            const dirElem = directoriesToProcess.pop();

            const dirContents = [];


            let dirList = null;
            try {
                if (this._debugWaitTicks > 0) {
                    await debugRunWaitTick("[Dir] Debug wait tick before readdir %s", dirElem.path);
                }
                dirList = await fs.readdir(dirElem.path);
            }
            catch (err) {
                logger.logWarn("[Dir] Failed to readdir %s", dirElem.path);
                return false;
            }

            for (const elem of dirList) {
                const fullElemPath = path.join(dirElem.path, elem);

                let stat = null;
                try {
                    if (this._debugWaitTicks > 0) {
                        await debugRunWaitTick("[Dir] Wait tick stat %s", fullElemPath);
                    }
                    stat = await fs.stat(fullElemPath);
                }
                catch (err) {
                    logger.logWarn("[Dir] Failed to stat %s", fullElemPath);
                    return false;
                }

                if (stat.isDirectory()) {
                    const newDirElem = new DirElem(fullElemPath);
                    dirContents.push(newDirElem);
                    directoriesToProcess.push(newDirElem);
                }
                else {
                    dirContents.push(new FileElem(fullElemPath, hashutil.hashFSStat(stat)));
                }

                if (this._debugWaitTicks > 0) {
                    await debugRunWaitTick("[Dir] Debug wait tick cancelled 1");
                }

                if (this.cancelled) {
                    return false;
                }
            }

            dirElem.setContents(dirContents);

            if (this._debugWaitTicks > 0) {
                await debugRunWaitTick("[Dir] Debug wait tick cancelled 2");
            }

            if (this.cancelled) {
                return false;
            }
        }
        return true;
    }

    /**
     * Makes the build exit gracefully in case it was running, this should be called if something changes inside the directory being built, or if we need to exit for some reason
     * @returns {void}
     */
    cancelBuild() {
        this.cancelled = true;
    }

    /**
     * Testing method used to stop the application in specific situations, so errors can be triggered.
     * @param {int} count ticks to wait for
     * @param {Promise} promiseToWaitForAfterTicksFinish what is waited for after ticks reach zero.
     * @returns {void}
     */
    _debugWaitForTicks(count, promiseToWaitForAfterTicksFinish) {

        this._debugWaitPromise = promiseToWaitForAfterTicksFinish;
        this._debugWaitTicks = count;
    }
    
};
