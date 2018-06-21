// tslint:disable:no-unused-expression
import * as chai from "chai";

import * as fse from "fs-extra";
import * as pathutils from "path";
import { runRandomFSChanger } from "randomfschanger";
import * as tmp from "tmp";
import { VError } from "verror";

import * as logger from "../../src/utils/logger";
import {MemDir} from "../../src/utils/memdir";
import { IPathTreeReadonly } from "../../src/utils/path/ipathtreereadonly";
import timeout from "../../src/utils/timeout";

const expect = chai.expect;

describe("memdir", () => {
    let tmpDir = null;
    let dir: MemDir = null;

    beforeAll(async () => {
        tmpDir = tmp.dirSync();
    });

    beforeEach(async () => {
        dir = new MemDir(tmpDir.name);
        await fse.copy(__dirname + "/../../test_directories/test_memdir", tmpDir.name);
        await timeout(1500); // make sure all changes are flushed

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

    it("test simple sync", async () => {
        await dir.sync();
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);
    });

    it("test args", async () => {
        expect(() => new MemDir(null)).to.throw(VError);
    });

    it("test lifecycle issues", async () => {
        const newDir = new MemDir(tmpDir.name);
        let except = null;
        try {
            await newDir.sync();
        } catch (e) {
            except = e;
        }

        expect(except).to.be.instanceof(VError);

        newDir.start();
        expect(() => newDir.start()).to.throw(VError);
        newDir.stop();
        expect(() => newDir.stop()).to.throw(VError);
    }, 100000);

    it("test dir removed while handling", async () => {
        await dir.sync();
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);

        const pathToAdd = pathutils.join("dir2");
        const fullPathToAdd = pathutils.join(tmpDir.name, pathToAdd);
        await fse.mkdir(fullPathToAdd);

        await timeout(1500); // make sure the event appears

        let ranInterruption = false;
        await dir._syncInterruptionSemaphoreForTesting.acquire();
        dir._syncInterruptionActionForTesting = async () => {
            ranInterruption = true;
            await fse.remove(fullPathToAdd);
            await dir._syncInterruptionSemaphoreForTesting.release();

            await timeout(1500); // make sure the removal event appears
        };

        await dir.sync();
        expect(ranInterruption).to.be.true;
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);
    }, 100000);

    it("test file removed while handling", async () => {
        await dir.sync();
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);

        const pathToAdd = pathutils.join("filenew");
        const fullPathToAdd = pathutils.join(tmpDir.name, pathToAdd);
        await fse.writeFile(fullPathToAdd, "content");

        await timeout(1500); // make sure the event appears

        let ranInterruption = false;
        await dir._syncInterruptionSemaphoreForTesting.acquire();
        dir._syncInterruptionActionForTesting = async () => {
            ranInterruption = true;
            await fse.remove(fullPathToAdd);
            await dir._syncInterruptionSemaphoreForTesting.release();

            await timeout(1500); // make sure the removal event appears
        };

        await dir.sync();
        expect(ranInterruption).to.be.true;
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);
    }, 100000);

    it("test file removed while dir is being read", async () => {
        const pathToRemove = pathutils.join("file1.txt");
        const fullPathToRemove = pathutils.join(tmpDir.name, pathToRemove);

        let ranInterruption2 = false;
        await dir._syncInterruptionSemaphoreForTesting2.acquire();
        dir._syncInterruptionActionForTesting2 = async () => {
            ranInterruption2 = true;
            await fse.remove(fullPathToRemove);
            await dir._syncInterruptionSemaphoreForTesting2.release();

            await timeout(1500); // make sure the removal event appears
        };

        await dir.sync();
        expect(ranInterruption2).to.be.true;
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);
    }, 100000);

    it("test dir and file removal", async () => {

        await dir.sync();
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);

        await fse.remove(pathutils.join(tmpDir.name, "file1.txt"));
        await timeout(1500); // make sure the removal event appears

        await dir.sync();
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);

        await fse.remove(pathutils.join(tmpDir.name, "dir"));
        await timeout(1500); // make sure the removal event appears

        await dir.sync();
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);
    }, 100000);

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
