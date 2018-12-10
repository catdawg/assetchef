// tslint:disable:no-unused-expression
import * as chai from "chai";

import * as fse from "fs-extra";
import * as pathutils from "path";
import * as tmp from "tmp";
import { VError } from "verror";

import { IPathChangeEvent, PathEventType } from "../../../src/plugin/ipathchangeevent";
import { IPathTreeReadonly } from "../../../src/plugin/ipathtreereadonly";
import { MemDir } from "../../../src/utils/fs/memdir";
import { timeout } from "../../../src/utils/timeout";

const expect = chai.expect;

async function runAndReturnError(f: () => Promise<any>): Promise<Error> {
    try {
        await f();
    } catch (e) {
        return e;
    }
    return null;
}

describe("memdir", () => {
    let tmpDir: tmp.SynchrounousResult = null;
    let dir: MemDir = null;
    let unlistenMemDirOutOfSyncToken: {unlisten: () => void} = null;
    let memDirOutOfSync = false;

    beforeAll(async () => {
        tmpDir = tmp.dirSync();
    });

    beforeEach(async () => {
        dir = new MemDir(tmpDir.name);
        const path = pathutils.join("..", "..", "..", "test_directories", "test_memdir");
        const absolutePath = pathutils.resolve(__dirname, path);
        await fse.copy(absolutePath, tmpDir.name);
        await timeout(1500); // make sure all changes are flushed

        await dir.start();

        unlistenMemDirOutOfSyncToken = dir.listenOutOfSync(() => {
            memDirOutOfSync = true;
        });
    });

    afterEach(async () => {
        dir.stop();

        const files = await fse.readdir(tmpDir.name);
        for (const file of files) {
            const fullPath = pathutils.join(tmpDir.name, file);
            await fse.remove(fullPath);
        }
        await timeout(1500); // make sure all changes are flushed

        unlistenMemDirOutOfSyncToken.unlisten();
    });

    afterAll( async () => {
        await fse.remove(tmpDir.name);
    });

    async function checkTreeReflectActualDirectory(
        pathTree: IPathTreeReadonly<Buffer>,
        path: string,
    ): Promise<string> {
        let rootStat = null;

        try {
            rootStat = await fse.stat(path);
        // tslint:disable-next-line:no-empty
        } catch (e) {}

        expect(rootStat != null).to.be.equal(pathTree.exists(""));

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
        expect(dir.isOutOfSync()).to.be.false;
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);

        const pathToAdd = pathutils.join("filenew");
        const fullPathToAdd = pathutils.join(tmpDir.name, pathToAdd);
        await fse.writeFile(fullPathToAdd, "content");

        await timeout(2000); // make sure all changes are flushed
        expect(memDirOutOfSync).to.be.true;
        expect(dir.isOutOfSync()).to.be.true;
        memDirOutOfSync = false;
        await dir.sync();
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);

        dir.reset();
        expect(dir.isOutOfSync()).to.be.true;
        expect(memDirOutOfSync).to.be.true;
        await dir.sync();
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);
        expect(memDirOutOfSync).to.be.true;
    });

    it("test content", async () => {
        let lastEv: IPathChangeEvent = null;
        const unlistenChanges = dir.content.listenChanges((ev: IPathChangeEvent) => {
            lastEv = ev;
        });

        await dir.sync();
        const listAll = [...dir.content.listAll()];
        const list = [...dir.content.list("")];

        memDirOutOfSync = false;

        const pathToAdd = pathutils.join("filenew");
        const fullPathToAdd = pathutils.join(tmpDir.name, pathToAdd);
        await fse.writeFile(fullPathToAdd, "content");

        await timeout(2000); // make sure all changes are flushed

        expect(memDirOutOfSync).to.be.true;
        await dir.sync();

        const newListAll = [...dir.content.listAll()];
        const newList = [...dir.content.list("")];

        listAll.push(pathToAdd);
        list.push(pathToAdd);

        expect(newListAll).to.have.same.members(listAll, "must have same entries in all");
        expect(newList).to.have.same.members(list, "must have same entries in root");

        expect(lastEv.eventType).to.equal(PathEventType.Add);
        expect(lastEv.path).to.equal(pathToAdd);
        lastEv = null;
        unlistenChanges.unlisten();

        memDirOutOfSync = false;
        await fse.remove(fullPathToAdd);
        await timeout(2000); // make sure all changes are flushed
        expect(memDirOutOfSync).to.be.true;
        await dir.sync();
        expect(lastEv).to.equal(null);
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

        expect(runAndReturnError(async () => {await newDir.sync(); })).to.be.instanceof(VError);

        except = null;
        try {
            await newDir.syncOne();
        } catch (e) {
            except = e;
        }

        expect(() => newDir.reset()).to.throw(VError);
        await newDir.start();
        expect(runAndReturnError(async () => {await newDir.start(); })).to.be.instanceof(VError);
        newDir.stop();
        expect(() => newDir.stop()).to.throw(VError);
        expect(() => newDir.reset()).to.throw(VError);
    }, 100000);

    it("test dir removed while handling", async () => {
        await dir.sync();
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);

        const pathToAdd = pathutils.join("dir2");
        const fullPathToAdd = pathutils.join(tmpDir.name, pathToAdd);
        await fse.mkdir(fullPathToAdd);

        await timeout(1500); // make sure the event appears

        let ranInterruption = false;
        dir._syncActionForTestingBeforeDirRead = async () => {
            ranInterruption = true;
            await fse.remove(fullPathToAdd);

            await timeout(1500); // make sure the removal event appears
        };

        await dir.sync();
        expect(ranInterruption).to.be.true;
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);
    }, 100000);

    it("test dir removed while handling2", async () => {
        await dir.sync();
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);

        const pathToAdd = pathutils.join("dir2");
        const fullPathToAdd = pathutils.join(tmpDir.name, pathToAdd);
        await fse.mkdir(fullPathToAdd);

        await timeout(1500); // make sure the event appears

        let ranInterruption = false;
        dir._syncActionMidProcessing = async () => {

            ranInterruption = true;
            await fse.remove(fullPathToAdd);

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
        dir._syncActionForTestingBeforeFileRead = async () => {
            ranInterruption = true;
            await fse.remove(fullPathToAdd);

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
        dir._syncActionForTestingBeforeStat = async () => {
            ranInterruption2 = true;
            await fse.remove(fullPathToRemove);

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
        expect(memDirOutOfSync).to.be.true;
        memDirOutOfSync = false;

        await dir.sync();
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);

        await fse.remove(pathutils.join(tmpDir.name, "dir"));
        await timeout(1500); // make sure the removal event appears

        expect(memDirOutOfSync).to.be.true;
        memDirOutOfSync = false;
        await dir.sync();
        await checkTreeReflectActualDirectory(dir.content, tmpDir.name);
    }, 100000);
});
