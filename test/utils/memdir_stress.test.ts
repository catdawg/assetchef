// tslint:disable:no-unused-expression
import * as chai from "chai";

import * as fse from "fs-extra";
import * as pathutils from "path";
import { runRandomFSChanger } from "randomfschanger";
import * as tmp from "tmp";

import { IPathTreeReadonly } from "../../src/path/ipathtreereadonly";
import * as logger from "../../src/utils/logger";
import { MemDir } from "../../src/utils/memdir";
import timeout from "../../src/utils/timeout";

const expect = chai.expect;

describe("stress memdir", () => {
    let tmpDir = null;
    let dir: MemDir = null;

    beforeAll(async () => {
        tmpDir = tmp.dirSync();
    });

    beforeEach(async () => {
        dir = new MemDir(tmpDir.name);
        dir.start();
        await timeout(1500); // make sure the watch starts
    });

    afterEach(async () => {
        dir.stop();

        const files = await fse.readdir(tmpDir.name);
        for (const file of files) {
            const fullPath = pathutils.join(tmpDir.name, file);
            await fse.remove(fullPath);
        }
        await timeout(1500); // make sure all changes are flushed
    });

    afterAll( async () => {
        await fse.remove(tmpDir.name);
    });

    async function checkTreeReflectActualDirectory(
        pathTree: IPathTreeReadonly<Buffer>,
        path: string,
    ): Promise<string> {
        if (!pathTree.exists("")) {
            return;
        }

        const directoriesToVist: string[] = [""];

        while (directoriesToVist.length > 0) {
            const directory = directoriesToVist.pop();

            const pathsInMem = [...pathTree.list(directory)];
            const pathsInFs = await fse.readdir(pathutils.join(path, directory));

            expect(pathsInMem).to.have.same.members(pathsInFs, "must have same entries in directory");

            for (const p of pathsInFs) {
                const fullPath = pathutils.join(path, directory, p);
                const relativePath = pathutils.join(directory, p);

                const isDirInMem = pathTree.isDir(relativePath);
                const isDirInFs = (await fse.stat(fullPath)).isDirectory();

                expect(isDirInMem).to.be.equal(isDirInFs, "most both be the same, file or directory.");

                if (isDirInFs) {
                    directoriesToVist.push(relativePath);
                } else {
                    const contentInFs = await fse.readFile(pathutils.join(path, directory, p));
                    const contentInMem = pathTree.get(relativePath);

                    expect(contentInFs).to.deep.equal(contentInMem, "must have same content");
                }
            }
        }
    }

    async function randomTestWithSeed(seed: number) {

        await dir.sync();
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);

        let finish = false;
        await Promise.all([(async () => {
            await runRandomFSChanger(tmpDir.name, 60000, {seed});
            finish = true;
        })(), (async () => {
            while (!finish) {
                logger.logInfo("sync started");
                await dir.sync();
                logger.logInfo("sync finished");
                try {
                    await checkTreeReflectActualDirectory(dir.content, tmpDir.name);
                    logger.logInfo("!!!!Sync successful in the middle of random FSChanges!!!!");
                } catch (e) {
                    logger.logInfo("error happened");
                    await timeout(2500);
                    if (!dir.isOutOfSync()) {
                        dir.isOutOfSync();
                        throw e;
                    }
                }
                await timeout(2500);
            }
        })()]);

        await dir.sync();
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);
    }

    it("test with randomfschanger 1", async () => {
        await randomTestWithSeed(1);
    }, 200000);

    it("test with randomfschanger 2", async () => {

        await randomTestWithSeed(2);
    }, 200000);

    it("test with randomfschanger 3", async () => {

        await randomTestWithSeed(3);
    }, 100000);

    it("test with randomfschanger 4", async () => {

        await randomTestWithSeed(4);
    }, 100000);

    it("test with randomfschanger 5", async () => {

        await randomTestWithSeed(5);
    }, 100000);
});
