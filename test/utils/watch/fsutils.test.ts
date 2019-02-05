// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as fse from "fs-extra";
import * as pathutils from "path";
import { VError } from "verror";

import { timeout } from "../../../src/utils/timeout";
import { FSUtils, StatsComparisonResult } from "../../../src/utils/watch/fsutils";
import { TmpFolder } from "../../../test_utils/tmpfolder";
import winstonlogger from "../../../test_utils/winstonlogger";

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
        const path = pathutils.join(tmpDirPath, "path");
        const path2 = pathutils.join(path, "path2");
        const path3 = pathutils.join(path, "path3");

        expect(FSUtils.compareStats(null, null)).to.be.equal(StatsComparisonResult.NoChange);

        await fse.writeFile(path, "content");
        await timeout(500);

        const fileStats = await fse.stat(path);

        expect(FSUtils.compareStats(fileStats, fileStats)).to.be.equal(StatsComparisonResult.NoChange);
        expect(FSUtils.compareStats(null, fileStats)).to.be.equal(StatsComparisonResult.NewFile);
        expect(FSUtils.compareStats(fileStats, null)).to.be.equal(StatsComparisonResult.FileDeleted);

        await fse.writeFile(path, "content2");
        await timeout(500);

        const fileStatsAfterChange = await fse.stat(path);
        expect(FSUtils.compareStats(fileStats, fileStatsAfterChange)).to.be.equal(StatsComparisonResult.Changed);

        await fse.remove(path);

        await fse.mkdir(path);
        await timeout(500);

        const dirStats = await fse.stat(path);

        expect(FSUtils.compareStats(dirStats, dirStats)).to.be.equal(StatsComparisonResult.NoChange);
        expect(FSUtils.compareStats(null, dirStats)).to.be.equal(StatsComparisonResult.NewDir);
        expect(FSUtils.compareStats(dirStats, null)).to.be.equal(StatsComparisonResult.DirDeleted);

        expect(FSUtils.compareStats(dirStats, fileStats)).to.be.equal(StatsComparisonResult.WasDirNowFile);
        expect(FSUtils.compareStats(fileStats, dirStats)).to.be.equal(StatsComparisonResult.WasFileNowDir);

        await fse.writeFile(path2, "content3");
        await timeout(500);
        const dirStatsAfterNestedFile = await fse.stat(path);

        expect(FSUtils.compareStats(dirStats, dirStatsAfterNestedFile)).to.be.equal(StatsComparisonResult.Changed);

        await fse.mkdir(path3);
        await timeout(500);
        const dirStatsAfterNestedDir = await fse.stat(path);
        expect(FSUtils.compareStats(dirStatsAfterNestedDir, dirStatsAfterNestedFile))
            .to.be.equal(StatsComparisonResult.Changed);
        expect(FSUtils.compareStats(dirStatsAfterNestedFile, dirStatsAfterNestedDir))
            .to.be.equal(StatsComparisonResult.Changed);

    }, 10000);
});
