// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as fse from "fs-extra";
import * as pathutils from "path";
import * as tmp from "tmp";

import { ASSETCHEF_FOLDER_NAME, ASSETCHEF_FOLDER_VERSION_FILE } from "../../src/kitchen/defines";
import {
    CheckWorkingFolderResultType,
    WorkingFolderUtils} from "../../src/kitchen/workingfolder";
import winstonlogger from "../../src/utils/winstonlogger";
import { getCallTrackingLogger } from "../loggingtracer";

async function runAndReturnError(f: () => Promise<any>): Promise<Error> {
    try {
        await f();
    } catch (e) {
        return e;
    }
    return null;
}

describe("workingfolder", () => {

    let tmpDir: tmp.SynchrounousResult = null;
    let workingPath: string = null;
    beforeAll(() => {
        tmpDir = tmp.dirSync();
        workingPath = pathutils.join(tmpDir.name, ASSETCHEF_FOLDER_NAME);
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
        expect(log.didCallLogInfo()).to.be.true;

        await WorkingFolderUtils.setup(winstonlogger, workingPath);

        expect(await WorkingFolderUtils.check(winstonlogger, workingPath)).
            to.be.equal(CheckWorkingFolderResultType.Success);

        await fse.remove(pathutils.join(workingPath, ASSETCHEF_FOLDER_VERSION_FILE));

        expect(
            await WorkingFolderUtils.check(log, workingPath)).to.be.equal(CheckWorkingFolderResultType.OutOfDate);
        expect(log.didCallLogInfo()).to.be.true;

        expect(await WorkingFolderUtils.delete(winstonlogger, workingPath)).to.be.true;

        await fse.writeFile(workingPath, "something");

        expect(await WorkingFolderUtils.check(log, workingPath)).to.be.equal(CheckWorkingFolderResultType.Failure);
        expect(log.didCallLogError()).to.be.true;
    });

    it("test version change", async () => {
        await WorkingFolderUtils.setup(winstonlogger, workingPath);

        expect(await WorkingFolderUtils.check(winstonlogger, workingPath)).
            to.be.equal(CheckWorkingFolderResultType.Success);

        await fse.writeFile(pathutils.join(workingPath, ASSETCHEF_FOLDER_VERSION_FILE), "change");

        const log = getCallTrackingLogger(winstonlogger);
        expect(
            await WorkingFolderUtils.check(log, workingPath)).to.be.equal(CheckWorkingFolderResultType.OutOfDate);
        expect(log.didCallLogInfo()).to.be.true;
    });

    it("test delete twice", async () => {
        await WorkingFolderUtils.setup(winstonlogger, workingPath);

        expect(await WorkingFolderUtils.delete(winstonlogger, workingPath)).to.be.true;

        const log = getCallTrackingLogger(winstonlogger);
        expect(
            await WorkingFolderUtils.delete(log, workingPath)).to.be.false;
        expect(log.didCallLogError()).to.be.true;
    });

    it("test edge case 1", async () => {
        WorkingFolderUtils._setTestInterrupt(
            async () => {await WorkingFolderUtils.delete(winstonlogger, workingPath); });
        const log = getCallTrackingLogger(winstonlogger);
        expect(
            await WorkingFolderUtils.setup(log, workingPath)).to.be.false;
        expect(log.didCallLogError()).to.be.true;
    });
});
