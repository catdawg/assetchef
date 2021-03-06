import * as fse from "fs-extra";
import { VError } from "verror";

import { addPrefixToLogger } from "../../src/comm/addprefixtologger";
import { ILogger } from "../../src/comm/ilogger";
import { IPathChangeEvent, PathEventType } from "../../src/path/ipathchangeevent";
import { PathUtils } from "../../src/path/pathutils";
import { timeout } from "../../src/testutils/timeout";
import { TmpFolder } from "../../src/testutils/tmpfolder";
import { winstonlogger } from "../../src/testutils/winstonlogger";
import { ICancelWatch } from "../../src/watch/ifswatch";

import { WatchmanFSWatch } from "../../src/watch/fswatch_watchman";

const DEFAULT_TIMEOUT = 3000;

describe("fs_watchman", () => {

    let tmpDirPath: string = null;
    let currentCallback: (ev: IPathChangeEvent) => void = null;
    let resetHappened = false;
    let projWatch: WatchmanFSWatch;
    let cancel: ICancelWatch;
    beforeAll(async () => {
        tmpDirPath = TmpFolder.generate();
        winstonlogger.logInfo("fs_watchman test using %s", tmpDirPath);
        await fse.remove(tmpDirPath);
        await fse.mkdirs(tmpDirPath);
    }, 10000);
    beforeEach(async () => {
        await setupWatch(winstonlogger, tmpDirPath);
        const path = PathUtils.join("..", "..", "test_directories", "test_projectwatch");
        const absolutePath = PathUtils.resolve(__dirname, path);
        await fse.copy(absolutePath, tmpDirPath);
        await timeout(DEFAULT_TIMEOUT); // make sure all changes are flushed
    }, 10000);

    afterEach(async () => {
        projWatch.cancel();
        const files = await fse.readdir(tmpDirPath);

        for (const file of files) {
            fse.remove(PathUtils.join(tmpDirPath, file));
        }
        await timeout(DEFAULT_TIMEOUT); // make sure all changes are flushed
    }, 10000);

    afterAll(async () => {
        await fse.remove(tmpDirPath);
    }, 10000);

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

                expect(ev.path).toEqual(expectedPath);
                currentCallback = null;
                worked = true;
                doneCalled = true;
                resolve();
            };

            await changeMethod();

            await timeout(DEFAULT_TIMEOUT);
            if (!doneCalled) {
                currentCallback = null;
                worked = false;
                resolve();
            }
        });

        if (!worked) {
            throw new VError("expected ev: " + expectedEvent + " on path: " + expectedPath);
        }
    }

    async function testNothingShouldHappen() {
        await new Promise(async (resolve) => {
            currentCallback = () => {
                resolve(new Error("shouldn't have changed"));
            };

            await timeout(DEFAULT_TIMEOUT);
            currentCallback = null;
            resolve();
        });
    }

    async function setupWatch(logger: ILogger, path: string) {
        projWatch = await WatchmanFSWatch.watchPath(logger, path);
        cancel = projWatch.addListener( {
            onEvent: (ev) => {
                if (currentCallback != null) {
                    currentCallback(ev);
                }
            },
            onReset: () => {
                resetHappened = true;
                return;
            },
        });
        resetHappened = false;
    }

    it("test parameters", async () => {
        await expect(WatchmanFSWatch.watchPath(null, null)).rejects.toThrow();
        await expect(WatchmanFSWatch.watchPath(winstonlogger, null)).rejects.toThrow();
        await expect(WatchmanFSWatch.watchPath(null, tmpDirPath)).rejects.toThrow();
        expect(() => projWatch.addListener(null)).toThrow();
    }, 10000);

    it("file change should trigger", async () => {
        const path = PathUtils.join("file1.txt");
        const fullPath = PathUtils.join(tmpDirPath, path);
        return await testOnePathChange(async () => {
            await fse.appendFile(fullPath, "some content");
        }, PathEventType.Change, path);
    }, 10000);

    it("file change inside dir should trigger", async () => {
        const path = PathUtils.join("dir", "file2.txt");
        const fullPath = PathUtils.join(tmpDirPath, path);
        return await testOnePathChange(async () => {
            await fse.appendFile(fullPath, "some content");
        }, PathEventType.Change, path);
    }, 10000);

    it("add file change should trigger", async () => {
        const path = PathUtils.join("newfile.txt");
        const fullPath = PathUtils.join(tmpDirPath, path);
        return await testOnePathChange(async () => {
            await fse.writeFile(fullPath, "something");
        }, PathEventType.Add, path);
    }, 10000);

    it("add dir change should trigger", async () => {
        const path = PathUtils.join("newdir");
        const fullPath = PathUtils.join(tmpDirPath, path);
        return await testOnePathChange(async () => {
            await fse.mkdir(fullPath);
        }, PathEventType.AddDir, path);
    }, 10000);

    it("remove dir change should trigger", async () => {
        const path = PathUtils.join("dir");
        const fullPath = PathUtils.join(tmpDirPath, path);
        return await testOnePathChange(async () => {
            await fse.remove(fullPath);
        }, PathEventType.UnlinkDir, path);
    }, 10000);

    it("remove file change should trigger", async () => {
        const path = PathUtils.join("file1.txt");
        const fullPath = PathUtils.join(tmpDirPath, path);
        return await testOnePathChange(async () => {
            await fse.remove(fullPath);
        }, PathEventType.Unlink, path);
    }, 10000);

    it("no event after cancel", async () => {
        cancel.unlisten();
        await timeout(DEFAULT_TIMEOUT);
        const path = PathUtils.join("dir");
        const fullPath = PathUtils.join(tmpDirPath, path);
        currentCallback = () => {
            throw new Error("shouldn't have changed");
        };
        await fse.remove(fullPath);

        await timeout(DEFAULT_TIMEOUT);
        currentCallback = null;
        expect (true).toBeTrue();
    }, 20000);

    it("no change should not trigger", async () => {
        await testNothingShouldHappen();
    }, 10000);

    it("proj dir doesn't exist", async () => {
        projWatch.cancel();
        const path = PathUtils.join("dirtest");
        const fullPath = PathUtils.join(tmpDirPath, path);

        await setupWatch(addPrefixToLogger(winstonlogger, "subprojwatch: "), fullPath);

        await testOnePathChange(async () => {
            await fse.mkdir(fullPath);
        }, PathEventType.AddDir, "");
        await timeout(DEFAULT_TIMEOUT);
        await testOnePathChange(async () => {
            await fse.remove(fullPath);
        }, PathEventType.UnlinkDir, "");
        await timeout(DEFAULT_TIMEOUT);
        await testOnePathChange(async () => {
            await fse.mkdir(fullPath);
        }, PathEventType.AddDir, "");
        await timeout(DEFAULT_TIMEOUT);
        await testOnePathChange(async () => {
            await fse.writeFile(PathUtils.join(fullPath, "file"), "content");
        }, PathEventType.Add, "file");
    }, 30000);

    it("proj starts as file", async () => {
        projWatch.cancel();
        const path = PathUtils.join("filetest");
        const fullPath = PathUtils.join(tmpDirPath, path);

        await fse.writeFile(fullPath, "content");
        await timeout(DEFAULT_TIMEOUT);
        await setupWatch(addPrefixToLogger(winstonlogger, "subprojwatch: "), fullPath);
        await timeout(DEFAULT_TIMEOUT);
        await testOnePathChange(async () => {
            await fse.writeFile(fullPath, "content2");
        }, PathEventType.Change, "");
    }, 30000);

    it("proj is file", async () => {
        projWatch.cancel();
        const path = PathUtils.join("filetest");
        const fullPath = PathUtils.join(tmpDirPath, path);

        await setupWatch(addPrefixToLogger(winstonlogger, "subprojwatch: "), fullPath);

        await testOnePathChange(async () => {
            await fse.writeFile(fullPath, "content");
        }, PathEventType.Add, "");
        await timeout(DEFAULT_TIMEOUT);
        await testOnePathChange(async () => {
            await fse.remove(fullPath);
        }, PathEventType.Unlink, "");
        await timeout(DEFAULT_TIMEOUT);
        await testOnePathChange(async () => {
            await fse.writeFile(fullPath, "content");
        }, PathEventType.Add, "");
        await timeout(DEFAULT_TIMEOUT);
        await testOnePathChange(async () => {
            await fse.writeFile(PathUtils.join(fullPath), "content2");
        }, PathEventType.Change, "");
        await fse.remove(fullPath);
        await timeout(DEFAULT_TIMEOUT);
        await testOnePathChange(async () => {
            await fse.mkdir(fullPath);
        }, PathEventType.AddDir, "");
        await timeout(DEFAULT_TIMEOUT);
        await testOnePathChange(async () => {
            await fse.writeFile(PathUtils.join(fullPath, "file"), "content");
        }, PathEventType.Add, "file");
    }, 30000);

    it("proj goes from file to dir", async () => {
        projWatch.cancel();
        const path = PathUtils.join("filetest");
        const fullPath = PathUtils.join(tmpDirPath, path);

        await setupWatch(addPrefixToLogger(winstonlogger, "subprojwatch: "), fullPath);

        await testOnePathChange(async () => {
            await fse.writeFile(fullPath, "content");
        }, PathEventType.Add, "");
        await timeout(DEFAULT_TIMEOUT + 500);
        await testOnePathChange(async () => {
            await fse.remove(fullPath);
            await fse.mkdir(fullPath);
        }, PathEventType.AddDir, "");
    }, 30000);

    it("proj goes from dir to file", async () => {
        projWatch.cancel();
        const path = PathUtils.join("dirtest");
        const fullPath = PathUtils.join(tmpDirPath, path);

        await setupWatch(addPrefixToLogger(winstonlogger, "subprojwatch: "), fullPath);

        await testOnePathChange(async () => {
            await fse.mkdir(fullPath);
        }, PathEventType.AddDir, "");
        await timeout(DEFAULT_TIMEOUT + 500);
        await testOnePathChange(async () => {
            await fse.remove(fullPath);
            await fse.writeFile(fullPath, "content");
        }, PathEventType.Add, "");
    }, 30000);

    it("quick deletion of root", async () => {
        projWatch.cancel();
        const path = PathUtils.join("dirtest");
        const fullPath = PathUtils.join(tmpDirPath, path);

        await setupWatch(addPrefixToLogger(winstonlogger, "subprojwatch: "), fullPath);

        await testOnePathChange(async () => {
            await fse.mkdir(fullPath);
        }, PathEventType.AddDir, "");
        await fse.remove(fullPath);
        await timeout(DEFAULT_TIMEOUT);
        await testOnePathChange(async () => {
            await fse.mkdir(fullPath);
        }, PathEventType.AddDir, "");
        await timeout(DEFAULT_TIMEOUT);
        await testOnePathChange(async () => {
            await fse.writeFile(PathUtils.join(fullPath, "file"), "content");
        }, PathEventType.Add, "file");
    }, 30000);

    it("cancel while polling", async () => {
        projWatch.cancel();
        const path = PathUtils.join("dirtest");
        const fullPath = PathUtils.join(tmpDirPath, path);

        await setupWatch(addPrefixToLogger(winstonlogger, "subprojwatch: "), fullPath);

        projWatch.cancel();

        await testNothingShouldHappen();

        await fse.mkdir(fullPath);

        await testNothingShouldHappen();

    }, 10000);

    it("kill process", async () => {
        const path = PathUtils.join("newfile.txt");
        const fullPath = PathUtils.join(tmpDirPath, path);
        await testOnePathChange(async () => {
            await fse.writeFile(fullPath, "content");
        }, PathEventType.Add, path);

        expect (resetHappened).toBeFalse();
        (projWatch as any).childProcess.kill();

        await timeout (DEFAULT_TIMEOUT * 2);
        expect (resetHappened).toBeTrue();

        await testOnePathChange(async () => {
            await fse.remove(fullPath);
        }, PathEventType.Unlink, path);
    }, 10000);

    // has to be the last
    it("test cancel twice", () => {
        cancel.unlisten();
        cancel.unlisten();
    }, 10000);
});
