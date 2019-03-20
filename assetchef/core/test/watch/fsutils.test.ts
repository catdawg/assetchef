import * as fse from "fs-extra";
import { VError } from "verror";

import { PathUtils } from "../../src/path/pathutils";
import { timeout } from "../../src/testutils/timeout";
import { TmpFolder } from "../../src/testutils/tmpfolder";
import { winstonlogger } from "../../src/testutils/winstonlogger";

import { FSUtils, StatsComparisonResult } from "../../src/watch/fsutils";

describe("fsutils", async () => {
    let tmpDirPath: string = null;
    beforeAll(async () => {
        tmpDirPath = TmpFolder.generate();
        winstonlogger.logInfo("fsutils test using %s", tmpDirPath);
        await fse.remove(tmpDirPath);
        await fse.mkdirs(tmpDirPath);
    }, 10000);

    afterAll(async () => {
        await fse.remove(tmpDirPath);
    }, 10000);

    it("test relationship", async () => {
        const path = PathUtils.join(tmpDirPath, "path");
        const path2 = PathUtils.join(path, "path2");
        const path3 = PathUtils.join(path, "path3");

        expect(FSUtils.compareStats(null, null)).toEqual(StatsComparisonResult.NoChange);

        await fse.writeFile(path, "content");
        await timeout(500);

        const fileStats = await fse.stat(path);

        expect(FSUtils.compareStats(fileStats, fileStats)).toEqual(StatsComparisonResult.NoChange);
        expect(FSUtils.compareStats(null, fileStats)).toEqual(StatsComparisonResult.NewFile);
        expect(FSUtils.compareStats(fileStats, null)).toEqual(StatsComparisonResult.FileDeleted);

        await fse.writeFile(path, "content2");
        await timeout(500);

        const fileStatsAfterChange = await fse.stat(path);

        if (process.platform !== "darwin") {
            expect(FSUtils.compareStats(fileStats, fileStatsAfterChange)).toEqual(StatsComparisonResult.Changed);
        }

        await fse.remove(path);

        await fse.mkdir(path);
        await timeout(500);

        const dirStats = await fse.stat(path);

        expect(FSUtils.compareStats(dirStats, dirStats)).toEqual(StatsComparisonResult.NoChange);
        expect(FSUtils.compareStats(null, dirStats)).toEqual(StatsComparisonResult.NewDir);
        expect(FSUtils.compareStats(dirStats, null)).toEqual(StatsComparisonResult.DirDeleted);

        expect(FSUtils.compareStats(dirStats, fileStats)).toEqual(StatsComparisonResult.WasDirNowFile);
        expect(FSUtils.compareStats(fileStats, dirStats)).toEqual(StatsComparisonResult.WasFileNowDir);

        if (process.platform !== "darwin") {
            await fse.writeFile(path2, "content3");
            await timeout(500);
            const dirStatsAfterNestedFile = await fse.stat(path);

            expect(FSUtils.compareStats(dirStats, dirStatsAfterNestedFile)).toEqual(StatsComparisonResult.Changed);

            await fse.mkdir(path3);
            await timeout(500);
            const dirStatsAfterNestedDir = await fse.stat(path);
            expect(FSUtils.compareStats(dirStatsAfterNestedDir, dirStatsAfterNestedFile))
                .toEqual(StatsComparisonResult.Changed);
            expect(FSUtils.compareStats(dirStatsAfterNestedFile, dirStatsAfterNestedDir))
                .toEqual(StatsComparisonResult.Changed);
        }

    }, 10000);
});
