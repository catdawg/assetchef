"use strict";
const VError = require("verror").VError;
const pathutils = require("path");
const fs = require("fs-extra");
const hashutil = require("./hash");
const logger = require("./logger");
const jsonvalidation = require("./jsonvalidation");

const serializationSchema = {
    "definitions": {
        "dir": {
            "type": "object",
            "additionalProperties": { 
                "oneOf": [
                    { "type": "string" },
                    { "$ref": "#/definitions/dir" }
                ]
            }
        }
    },

    "properties": {
        "version": {
            "type": "integer"
        },
        "content": {
            "$ref": "#/definitions/dir"
        }
    },
    "required": ["version", "content"],
    "additionalProperties": false
};

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

        this._path = path;
        this._cancelled = false;
        this._content = null;

        this._debugWaitPromise = null;
        this._debugWaitTicks = 0;
    }

    /**
     * Traverses the directory to retrieve it's structure recursively and the hashes of the files.
     * @returns {bool} returns true if the build finishes successfully, otherwise, returns false
     */
    async build() {
        this._cancelled = false;
        
        const content = new DirElem("");
        const directoriesToProcess = [content];

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

            const fullPathDirElem = pathutils.join(this._path, dirElem.path);

            const dirContents = [];

            let dirList = null;
            try {
                if (this._debugWaitTicks > 0) {
                    await debugRunWaitTick("[Dir] Debug wait tick before readdir %s", fullPathDirElem);
                }
                dirList = await fs.readdir(fullPathDirElem);
            }
            catch (err) {
                logger.logWarn("[Dir] Failed to readdir %s", fullPathDirElem);
                return false;
            }

            for (const elem of dirList) {
                const fullElemPath = pathutils.join(fullPathDirElem, elem);
                const elemPath = pathutils.join(dirElem.path, elem);

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
                    const newDirElem = new DirElem(elemPath);
                    dirContents.push(newDirElem);
                    directoriesToProcess.push(newDirElem);
                }
                else {
                    dirContents.push(new FileElem(elemPath, hashutil.hashFSStat(stat)));
                }

                if (this._debugWaitTicks > 0) {
                    await debugRunWaitTick("[Dir] Debug wait tick cancelled 1");
                }

                if (this._cancelled) {
                    return false;
                }
            }

            dirElem.setContents(dirContents);

            if (this._debugWaitTicks > 0) {
                await debugRunWaitTick("[Dir] Debug wait tick cancelled 2");
            }

            if (this._cancelled) {
                return false;
            }
        }

        this._content = content;
        return true;
    }

    /**
     * Makes the build exit gracefully in case it was running, this should be called if something changes inside the directory being built, or if we need to exit for some reason
     * @returns {void}
     */
    cancelBuild() {
        this._cancelled = true;
    }

    /**
     * @returns {list} list of paths in directory
     * @throws {VError} if you try to use this without having a successful build first
     */
    getPathList() {

        if (this._content == null) {
            throw new VError("Tried to get path list without properly building first.");
        }
        const list = [];
        const directoriesToProcess = [this._content];

        while (directoriesToProcess.length > 0) {
            const dirElem = directoriesToProcess.pop();

            for (const elem of dirElem.contents) {
                list.push(elem.path);
                if (elem instanceof DirElem) {
                    directoriesToProcess.push(elem);
                }
            }
        }

        return list;
    }

    /**
     * 
     * @returns {string} the serialized directory
     * @throws {VError} if you try to serialize without having a successful build first
     */
    serialize() {
        if (this._content == null) {
            throw new VError("Tried to serialize without properly building first.");
        }

        const topLevel = {};
        const directoriesToProcess = [this._content];
        const directoriesToProcessObj = [topLevel];

        while (directoriesToProcess.length > 0) {
            const dirElem = directoriesToProcess.pop();
            const dirElemObj = directoriesToProcessObj.pop();

            for (const elem of dirElem.contents) {
                if (elem instanceof DirElem) {
                    dirElemObj[elem.path] = {}; 
                    directoriesToProcess.push(elem);
                    directoriesToProcessObj.push(dirElemObj[elem.path]);
                }
                else {
                    dirElemObj[elem.path] = elem.hash; 
                }
            }
        }

        const obj = {
            "version": 1,
            "content": topLevel
        };
        return JSON.stringify(obj);
    }

    /**
     * 
     * @param {string} jsonString the same string outputted by serialize()
     * @returns {bool} if succesful or not.
     */
    deserialize(jsonString) {
        if (jsonString == null || jsonString === "") {
            logger.logWarn("[Dir] json used to deserialize was null or empty.");
            return false;
        }
        let obj = null;
        try {
            obj = JSON.parse(jsonString);
        } catch (e) {
            logger.logWarn("[Dir] malformed json '%s' used to deserialize.", jsonString);
            return false;
        }

        const result = jsonvalidation.validateJSON(obj, serializationSchema);
        if (result.errors != null) {
            logger.logWarn("[Dir] json structure '%s' could not be validated.", jsonString);
            return false;
        }

        return true;
    }

    /**
     * 
     * @returns {string} the serialized directory
     * @throws {VError} if you try to serialize without having a successful build first
     */

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
