import * as fs from "fs-extra";
import * as pathutils from "path";
import { VError } from "verror";

import {DirChangeEvent, DirEventType} from "./dirchangeevent";
import { hashFSStat } from "./hash";
import { validateJSON } from "./jsonvalidation";
import * as logger from "./logger";

const SERIALIZATION_VERSION = 1;
const SERIALIZATION_FILENAME = ".assetchef";

const serializationSchema = {
    additionalProperties: false,
    definitions: {
        dir: {
            additionalProperties: {
                oneOf: [
                    { type: "string" },
                    { $ref: "#/definitions/dir" },
                ],
            },
            type: "object",
        },
    },

    properties: {
        content: {
            $ref: "#/definitions/dir",
        },
        version: {
            type: "integer",
        },
    },
    required: ["version", "content"],
};

type StatHash = string;

interface IDirContent {
    [key: string]: StatHash | IDirContent;
}

function getIfFolder(dirEntry: StatHash | IDirContent): IDirContent {

    if (typeof dirEntry === "string") {
        return null;
    }

    return dirEntry;
}

interface ISerializedDir {
    version: number;
    content: IDirContent;
}

/**
 * This class builds a representation of the directory, which can later be compared to look for changes.
 * @property {function()} _debugWaitPromise
 */
export = class Dir {

    public _debugWaitPromise: () => Promise<void>;
    public _debugWaitTicks: number;

    private _content: IDirContent;
    private _cancelled: boolean;
    private _path: string;
    /**
     * @param {string} path - the full path to the directory
     * @throws {VError} if the path is null
     */
    constructor(path: string) {

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
     * @returns {Promise<boolean>} returns true if the build finishes successfully, otherwise, returns false
     */
    public async build(): Promise<boolean> {
        this._cancelled = false;

        const content: IDirContent = {};

        const directoriesToProcess = [content];
        const pathsToProcess = [""];

        while (directoriesToProcess.length > 0) {
            const dirElem = directoriesToProcess.pop();
            const dirElemPath = pathsToProcess.pop();

            const fullPathDirElem = pathutils.join(this._path, dirElemPath);

            let dirList = null;
            try {
                if (this._debugWaitTicks > 0) {
                    await this._debugRunWaitTick("[Dir] wait tick before readdir %s", fullPathDirElem);
                }
                dirList = await fs.readdir(fullPathDirElem);
            } catch (err) {
                logger.logWarn("[Dir] Failed to readdir %s", fullPathDirElem);
                return false;
            }

            for (const elem of dirList) {
                const fullElemPath = pathutils.join(fullPathDirElem, elem);
                const elemPath = pathutils.join(dirElemPath, elem);

                let stat = null;
                try {
                    if (this._debugWaitTicks > 0) {
                        await this._debugRunWaitTick("[Dir] Wait tick stat %s", fullElemPath);
                    }
                    stat = await fs.stat(fullElemPath);
                } catch (err) {
                    logger.logWarn("[Dir] Failed to stat %s", fullElemPath);
                    return false;
                }

                if (stat.isDirectory()) {
                    const newDirElem: IDirContent = {};
                    dirElem[elemPath] = newDirElem;
                    directoriesToProcess.push(newDirElem);
                    pathsToProcess.push(elemPath);
                } else {
                    dirElem[elemPath] = hashFSStat(stat);
                }

                if (this._debugWaitTicks > 0) {
                    await this._debugRunWaitTick("[Dir] wait tick cancelled 1");
                }

                if (this._cancelled) {
                    return false;
                }
            }

            if (this._debugWaitTicks > 0) {
                await this._debugRunWaitTick("[Dir] wait tick cancelled 2");
            }

            if (this._cancelled) {
                return false;
            }
        }

        this._content = content;

        return true;
    }

    /**
     * This method tries to find a ".assetchef" file inside the directory, and calls deserialize on it.
     * If anything strange happens, this will return false, and it should be executed again.
     * If an expected error happens like file isn't there or file is corrupted, then this will return true.
     * @returns {Promise<void>} the async method return
     */
    public async buildFromPrevImage(): Promise<void> {

        const serializationFilePath = pathutils.join(this._path, SERIALIZATION_FILENAME);

        let prevDirSerialized = null;

        try {
            prevDirSerialized = await fs.readFile(serializationFilePath, "utf8");
        } catch (err) {
            logger.logInfo("[Dir] Error '%s' reading '%s'", err, serializationFilePath);
            this._content = {};
            return;
        }

        if (!this.deserialize(prevDirSerialized)) {
            logger.logWarn(
                "[Dir] Error deserializing '%s', deleting since it's probably corrupted.", serializationFilePath);
            await fs.remove(serializationFilePath);
            this._content = {};
            return;
        }

        return;
    }

    /**
     * Calls serialize and saves a .assetchef file in the directory
     * @returns {Promise<boolean>} true if successful save
     */
    public async saveToImage(): Promise<boolean> {
        const serializationFilePath = pathutils.join(this._path, SERIALIZATION_FILENAME);

        const serializedString = this.serialize();

        try {
            await fs.writeFile(serializationFilePath, serializedString);
        } catch (err) {
            logger.logWarn("[Dir] Error %s writing %s", err, serializationFilePath);
            return false;
        }

        return true;
    }

    /**
     * Makes the build exit gracefully in case it was running, this should be called if something
     * changes inside the directory being built, or if we need to exit for some reason
     * @returns {void}
     */
    public cancelBuild(): void {
        this._cancelled = true;
    }

    /**
     * @returns {string[]} list of paths in directory
     * @throws {VError} if you try to use this without having a successful build/deserialize first
     */
    public getPathList(): string[] {

        if (this._content == null) {
            throw new VError("Tried to get path list without properly building first.");
        }
        const list = [];
        const directoriesToProcess: IDirContent[] = [this._content];

        while (directoriesToProcess.length > 0) {
            const dirElem: IDirContent = directoriesToProcess.pop();

            for (const path in dirElem) {
                if (dirElem.hasOwnProperty(path)) {
                    list.push(path);

                    const elem = getIfFolder(dirElem[path]);

                    if (elem != null) {
                        directoriesToProcess.push(elem);
                    }
                }
            }
        }

        return list;
    }

    /**
     * @returns {string} the serialized directory
     * @throws {VError} if you try to serialize without having a successful build/deserialize first
     */
    public serialize(): string {
        if (this._content == null) {
            throw new VError("Tried to serialize without properly building first.");
        }

        const obj: ISerializedDir = {
            content: this._content,
            version: SERIALIZATION_VERSION,
        };
        return JSON.stringify(obj);
    }

    /**
     * @param {string} jsonString the same string outputted by serialize()
     * @returns {boolean} if successful or not.
     */
    public deserialize(jsonString: string): boolean {
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

        const result = validateJSON(obj, serializationSchema);
        if (result.errors != null) {
            logger.logWarn("[Dir] json structure '%s' could not be validated.", jsonString);
            return false;
        }

        if (obj.version !== SERIALIZATION_VERSION) {
            logger.logWarn("[Dir] json structure has a version that is different, can't deserialize");
            return false;
        }

        this._content = obj.content;
        return true;
    }

    /**
     * This method will compare the current Dir against another one.
     * The output is a list of DirChangeEvent that represents the differences.
     * @param {Dir} olderDir the Dir to be compared.
     * @throws {VError} if this or the other dir wasn't properly initialized.
     * @returns {DirChangeEvent[]} A list of DirChangeEvent
     */
    public compare(olderDir: Dir): DirChangeEvent[] {
        if (this._content == null || olderDir == null || olderDir._content == null) {
            throw new VError("To compare, both Dirs have to have been properly built with build or deserialize.");
        }

        const diffList = [];

        const dirPairsToProcess: Array<[IDirContent, IDirContent]> = [[this._content, olderDir._content]];

        // additions and changes
        for (const pair of dirPairsToProcess) {
            const currentDirElem = pair[0];
            const olderDirElem = pair[1];

            for (const path in currentDirElem) {

                const newElem = currentDirElem[path];
                const olderElem = olderDirElem[path];
                const newElemFolder = getIfFolder(newElem);

                if (olderElem != null) {
                    const olderElemFolder = getIfFolder(olderElem);
                    // already existed
                    if (newElemFolder != null) {
                        if (olderElemFolder == null) {
                            diffList.push(new DirChangeEvent(DirEventType.Unlink, path));
                            diffList.push(new DirChangeEvent(DirEventType.AddDir, path));
                        } else {
                            dirPairsToProcess.push([newElemFolder, olderElemFolder]);
                        }
                    } else {
                        if (olderElemFolder != null) {
                            diffList.push(new DirChangeEvent(DirEventType.UnlinkDir, path));
                            diffList.push(new DirChangeEvent(DirEventType.Add, path));
                        } else if (newElem !== olderElem) { // both strings
                            diffList.push(new DirChangeEvent(DirEventType.Change, path));
                        }
                    }
                } else {
                    // new path
                    if (newElemFolder != null) {
                        diffList.push(new DirChangeEvent(DirEventType.AddDir, path));
                    } else {
                        diffList.push(new DirChangeEvent(DirEventType.Add, path));
                    }
                }
            }

            // removals
            for (const path in olderDirElem) {

                if (currentDirElem[path] == null) {
                    if (getIfFolder(olderDirElem[path]) != null) {
                        diffList.push(new DirChangeEvent(DirEventType.UnlinkDir, path));
                    } else {
                        diffList.push(new DirChangeEvent(DirEventType.Unlink, path));
                    }
                }
            }
        }

        return diffList;
    }

    /**
     * Testing method used to stop the application in specific situations, so errors can be triggered.
     * @param {number} count ticks to wait for
     * @param {function():PromiseLike<void>} promiseToWaitForAfterTicksFinish what is waited for after ticks reach zero.
     * @returns {void}
     */
    public _debugWaitForTicks(count: number, promiseToWaitForAfterTicksFinish: () => Promise<void>): void {

        this._debugWaitPromise = promiseToWaitForAfterTicksFinish;
        this._debugWaitTicks = count;
    }

    /**
     * Test method to stop the app in specific places.
     * @returns {Promise<void>} the wait promise
     */
    private async _debugRunWaitTick(...loggingArgs: string[]): Promise<void> {

        --this._debugWaitTicks;
        logger.logDebug.apply(this, loggingArgs);

        if (this._debugWaitTicks === 0) {
            logger.logDebug("[Dir] running tick promise");
            await this._debugWaitPromise();
            this._debugWaitPromise = null;
        }
    }
};
