// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as fse from "fs-extra";

import { FSPathTree } from "../../src/path/fspathtree";
import { PathUtils } from "../../src/path/pathutils";
import { FakeFSWatch } from "../../src/testutils/fakefswatch";
import { timeout } from "../../src/testutils/timeout";
import { TmpFolder } from "../../src/testutils/tmpfolder";

async function runAndReturnError(f: () => Promise<any>): Promise<Error> {
    try {
        await f();
    } catch (e) {
        return e;
    }
    return null;
}

describe("fspathtree", () => {
    let tmpDirPath: string = null;
    beforeEach(async () => {
        tmpDirPath = TmpFolder.generate();
    }, 10000);

    afterEach(async () => {
        await fse.remove(tmpDirPath);
    }, 10000);

    it("test read", async () => {
        const fspathtree = new FSPathTree(tmpDirPath, new FakeFSWatch());

        await fse.writeFile(PathUtils.join(tmpDirPath, "file"), Buffer.from("content"));

        await timeout(1000);

        expect ((await fspathtree.get("file")).toString()).to.equal("content");
    });

    it("test stat", async () => {
        const fspathtree = new FSPathTree(tmpDirPath, new FakeFSWatch());

        await fse.writeFile(PathUtils.join(tmpDirPath, "file"), Buffer.from("content"));

        await timeout(1000);

        expect ((await fspathtree.getInfo("file")).isFile()).to.equal(true);
    });

    it("test list", async () => {
        const fspathtree = new FSPathTree(tmpDirPath, new FakeFSWatch());

        await fse.mkdir(PathUtils.join(tmpDirPath, "dir"));
        await fse.writeFile(PathUtils.join(tmpDirPath, "dir", "file"), Buffer.from("content"));
        await fse.writeFile(PathUtils.join(tmpDirPath, "dir", "file2"), Buffer.from("content"));

        await timeout(1000);

        expect(await fspathtree.list("dir")).to.have.same.members(["file", "file2"]);
    });

    it("test ifswatch", async () => {
        const fswatch = new FakeFSWatch();
        const fspathtree = new FSPathTree(tmpDirPath, fswatch);

        expect(fswatch).to.be.equal(fspathtree.fswatch);
    });
});