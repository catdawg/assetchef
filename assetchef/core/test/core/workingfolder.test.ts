// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as fse from "fs-extra";
import * as pathutils from "path";

import { ASSETCHEF_FOLDER_NAME, ASSETCHEF_FOLDER_VERSION_FILE } from "../../src/core/defines";
import { CheckWorkingFolderResultType, WorkingFolderUtils } from "../../src/core/workingfolder";
import { getCallTrackingLogger } from "../../src/testutils/loggingtracer";
import { TmpFolder } from "../../src/testutils/tmpfolder";
import { winstonlogger } from "../../src/testutils/winstonlogger";

async function runAndReturnError(f: () => Promise<any>): Promise<Error> {
    try {
        await f();
    } catch (e) {
        return e;
    }
    return null;
}

describe("workingfolder", () => {

    let tmpDirPath: string = null;
    let workingPath: string = null;
    beforeAll(async () => {
        tmpDirPath = TmpFolder.generate();
        workingPath = pathutils.join(tmpDirPath, ASSETCHEF_FOLDER_NAME);
    });

    afterEach(async () => {
        const files = await fse.readdir(tmpDirPath);

        for (const file of files) {
            fse.remove(pathutils.join(tmpDirPath, file));
        }
    });

    afterAll(async () => {
        await fse.remove(tmpDirPath);
    });

    it("test parameters", async () => {
        expect(await runAndReturnError(async () => await WorkingFolderUtils.check(null, null))).to.not.be.null;
        expect(await runAndReturnError(async () => await WorkingFolderUtils.check(winstonlogger, null))).to.not.be.null;

        expect(await runAndReturnError(async () => await WorkingFolderUtils.setup(null, null))).to.not.be.null;
        expect(await runAndReturnError(async () => await WorkingFolderUtils.setup(winstonlogger, null))).to.not.be.null;

        expect(await runAndReturnError(async () => await WorkingFolderUtils.delete(null, null))).to.not.be.null;
        expect(await runAndReturnError(
            async () => await WorkingFolderUtils.delete(winstonlogger, null))).to.not.be.null;
    });

    it("test checkWorkingFolder", async () => {
        const log = getCallTrackingLogger(winstonlogger);
        expect(await WorkingFolderUtils.check(log, workingPath)).to.be.equal(CheckWorkingFolderResultType.NotFound);
        expect(log.lastLogInfo()).to.be.not.null;

        await WorkingFolderUtils.setup(winstonlogger, workingPath);

        expect(await WorkingFolderUtils.check(winstonlogger, workingPath)).
            to.be.equal(CheckWorkingFolderResultType.Success);

        await fse.remove(pathutils.join(workingPath, ASSETCHEF_FOLDER_VERSION_FILE));

        expect(
            await WorkingFolderUtils.check(log, workingPath)).to.be.equal(CheckWorkingFolderResultType.OutOfDate);
        expect(log.lastLogInfo()).to.be.not.null;

        expect(await WorkingFolderUtils.delete(winstonlogger, workingPath)).to.be.true;

        await fse.writeFile(workingPath, "something");

        expect(await WorkingFolderUtils.check(log, workingPath)).to.be.equal(CheckWorkingFolderResultType.Failure);
        expect(log.lastLogError()).to.be.not.null;
    });

    it("test version change", async () => {
        await WorkingFolderUtils.setup(winstonlogger, workingPath);

        expect(await WorkingFolderUtils.check(winstonlogger, workingPath)).
            to.be.equal(CheckWorkingFolderResultType.Success);

        await fse.writeFile(pathutils.join(workingPath, ASSETCHEF_FOLDER_VERSION_FILE), "change");

        const log = getCallTrackingLogger(winstonlogger);
        expect(
            await WorkingFolderUtils.check(log, workingPath)).to.be.equal(CheckWorkingFolderResultType.OutOfDate);
        expect(log.lastLogInfo()).to.be.not.null;
    });

    it("test delete twice", async () => {
        await WorkingFolderUtils.setup(winstonlogger, workingPath);

        expect(await WorkingFolderUtils.delete(winstonlogger, workingPath)).to.be.true;

        const log = getCallTrackingLogger(winstonlogger);
        expect(
            await WorkingFolderUtils.delete(log, workingPath)).to.be.false;
        expect(log.lastLogError()).to.be.not.null;
    });

    it("test edge case 1", async () => {
        WorkingFolderUtils._setTestInterrupt(
            async () => {await WorkingFolderUtils.delete(winstonlogger, workingPath); });
        const log = getCallTrackingLogger(winstonlogger);
        expect(
            await WorkingFolderUtils.setup(log, workingPath)).to.be.false;
        expect(log.lastLogError()).to.be.not.null;
    });
});
