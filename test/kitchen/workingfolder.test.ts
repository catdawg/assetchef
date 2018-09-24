// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as fse from "fs-extra";
import * as pathutils from "path";
import * as tmp from "tmp";

import {
    _setTestInterrupt,
    ASSETCHEF_FOLDER_VERSION_FILE,
    checkWorkingFolder,
    CheckWorkingFolderResultType,
    deleteWorkingFolder,
    setupWorkingFolder} from "../../src/kitchen/workingfolder";
import { ILogger } from "../../src/plugin/ilogger";
import winstonlogger from "../../src/utils/winstonlogger";

async function runAndReturnError(f: () => Promise<any>): Promise<Error> {
    try {
        await f();
    } catch (e) {
        return e;
    }
    return null;
}

interface ILoggerTracer extends ILogger {
    logInfo: (...args: any[]) => void;
    logWarn: (...args: any[]) => void;
    logDebug: (...args: any[]) => void;
    logError: (...args: any[]) => void;
    didCallLogInfo: () => boolean;
    didCallLogError: () => boolean;
    didCallLogDebug: () => boolean;
    didCallLogWarn: () => boolean;
}

function getCallTrackingLogger(originalLogger: ILogger): ILoggerTracer {
    let calledLogInfo = false;
    let calledLogError = false;
    let calledLogWarn = false;
    let calledLogDebug = false;

    return {
        logInfo: (...args: any[]) => {
            calledLogInfo = true;
            originalLogger.logInfo.apply(this, args);
        },
        logError: (...args: any[]) => {
            calledLogError = true;
            originalLogger.logError.apply(this, args);
        },
        logWarn: (...args: any[]) => {
            calledLogWarn = true;
            originalLogger.logWarn.apply(this, args);
        },
        logDebug: (...args: any[]) => {
            calledLogDebug = true;
            originalLogger.logDebug.apply(this, args);
        },
        didCallLogInfo: () => calledLogInfo,
        didCallLogError: () => calledLogError,
        didCallLogDebug: () => calledLogDebug,
        didCallLogWarn: () => calledLogWarn,
    };
}

describe("workingfolder", () => {

    let tmpDir: tmp.SynchrounousResult = null;
    let workingPath: string = null;
    beforeAll(() => {
        tmpDir = tmp.dirSync();
        workingPath = pathutils.join(tmpDir.name, "testfolder");
    });

    afterEach(async () => {
        const files = await fse.readdir(tmpDir.name);

        for (const file of files) {
            fse.remove(pathutils.join(tmpDir.name, file));
        }
    });

    afterAll(async () => {
        await fse.remove(tmpDir.name);
    });

    it("test parameters", async () => {
        expect(await runAndReturnError(async () => await checkWorkingFolder(null, null))).to.not.be.null;
        expect(await runAndReturnError(async () => await checkWorkingFolder(winstonlogger, null))).to.not.be.null;

        expect(await runAndReturnError(async () => await setupWorkingFolder(null, null))).to.not.be.null;
        expect(await runAndReturnError(async () => await setupWorkingFolder(winstonlogger, null))).to.not.be.null;

        expect(await runAndReturnError(async () => await deleteWorkingFolder(null, null))).to.not.be.null;
        expect(await runAndReturnError(async () => await deleteWorkingFolder(winstonlogger, null))).to.not.be.null;
    });

    it("test checkWorkingFolder", async () => {
        let log = getCallTrackingLogger(winstonlogger);
        expect(await checkWorkingFolder(log, workingPath)).to.be.equal(CheckWorkingFolderResultType.NotFound);
        expect(log.didCallLogInfo()).to.be.true;

        await setupWorkingFolder(winstonlogger, workingPath);

        expect(await checkWorkingFolder(winstonlogger, workingPath)).to.be.equal(CheckWorkingFolderResultType.Success);

        await fse.remove(pathutils.join(workingPath, ASSETCHEF_FOLDER_VERSION_FILE));

        log = getCallTrackingLogger(winstonlogger);
        expect(
            await checkWorkingFolder(log, workingPath)).to.be.equal(CheckWorkingFolderResultType.OutOfDate);
        expect(log.didCallLogInfo()).to.be.true;

        expect(await deleteWorkingFolder(winstonlogger, workingPath)).to.be.true;

        await fse.writeFile(workingPath, "something");

        log = getCallTrackingLogger(winstonlogger);
        expect(await checkWorkingFolder(log, workingPath)).to.be.equal(CheckWorkingFolderResultType.Failure);
        expect(log.didCallLogError()).to.be.true;
    });

    it("test version change", async () => {
        await setupWorkingFolder(winstonlogger, workingPath);

        expect(await checkWorkingFolder(winstonlogger, workingPath)).to.be.equal(CheckWorkingFolderResultType.Success);

        await fse.writeFile(pathutils.join(workingPath, ASSETCHEF_FOLDER_VERSION_FILE), "change");

        const log = getCallTrackingLogger(winstonlogger);
        expect(
            await checkWorkingFolder(log, workingPath)).to.be.equal(CheckWorkingFolderResultType.OutOfDate);
        expect(log.didCallLogInfo()).to.be.true;
    });

    it("test delete twice", async () => {
        await setupWorkingFolder(winstonlogger, workingPath);

        expect(await deleteWorkingFolder(winstonlogger, workingPath)).to.be.true;

        const log = getCallTrackingLogger(winstonlogger);
        expect(
            await deleteWorkingFolder(log, workingPath)).to.be.false;
        expect(log.didCallLogError()).to.be.true;
    });

    it("test edge case 1", async () => {
        _setTestInterrupt(async () => {await deleteWorkingFolder(winstonlogger, workingPath); });
        const log = getCallTrackingLogger(winstonlogger);
        expect(
            await setupWorkingFolder(log, workingPath)).to.be.false;
        expect(log.didCallLogError()).to.be.true;
    });
});
