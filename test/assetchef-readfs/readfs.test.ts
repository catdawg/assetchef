// tslint:disable:no-unused-expression
import * as chai from "chai";

import * as fse from "fs-extra";
import * as pathutils from "path";
import { VError } from "verror";

import { ReadFSPlugin } from "../../src/assetchef-readfs/readfs";
import { ReadFSPluginInstance } from "../../src/assetchef-readfs/readfsinstance";
import { ICancelWatch } from "../../src/plugin/ifswatch";
import { IPathChangeEvent, PathEventType } from "../../src/plugin/ipathchangeevent";
import { IPathTreeReadonly } from "../../src/plugin/ipathtreereadonly";
import { IRecipePluginInstance } from "../../src/plugin/irecipeplugin";
import addPrefixToLogger from "../../src/utils/addprefixtologger";
import { MemDir } from "../../src/utils/fs/memdir";
import { PathTree } from "../../src/utils/path/pathtree";
import { timeout } from "../../src/utils/timeout";
import { WatchmanFSWatch } from "../../src/utils/watch/fswatch_watchman";
import { TmpFolder } from "../../test_utils/tmpfolder";
import winstonlogger from "../../test_utils/winstonlogger";

const expect = chai.expect;

async function runAndReturnError(f: () => Promise<any>): Promise<Error> {
    try {
        await f();
    } catch (e) {
        return e;
    }
    return null;
}

async function updateAll(instance: IRecipePluginInstance) {
    while (instance.needsUpdate()) {
        await instance.update();
    }
}

describe("readfs", () => {
    let tmpDirPath: string = null;
    let testPath: string = null;
    let readfs: ReadFSPlugin = null;
    let readfsInstance: ReadFSPluginInstance = null;
    let prevTree: PathTree<Buffer>;
    let needsProcessingCalled = false;
    let watchmanWatch: WatchmanFSWatch;
    let watchmanWatchCancel: ICancelWatch;

    beforeAll(async () => {
        tmpDirPath = await TmpFolder.generate();
        testPath = pathutils.join(tmpDirPath, "readfstest");
        watchmanWatch = await WatchmanFSWatch.watchPath(addPrefixToLogger(winstonlogger, "fswatch: "), testPath);
    });

    beforeEach(async () => {
        readfs = new ReadFSPlugin();
        readfsInstance = readfs.createInstance() as ReadFSPluginInstance;
        prevTree = new PathTree<Buffer>();
        watchmanWatchCancel = watchmanWatch.addListener(readfsInstance.projectWatchListener);
        const path = pathutils.join("..", "..", "test_directories", "test_readfs");
        const absolutePath = pathutils.resolve(__dirname, path);
        await fse.mkdir(testPath);
        await fse.copy(absolutePath, testPath);
        await timeout(1500); // make sure all changes are flushed

        await readfsInstance.setup({
            config: {
                include: [pathutils.join("**", "*")],
                includeRootAsFile: true,
            },
            logger: winstonlogger,
            needsProcessingCallback: () => {
                needsProcessingCalled = true;
            },
            prevStepTreeInterface: prevTree,
            projectPath: testPath,
        });
    });

    afterEach(async () => {
        await readfsInstance.destroy();
        const files = await fse.readdir(tmpDirPath);
        for (const file of files) {
            const fullPath = pathutils.join(tmpDirPath, file);
            await fse.remove(fullPath);
        }
        await timeout(1500); // make sure all changes are flushed

        watchmanWatchCancel.cancel();
    });

    afterAll( async () => {
        watchmanWatch.cancel();
        await fse.remove(tmpDirPath);
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
        await updateAll(readfsInstance);
        expect(readfsInstance.needsUpdate()).to.be.false;
        await checkTreeReflectActualDirectory(readfsInstance.treeInterface, testPath);

        needsProcessingCalled = false;
        const pathToAdd = pathutils.join("filenew");
        const fullPathToAdd = pathutils.join(testPath, pathToAdd);
        await fse.writeFile(fullPathToAdd, "content");

        await timeout(2000); // make sure all changes are flushed
        expect(needsProcessingCalled).to.be.true;
        expect(readfsInstance.needsUpdate()).to.be.true;
        needsProcessingCalled = false;
        await updateAll(readfsInstance);
        await checkTreeReflectActualDirectory(readfsInstance.treeInterface, testPath);

        readfsInstance.reset();
        expect(readfsInstance.needsUpdate()).to.be.true;
        expect(needsProcessingCalled).to.be.true;
        await updateAll(readfsInstance);
        await checkTreeReflectActualDirectory(readfsInstance.treeInterface, testPath);
        expect(needsProcessingCalled).to.be.true;
    });

    it("test content", async () => {
        let lastEv: IPathChangeEvent = null;
        const unlistenChanges = readfsInstance.treeInterface.listenChanges((ev: IPathChangeEvent) => {
            lastEv = ev;
        });

        await updateAll(readfsInstance);
        const listAll = [...readfsInstance.treeInterface.listAll()];
        const list = [...readfsInstance.treeInterface.list("")];

        needsProcessingCalled = false;

        const pathToAdd = pathutils.join("filenew");
        const fullPathToAdd = pathutils.join(testPath, pathToAdd);
        await fse.writeFile(fullPathToAdd, "content");

        await timeout(2000); // make sure all changes are flushed

        expect(needsProcessingCalled).to.be.true;
        await updateAll(readfsInstance);

        const newListAll = [...readfsInstance.treeInterface.listAll()];
        const newList = [...readfsInstance.treeInterface.list("")];

        listAll.push(pathToAdd);
        list.push(pathToAdd);

        expect(newListAll).to.have.same.members(listAll, "must have same entries in all");
        expect(newList).to.have.same.members(list, "must have same entries in root");

        expect(lastEv.eventType).to.equal(PathEventType.Add);
        expect(lastEv.path).to.equal(pathToAdd);
        lastEv = null;
        unlistenChanges.unlisten();

        needsProcessingCalled = false;
        await fse.remove(fullPathToAdd);
        await timeout(2000); // make sure all changes are flushed
        expect(needsProcessingCalled).to.be.true;
        await updateAll(readfsInstance);
        expect(lastEv).to.equal(null);
    });

    it("test args", async () => {
        expect(() => new MemDir(null, null)).to.throw(VError);
        expect(() => new MemDir(testPath, null)).to.throw(VError);
        expect(() => new MemDir(null, winstonlogger)).to.throw(VError);
    });

    it("test lifecycle issues", async () => {
        const newDir = new MemDir(testPath, winstonlogger);
        const cancelToken = watchmanWatch.addListener(newDir.watchListener);

        expect(await runAndReturnError(async () => {await newDir.sync(); })).to.be.instanceof(VError);
        expect(await runAndReturnError(async () => {await newDir.syncOne(); })).to.be.instanceof(VError);

        expect(() => newDir.reset()).to.throw(VError);
        newDir.start();
        expect(() => { newDir.start(); }).to.throw(VError);
        newDir.stop();
        expect(() => newDir.stop()).to.throw(VError);
        expect(() => newDir.reset()).to.throw(VError);
        cancelToken.cancel();
    }, 100000);

    it("test dir removed while handling", async () => {
        await updateAll(readfsInstance);
        await checkTreeReflectActualDirectory(readfsInstance.treeInterface, testPath);

        const pathToAdd = pathutils.join("dir2");
        const fullPathToAdd = pathutils.join(testPath, pathToAdd);
        await fse.mkdir(fullPathToAdd);

        await timeout(1500); // make sure the event appears

        let ranInterruption = false;
        readfsInstance._syncActionForTestingBeforeDirRead = async () => {
            ranInterruption = true;
            await fse.remove(fullPathToAdd);

            await timeout(1500); // make sure the removal event appears
        };

        await updateAll(readfsInstance);
        expect(ranInterruption).to.be.true;
        await checkTreeReflectActualDirectory(readfsInstance.treeInterface, testPath);
    }, 100000);

    it("test dir removed while handling2", async () => {
        await updateAll(readfsInstance);
        await checkTreeReflectActualDirectory(readfsInstance.treeInterface, testPath);

        const pathToAdd = pathutils.join("dir2");
        const fullPathToAdd = pathutils.join(testPath, pathToAdd);
        await fse.mkdir(fullPathToAdd);

        await timeout(1500); // make sure the event appears

        let ranInterruption = false;
        readfsInstance._syncActionMidProcessing = async () => {

            ranInterruption = true;
            await fse.remove(fullPathToAdd);

            await timeout(1500); // make sure the removal event appears
        };

        await updateAll(readfsInstance);
        expect(ranInterruption).to.be.true;
        await checkTreeReflectActualDirectory(readfsInstance.treeInterface, testPath);
    }, 100000);

    it("test file removed while handling", async () => {
        await updateAll(readfsInstance);
        await checkTreeReflectActualDirectory(readfsInstance.treeInterface, testPath);

        const pathToAdd = pathutils.join("filenew");
        const fullPathToAdd = pathutils.join(testPath, pathToAdd);
        await fse.writeFile(fullPathToAdd, "content");

        await timeout(1500); // make sure the event appears

        let ranInterruption = false;
        readfsInstance._syncActionForTestingBeforeFileRead = async () => {
            ranInterruption = true;
            await fse.remove(fullPathToAdd);

            await timeout(1500); // make sure the removal event appears
        };

        await updateAll(readfsInstance);
        expect(ranInterruption).to.be.true;
        await checkTreeReflectActualDirectory(readfsInstance.treeInterface, testPath);
    }, 100000);

    it("test file removed while dir is being read", async () => {
        const pathToRemove = pathutils.join("file1.txt");
        const fullPathToRemove = pathutils.join(testPath, pathToRemove);

        let ranInterruption2 = false;
        readfsInstance._syncActionForTestingBeforeStat = async () => {
            ranInterruption2 = true;
            await fse.remove(fullPathToRemove);

            await timeout(1500); // make sure the removal event appears
        };

        await updateAll(readfsInstance);
        expect(ranInterruption2).to.be.true;
        await checkTreeReflectActualDirectory(readfsInstance.treeInterface, testPath);
    }, 100000);

    it("test dir and file removal", async () => {

        await updateAll(readfsInstance);
        await checkTreeReflectActualDirectory(readfsInstance.treeInterface, testPath);

        await fse.remove(pathutils.join(testPath, "file1.txt"));
        await timeout(1500); // make sure the removal event appears
        expect(needsProcessingCalled).to.be.true;
        needsProcessingCalled = false;

        await updateAll(readfsInstance);
        await checkTreeReflectActualDirectory(readfsInstance.treeInterface, testPath);

        await fse.remove(pathutils.join(testPath, "dir"));
        await timeout(1500); // make sure the removal event appears

        expect(needsProcessingCalled).to.be.true;
        needsProcessingCalled = false;
        await updateAll(readfsInstance);
        await checkTreeReflectActualDirectory(readfsInstance.treeInterface, testPath);
    }, 100000);
    it("test file as root", async () => {
        await fse.remove(testPath);
        await timeout(1000);
        await fse.writeFile(testPath, "content");
        await timeout(2000);

        await updateAll(readfsInstance);

        expect (readfsInstance.treeInterface.exists("")).to.be.true;
        expect (readfsInstance.treeInterface.get("").toString()).to.be.equal("content");
    }, 100000);
    it("test file as root does not exist before", async () => {
        await fse.remove(testPath);

        await timeout(1000);

        await readfsInstance.reset();
        await updateAll(readfsInstance);
        expect (readfsInstance.treeInterface.exists("")).to.be.false;

        await fse.writeFile(testPath, "content");

        await timeout(2000);

        await updateAll(readfsInstance);
        expect (readfsInstance.treeInterface.exists("")).to.be.true;
        expect (readfsInstance.treeInterface.get("").toString()).to.be.equal("content");
    }, 100000);

    it("test reset edge case with file", async () => {
        await fse.remove(testPath);
        await readfsInstance.reset();
        await fse.writeFile(testPath, "content");

        await timeout(2000);

        await updateAll(readfsInstance);

        expect (readfsInstance.treeInterface.exists("")).to.be.true;
        expect (readfsInstance.treeInterface.get("").toString()).to.be.equal("content");

        await fse.remove(testPath);

        await timeout(2000);

        expect (readfsInstance.treeInterface.exists("")).to.be.true;

        await readfsInstance.reset();

        await updateAll(readfsInstance);

        expect (readfsInstance.treeInterface.exists("")).to.be.false;
    }, 100000);

    it("test reset edge case with dir", async () => {

        await updateAll(readfsInstance);

        await fse.remove(testPath);

        await timeout(2000);

        expect (readfsInstance.treeInterface.exists("")).to.be.true;

        await readfsInstance.reset();

        await updateAll(readfsInstance);

        expect (readfsInstance.treeInterface.exists("")).to.be.false;
    }, 100000);
});
