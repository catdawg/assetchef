// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as fse from "fs-extra";

import { PathUtils } from "../../src/path/pathutils";
import { timeout } from "../../src/testutils/timeout";
import { TmpFolder } from "../../src/testutils/tmpfolder";
import { winstonlogger } from "../../src/testutils/winstonlogger";

import { FSPoller, IActiveFSPoll } from "../../src/watch/fspoller";

async function runAndReturnError(f: () => Promise<any>): Promise<Error> {
    try {
        await f();
    } catch (e) {
        return e;
    }
    return null;
}

describe("fspoller", () => {

    let tmpDirPath: string = null;
    let currentPoller: IActiveFSPoll = null;
    beforeAll(async () => {
        tmpDirPath = TmpFolder.generate();
        winstonlogger.logInfo("fspoller test using %s", tmpDirPath);
        await fse.remove(tmpDirPath);
        await fse.mkdirs(tmpDirPath);
    }, 10000);

    afterEach(async () => {
        if (currentPoller != null) {
            currentPoller.cancel();
        }
    }, 10000);

    afterAll(async () => {
        await fse.remove(tmpDirPath);
    }, 10000);

    it("test parameters", async () => {
        expect(await runAndReturnError(async () => {
            await FSPoller.poll(null, null);
        })).to.not.be.null;

        expect(await runAndReturnError(async () => {
            await FSPoller.poll(tmpDirPath, null);
        })).to.not.be.null;

        expect(await runAndReturnError(async () => {
            await FSPoller.poll(null, (stat) => { return; });
        })).to.not.be.null;

    }, 10000);

    it("nonexisting path should have null on stats", async () => {
        let currentStat = null;
        let called = false;
        currentPoller = await FSPoller.poll(PathUtils.join(tmpDirPath, "test"), (stat) => {
            currentStat = stat;
            called = true;
        });

        expect(currentPoller.getLast()).to.be.null;
        expect(called).to.be.false;

        await timeout(2000);

        expect(called).to.be.true;
        expect(currentPoller.getLast()).to.be.null;
        expect(currentStat).to.be.null;

        currentPoller.cancel();
    }, 10000);

    it("directory path", async () => {
        let currentStat: fse.Stats = null;
        let called = false;
        const path = PathUtils.join(tmpDirPath, "test");
        currentPoller = await FSPoller.poll(path, (stat) => {
            currentStat = stat;
            called = true;
        });

        expect(currentPoller.getLast()).to.be.null;
        expect(called).to.be.false;

        await fse.mkdir(path);

        await timeout(2000);

        expect(called).to.be.true;
        expect(currentPoller.getLast()).to.be.not.null;
        expect(currentPoller.getLast().isDirectory()).to.be.true;
        expect(currentStat).to.be.not.null;
        expect(currentStat.isDirectory()).to.be.true;

        called = false;
        await fse.remove(path);
        await timeout(2000);

        expect(currentPoller.getLast()).to.be.null;
        expect(called).to.be.true;
        expect(currentStat).to.be.null;

        currentPoller.cancel();
    }, 10000);

    it("file path", async () => {
        let currentStat: fse.Stats = null;
        let called = false;
        const path = PathUtils.join(tmpDirPath, "test");
        currentPoller = await FSPoller.poll(path, (stat) => {
            currentStat = stat;
            called = true;
        });

        expect(currentPoller.getLast()).to.be.null;
        expect(called).to.be.false;

        await fse.writeFile(path, "something");

        await timeout(2000);

        expect(called).to.be.true;
        expect(currentPoller.getLast()).to.be.not.null;
        expect(currentPoller.getLast().isDirectory()).to.be.false;
        expect(currentStat).to.be.not.null;
        expect(currentStat.isDirectory()).to.be.false;

        called = false;
        await fse.remove(path);
        await timeout(2000);

        expect(currentPoller.getLast()).to.be.null;
        expect(called).to.be.true;
        expect(currentStat).to.be.null;

        currentPoller.cancel();
    }, 10000);

    it("cancel", async () => {
        let called = false;
        const path = PathUtils.join(tmpDirPath, "test");
        await fse.mkdir(path);
        currentPoller = await FSPoller.poll(path, () => {
            called = true;
        });

        await timeout(2000);

        expect(called).to.be.true;
        called = false;
        currentPoller.cancel();
        await timeout(2000);
        expect(called).to.be.false;
    }, 10000);
});
