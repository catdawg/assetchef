// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as fse from "fs-extra";
import * as pathutils from "path";
import * as tmp from "tmp";
import { VError } from "verror";

import { IPathChangeEvent, PathEventType } from "../../../src/plugin/ipathchangeevent";
import { DirWatcher } from "../../../src/utils/fs/dirwatcher";
import { timeout } from "../../../src/utils/timeout";

const DEFAULT_TIMEOUT = 3000;

async function runAndReturnError(f: () => Promise<any>): Promise<Error> {
    try {
        await f();
    } catch (e) {
        return e;
    }
    return null;
}

describe("dirwatcher", () => {

    let tmpDir: tmp.SynchrounousResult = null;
    let currentCallback: (ev: IPathChangeEvent) => void = null;
    let cancel: {cancel: () => void};
    beforeAll(async () => {
        tmpDir = tmp.dirSync();
        cancel = await DirWatcher.watch(
            tmpDir.name,
            (ev) => {
                if (currentCallback != null) {
                    currentCallback(ev);
                }
            },
            () => {
                return;
            },
        );
    });
    beforeEach(async () => {
        const path = pathutils.join("..", "..", "..", "test_directories", "test_dirwatcher");
        const absolutePath = pathutils.resolve(__dirname, path);
        await fse.copy(absolutePath, tmpDir.name);
        await timeout(1500); // make sure all changes are flushed
    });

    afterEach(async () => {
        const files = await fse.readdir(tmpDir.name);

        for (const file of files) {
            fse.remove(pathutils.join(tmpDir.name, file));
        }
        await timeout(1500); // make sure all changes are flushed
    });

    afterAll((done) => {
        cancel.cancel();
        fse.remove(tmpDir.name, done);
    });

    /**
     * Triggers the change method, and checks if the watch triggers the change
     * @param {function} changeMethod - The method that changes
     * @param {PathChangeEvent.PathEventType} expectedEvent - The expected event
     * @param {string} expectedPath - The expected path for the event
     * @returns {Promise<void>} the promise
     */
    async function testOnePathChange(
        changeMethod: () => Promise<void>,
        expectedEvent: PathEventType,
        expectedPath: string) {
        let worked = false;
        await new Promise (async (resolve) => {

            let doneCalled = false;
            currentCallback = (ev) => {
                if (ev.eventType !== expectedEvent) {
                    return;
                }

                expect(ev.path).to.be.equal(expectedPath);
                currentCallback = null;
                worked = true;
                resolve();
            };

            await changeMethod();

            await timeout(DEFAULT_TIMEOUT);
            if (!doneCalled) {
                currentCallback = null;
                doneCalled = true;
                worked = false;
                resolve();
            }
        });

        expect(worked).to.be.true;
    }

    it("test parameters", async () => {
        expect(await runAndReturnError(async () => {
            cancel = await DirWatcher.watch(
                null,
                null,
                null,
            );
        })).to.not.be.null;

        expect(await runAndReturnError(async () => {
            cancel = await DirWatcher.watch(
                tmpDir.name,
                null,
                null,
            );
        })).to.not.be.null;

        expect(await runAndReturnError(async () => {
            cancel = await DirWatcher.watch(
                tmpDir.name,
                (ev) => {
                    if (currentCallback != null) {
                        currentCallback(ev);
                    }
                },
                null,
            );
        })).to.not.be.null;
    });

    it("file change should trigger", async () => {
        const path = pathutils.join("file1.txt");
        const fullPath = pathutils.join(tmpDir.name, path);
        return await testOnePathChange(async () => {
            await fse.appendFile(fullPath, "some content");
        }, PathEventType.Change, path);
    });

    it("file change inside dir should trigger", async () => {
        const path = pathutils.join("dir", "file2.txt");
        const fullPath = pathutils.join(tmpDir.name, path);
        return await testOnePathChange(async () => {
            await fse.appendFile(fullPath, "some content");
        }, PathEventType.Change, path);
    });

    it("add file change should trigger", async () => {
        const path = pathutils.join("newfile.txt");
        const fullPath = pathutils.join(tmpDir.name, path);
        return await testOnePathChange(async () => {
            await fse.writeFile(fullPath, "something");
        }, PathEventType.Add, path);
    });

    it("add dir change should trigger", async () => {
        const path = pathutils.join("newdir");
        const fullPath = pathutils.join(tmpDir.name, path);
        return await testOnePathChange(async () => {
            await fse.mkdir(fullPath);
        }, PathEventType.AddDir, path);
    });

    it("remove dir change should trigger", async () => {
        const path = pathutils.join("dir");
        const fullPath = pathutils.join(tmpDir.name, path);
        return await testOnePathChange(async () => {
            await fse.remove(fullPath);
        }, PathEventType.UnlinkDir, path);
    });

    it("remove file change should trigger", async () => {
        const path = pathutils.join("file1.txt");
        const fullPath = pathutils.join(tmpDir.name, path);
        return await testOnePathChange(async () => {
            await fse.remove(fullPath);
        }, PathEventType.Unlink, path);
    });

    it("no change should not trigger", async () => {
        return await new Promise(async (resolve) => {

            currentCallback = () => {
                resolve(new Error("shouldn't have changed"));
            };

            await timeout(DEFAULT_TIMEOUT);
            currentCallback = null;
            resolve();
        });
    });

    it("dir doesn't exist", async () => {
        cancel.cancel();
        const path = pathutils.join("dirtest");
        const fullPath = pathutils.join(tmpDir.name, path);

        cancel = await DirWatcher.watch(
            fullPath,
            (ev) => {
                if (currentCallback != null) {
                    currentCallback(ev);
                }
            },
            () => {
                return;
            },
        );

        await timeout(DEFAULT_TIMEOUT);

        await testOnePathChange(async () => {
            await fse.mkdir(fullPath);
        }, PathEventType.AddDir, "");

        await testOnePathChange(async () => {
            await fse.remove(fullPath);
        }, PathEventType.UnlinkDir, "");
    }, 10000);

    // has to be the last
    it("test cancel twice", () => {
        cancel.cancel();
        cancel.cancel();
    });
});
