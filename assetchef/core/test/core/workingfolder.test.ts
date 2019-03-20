import * as fse from "fs-extra";

import { ASSETCHEF_FOLDER_NAME, ASSETCHEF_FOLDER_VERSION_FILE } from "../../src/core/defines";
import { CheckWorkingFolderResultType, WorkingFolderUtils } from "../../src/core/workingfolder";
import { PathUtils } from "../../src/path/pathutils";
import { getCallTrackingLogger } from "../../src/testutils/loggingtracer";
import { TmpFolder } from "../../src/testutils/tmpfolder";
import { winstonlogger } from "../../src/testutils/winstonlogger";

describe("workingfolder", () => {

    let tmpDirPath: string = null;
    let workingPath: string = null;
    beforeAll(async () => {
        tmpDirPath = TmpFolder.generate();
        workingPath = PathUtils.join(tmpDirPath, ASSETCHEF_FOLDER_NAME);
    });

    afterEach(async () => {
        const files = await fse.readdir(tmpDirPath);

        for (const file of files) {
            fse.remove(PathUtils.join(tmpDirPath, file));
        }
    });

    afterAll(async () => {
        await fse.remove(tmpDirPath);
    });

    it("test parameters", async () => {
        await expect(WorkingFolderUtils.check(null, null)).rejects.toThrow();
        await expect(WorkingFolderUtils.check(winstonlogger, null)).rejects.toThrow();

        await expect(WorkingFolderUtils.setup(null, null)).rejects.toThrow();
        await expect(WorkingFolderUtils.setup(winstonlogger, null)).rejects.toThrow();

        await expect(WorkingFolderUtils.delete(null, null)).rejects.toThrow();
        await expect(WorkingFolderUtils.delete(winstonlogger, null)).rejects.toThrow();
    });

    it("test checkWorkingFolder", async () => {
        const log = getCallTrackingLogger(winstonlogger);
        expect(await WorkingFolderUtils.check(log, workingPath)).toEqual(CheckWorkingFolderResultType.NotFound);
        expect(log.lastLogInfo()).not.toBeNull();

        await WorkingFolderUtils.setup(winstonlogger, workingPath);

        expect(await WorkingFolderUtils.check(winstonlogger, workingPath)).
            toEqual(CheckWorkingFolderResultType.Success);

        await fse.remove(PathUtils.join(workingPath, ASSETCHEF_FOLDER_VERSION_FILE));

        expect(
            await WorkingFolderUtils.check(log, workingPath)).toEqual(CheckWorkingFolderResultType.OutOfDate);
        expect(log.lastLogInfo()).not.toBeNull();

        expect(await WorkingFolderUtils.delete(winstonlogger, workingPath)).toBeTrue();

        await fse.writeFile(workingPath, "something");

        expect(await WorkingFolderUtils.check(log, workingPath)).toEqual(CheckWorkingFolderResultType.Failure);
        expect(log.lastLogError()).not.toBeNull();
    });

    it("test version change", async () => {
        await WorkingFolderUtils.setup(winstonlogger, workingPath);

        expect(await WorkingFolderUtils.check(winstonlogger, workingPath)).
            toEqual(CheckWorkingFolderResultType.Success);

        await fse.writeFile(PathUtils.join(workingPath, ASSETCHEF_FOLDER_VERSION_FILE), "change");

        const log = getCallTrackingLogger(winstonlogger);
        expect(
            await WorkingFolderUtils.check(log, workingPath)).toEqual(CheckWorkingFolderResultType.OutOfDate);
        expect(log.lastLogInfo()).not.toBeNull();
    });

    it("test delete twice", async () => {
        await WorkingFolderUtils.setup(winstonlogger, workingPath);

        expect(await WorkingFolderUtils.delete(winstonlogger, workingPath)).toBeTrue();

        const log = getCallTrackingLogger(winstonlogger);
        expect(
            await WorkingFolderUtils.delete(log, workingPath)).toBeTrue();
    });

    it("test edge case 1", async () => {
        WorkingFolderUtils._setTestInterrupt(
            async () => {await WorkingFolderUtils.delete(winstonlogger, workingPath); });
        const log = getCallTrackingLogger(winstonlogger);
        expect(
            await WorkingFolderUtils.setup(log, workingPath)).toBeFalse();
        expect(log.lastLogError()).not.toBeNull();
    });
});
