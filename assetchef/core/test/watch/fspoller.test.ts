import * as fse from "fs-extra";

import { PathUtils } from "../../src/path/pathutils";
import { timeout } from "../../src/testutils/timeout";
import { TmpFolder } from "../../src/testutils/tmpfolder";
import { winstonlogger } from "../../src/testutils/winstonlogger";

import { FSPoller, IActiveFSPoll } from "../../src/watch/fspoller";

jest.setTimeout(20000);

describe("fspoller", () => {

    let tmpDirPath: string = null;
    let currentPoller: IActiveFSPoll = null;
    beforeAll(async () => {
        tmpDirPath = TmpFolder.generate();
        winstonlogger.logInfo("fspoller test using %s", tmpDirPath);
        await fse.remove(tmpDirPath);
        await fse.mkdirs(tmpDirPath);
    });

    afterEach(async () => {
        if (currentPoller != null) {
            currentPoller.cancel();
        }
    });

    afterAll(async () => {
        await fse.remove(tmpDirPath);
    });

    it("test parameters", async () => {
        await expect(FSPoller.poll(null, null)).rejects.toThrow();

        await expect(FSPoller.poll(tmpDirPath, null)).rejects.toThrow();

        await expect(FSPoller.poll(null, (stat) => { return; })).rejects.toThrow();

    });

    it("nonexisting path should have null on stats", async () => {
        let currentStat = null;
        let called = false;
        currentPoller = await FSPoller.poll(PathUtils.join(tmpDirPath, "test"), (stat) => {
            currentStat = stat;
            called = true;
        });

        expect(currentPoller.getLast()).toBeNull();
        expect(called).toBeFalse();

        await timeout(2000);

        expect(called).toBeTrue();
        expect(currentPoller.getLast()).toBeNull();
        expect(currentStat).toBeNull();

        currentPoller.cancel();
    });

    it("directory path", async () => {
        let currentStat: fse.Stats = null;
        let called = false;
        const path = PathUtils.join(tmpDirPath, "test");
        currentPoller = await FSPoller.poll(path, (stat) => {
            currentStat = stat;
            called = true;
        });

        expect(currentPoller.getLast()).toBeNull();
        expect(called).toBeFalse();

        await fse.mkdir(path);

        await timeout(2000);

        expect(called).toBeTrue();
        expect(currentPoller.getLast()).not.toBeNull();
        expect(currentPoller.getLast().isDirectory()).toBeTrue();
        expect(currentStat).not.toBeNull();
        expect(currentStat.isDirectory()).toBeTrue();

        called = false;
        await fse.remove(path);
        await timeout(2000);

        expect(currentPoller.getLast()).toBeNull();
        expect(called).toBeTrue();
        expect(currentStat).toBeNull();

        currentPoller.cancel();
    });

    it("file path", async () => {
        let currentStat: fse.Stats = null;
        let called = false;
        const path = PathUtils.join(tmpDirPath, "test");
        currentPoller = await FSPoller.poll(path, (stat) => {
            currentStat = stat;
            called = true;
        });

        expect(currentPoller.getLast()).toBeNull();
        expect(called).toBeFalse();

        await fse.writeFile(path, "something");

        await timeout(2000);

        expect(called).toBeTrue();
        expect(currentPoller.getLast()).not.toBeNull();
        expect(currentPoller.getLast().isDirectory()).toBeFalse();
        expect(currentStat).not.toBeNull();
        expect(currentStat.isDirectory()).toBeFalse();

        called = false;
        await fse.remove(path);
        await timeout(2000);

        expect(currentPoller.getLast()).toBeNull();
        expect(called).toBeTrue();
        expect(currentStat).toBeNull();

        currentPoller.cancel();
    });

    it("cancel", async () => {
        let called = false;
        const path = PathUtils.join(tmpDirPath, "test");
        await fse.mkdir(path);
        currentPoller = await FSPoller.poll(path, () => {
            called = true;
        });

        await timeout(2000);

        expect(called).toBeTrue();
        called = false;
        currentPoller.cancel();
        await timeout(2000);
        expect(called).toBeFalse();
    });
});
