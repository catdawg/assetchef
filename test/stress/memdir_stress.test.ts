// tslint:disable:no-unused-expression
import * as chai from "chai";

import * as fse from "fs-extra";
import * as pathutils from "path";
import { RandomFSChanger } from "randomfschanger";
import * as tmp from "tmp";

import { IPathTreeReadonly } from "../../src/plugin/ipathtreereadonly";
import { MemDir } from "../../src/utils/fs/memdir";
import { timeout } from "../../src/utils/timeout";
import logger from "../../src/utils/winstonlogger";

const expect = chai.expect;

describe("stress memdir", () => {
    let tmpDir: tmp.SynchrounousResult = null;
    let dir: MemDir = null;

    beforeEach(async () => {
        tmpDir = tmp.dirSync();
        dir = new MemDir(tmpDir.name);
        dir.start();
    });

    afterEach(async () => {
        dir.stop();
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

            expect(pathsInMem).to.have.same.members(pathsInFs, " must have same entries in directory " + directory);

            for (const p of pathsInFs) {
                const fullPath = pathutils.join(path, directory, p);
                const relativePath = pathutils.join(directory, p);

                const isDirInMem = pathTree.isDir(relativePath);
                const isDirInFs = (await fse.stat(fullPath)).isDirectory();

                expect(isDirInMem).to.be.equal(isDirInFs, "most both be the same, file or directory " + relativePath);

                if (isDirInFs) {
                    directoriesToVist.push(relativePath);
                } else {
                    const contentInFs = await fse.readFile(pathutils.join(path, directory, p));
                    const contentInMem = pathTree.get(relativePath);

                    expect(contentInFs).to.deep.equal(contentInMem, "must have same content " + relativePath);
                }
            }
        }
    }

    async function randomTest() {

        await dir.sync();
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);

        const randomFSChanger = new RandomFSChanger(tmpDir.name, {
            log: (str: string) => {
                logger.logInfo("[randomfschanger] %s", str);
            },
        });
        let finish = false;
        await Promise.all([(async () => {
            randomFSChanger.start();

            await new Promise((resolve) => {
                setTimeout(resolve, 5 * 60 * 1000);
            });
            finish = true;
        })(), (async () => {
            while (!finish) {
                await dir.sync();
                if (dir.isOutOfSync()) { // could have failed
                    continue;
                }
                try {
                    await checkTreeReflectActualDirectory(dir.content, tmpDir.name);
                    logger.logInfo("!!!!Sync successful in the middle of random FSChanges!!!!");
                } catch (e) {
                    await timeout(2500);
                    if (!dir.isOutOfSync()) {
                        throw e;
                    }
                }
                await timeout(2500);
            }

            while (dir.isOutOfSync()) {
                await dir.sync();
            }
        })()]);
        await randomFSChanger.stop();
        await timeout(2500);
        while (dir.isOutOfSync()) {
            await dir.sync();
        }
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);
        await timeout(2500);
    }

    it("test with randomfschanger", async () => {
        await randomTest();
    }, 60000000);
});