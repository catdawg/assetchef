import * as fse from "fs-extra";
import * as pathutils from "path";
import VError from "verror";

import { ILogger } from "../plugin/ilogger";

export const ASSETCHEF_FOLDER_NAME = ".assetchef";
export const ASSETCHEF_FOLDER_VERSION_FILE = "version";
export const ASSETCHEF_FOLDER_VERSION = "1";

export enum CheckWorkingFolderResultType {
    Failure,
    NotFound,
    OutOfDate,
    Success,
}

/**
 * Checks the integrity of the working folder. Throws if parameters are null.
 * Besides that, it should never throw, and the result should inform what to do next.
 * E.g. OutOfDate should call removeWorkingFolder next, Failure should inform the user that
 * something weird is going on. Relevant info will be logged in the logger parameter.
 * @param logger the logger
 * @param workingFolder the working folder
 * @returns the result of the check.
 */
export async function checkWorkingFolder(
    logger: ILogger, workingFolder: string): Promise<CheckWorkingFolderResultType> {

    if (logger == null) {
        throw new VError("logger can't be null");
    }
    if (workingFolder == null) {
        throw new VError("working folder path can't be null");
    }

    const workingFolderVersionFile = pathutils.join(workingFolder, ASSETCHEF_FOLDER_VERSION_FILE);

    let assetchefFolderStat;
    try {
        assetchefFolderStat = await fse.stat(workingFolder);
    } catch (e) {
        logger.logInfo(
            "path '%s' not found.",
            workingFolder);
        return CheckWorkingFolderResultType.NotFound;
    }

    if (!assetchefFolderStat.isDirectory()) {
        logger.logError("'%s' is a file, it should be a directory. Something weird is happening...", workingFolder);
        return CheckWorkingFolderResultType.Failure;
    }

    let existingVersion = null;
    try {
        existingVersion = await fse.readFile(workingFolderVersionFile);
    } catch (e) {
        logger.logInfo(
            "error reading '%s' or file not found.",
            workingFolderVersionFile);

        return CheckWorkingFolderResultType.OutOfDate;
    }

    if (existingVersion.toString("utf8") !== ASSETCHEF_FOLDER_VERSION) {
        logger.logInfo(
            ".assetchef folder is older '%s' than current version '%s'.",
            existingVersion, ASSETCHEF_FOLDER_VERSION);
        return CheckWorkingFolderResultType.OutOfDate;
    }

    return CheckWorkingFolderResultType.Success;
}

/**
 * Safely removes the working folder. If the folder doesn't exists it will return false and log an error.
 * It will throw if the parameters are null.
 * @param logger the logger
 * @param workingFolder the working folder to remove
 * @returns true if successful
 */
export async function deleteWorkingFolder(logger: ILogger, workingFolder: string): Promise<boolean> {
    if (logger == null) {
        throw new VError("logger can't be null");
    }
    if (workingFolder == null) {
        throw new VError("working folder path can't be null");
    }

    try {
        await fse.access(workingFolder);
    } catch (e) {
        logger.logError(
            "failed to remove '%s' folder, are you sure the path is writeable?", workingFolder);
        return false;
    }

    await fse.remove(workingFolder);

    return true;
}

let _interrupt: () => Promise<void> = null;
/**
 * Prepares the working folder from scratch. It will throw if the parameters are null.
 * Otherwise it will return false if any error occurs, and the relevant info will be sent to the logger.
 * @param logger the logger instance
 * @param workingFolder the folder
 * @returns true if successful
 */
export async function setupWorkingFolder(logger: ILogger, workingFolder: string): Promise<boolean> {
    if (logger == null) {
        throw new VError("logger can't be null");
    }
    if (workingFolder == null) {
        throw new VError("working folder path can't be null");
    }
    try {
        await fse.access(workingFolder);
        throw new VError("folder already exists");
    } catch (e) {
        // doesn't exist is good.
    }

    try {
        await fse.mkdir(workingFolder);
    } catch (e) {
        logger.logError(
            "failed to create '%s' folder, are you sure the path is writeable?", workingFolder);
        return false;
    }

    if (_interrupt != null) {
        const inter = _interrupt;
        _interrupt = null;
        await inter();
    }
    const versionFile = pathutils.join(workingFolder, ASSETCHEF_FOLDER_VERSION_FILE);
    try {
        await fse.writeFile(versionFile, Buffer.from(ASSETCHEF_FOLDER_VERSION));
    } catch (e) {
        logger.logError(
            "failed to write version file '%s', are you sure the path is writeable?", versionFile);
        return false;
    }

    return true;
}

export function _setTestInterrupt(f: () => Promise<void>) {
    _interrupt = f;
}
