// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;
import { VError } from "verror";

import { PathEventType } from "../../src/path/ipathchangeevent";
import { getCallTrackingLogger } from "../../src/testutils/loggingtracer";
import { winstonlogger } from "../../src/testutils/winstonlogger";

import { PathChangeProcessingUtils, ProcessCommitMethod } from "../../src/path/pathchangeprocessingutils";
import { PathChangeQueue } from "../../src/path/pathchangequeue";
import { PathTree } from "../../src/path/pathtree";
import { PathUtils } from "../../src/path/pathutils";

describe("pathchangeprocessor", () => {

    let sourceTree: PathTree<string>;
    let targetTree: PathTree<string>;

    let pathChangeQueue: PathChangeQueue;

    beforeEach(async () => {
        sourceTree = new PathTree<string>();
        targetTree = new PathTree<string>();
        pathChangeQueue = new PathChangeQueue(() => {
            if (sourceTree.exists("")) {
                pathChangeQueue.push({eventType: PathEventType.AddDir, path: ""});
            } else {
                pathChangeQueue.push({eventType: PathEventType.UnlinkDir, path: ""});
            }
        }, winstonlogger);
        sourceTree.listenChanges((ev) => pathChangeQueue.push(ev));
    });

    const fileAddedAndChangedHandler = async (path: string): Promise<ProcessCommitMethod> => {
        let filecontent: string = null;
        try {
            filecontent = sourceTree.get(path);
        } catch (err) {
            return null;
        }

        return () => {
            targetTree.set(path, filecontent);
        };
    };

    const pathRemovedHandler = async (path: string): Promise<ProcessCommitMethod> => {
        return () => {
            targetTree.remove(path);
        };
    };

    const getCopyHandler = () =>  {
        return {
            handleFileAdded: fileAddedAndChangedHandler,
            handleFileChanged: fileAddedAndChangedHandler,
            handleFileRemoved: pathRemovedHandler,
            handleFolderAdded: async (path: string): Promise<ProcessCommitMethod> => {
                return () => {
                    if (targetTree.exists(path)) {
                        targetTree.remove(path);
                    }
                    targetTree.mkdir(path);
                };
            },
            handleFolderRemoved: pathRemovedHandler,
            isDir: async (path: string): Promise<boolean> => {
                try {
                    return sourceTree.isDir(path);
                } catch (err) {
                    return null;
                }
            },
            list: async (path: string): Promise<string[]> => {
                try {
                    return [...sourceTree.list(path)];
                } catch (err) {
                    return null;
                }
            },
        };
    };

    const compareTrees = (tree1: PathTree<string>, tree2: PathTree<string>) => {
        const list1 = [...tree1.listAll()];
        const list2 = [...tree2.listAll()];

        expect(list1).to.have.same.members(list2);

        list1.sort();
        list2.sort();

        for (const p of list1) {
            if (tree1.isDir(p)) {
                expect(tree2.isDir(p)).to.be.true;
            } else {
                expect(tree1.get(p)).to.be.equal(tree2.get(p));
            }
        }
    };

    it("null", async () => {
        let except = null;
        try {
            await PathChangeProcessingUtils.processAll(null, null, null);
        } catch (e) {
            except = e;
        }

        expect(except).to.be.instanceof(VError);

        try {
            await PathChangeProcessingUtils.processOne(null, null, null);
        } catch (e) {
            except = e;
        }

        expect(except).to.be.instanceof(VError);
        try {
            await PathChangeProcessingUtils.processAll(pathChangeQueue, null, null);
        } catch (e) {
            except = e;
        }

        expect(except).to.be.instanceof(VError);

        try {
            await PathChangeProcessingUtils.processOne(pathChangeQueue, null, null);
        } catch (e) {
            except = e;
        }

        expect(except).to.be.instanceof(VError);

        try {
            await PathChangeProcessingUtils.processAll(pathChangeQueue, getCopyHandler(), null);
        } catch (e) {
            except = e;
        }

        expect(except).to.be.instanceof(VError);

        try {
            await PathChangeProcessingUtils.processOne(pathChangeQueue, getCopyHandler(), null);
        } catch (e) {
            except = e;
        }

        expect(except).to.be.instanceof(VError);

        try {
            await PathChangeProcessingUtils.processOne(pathChangeQueue, getCopyHandler(), winstonlogger, null);
        } catch (e) {
            except = e;
        }

        expect(except).to.be.instanceof(VError);
    });

    it("simple processOne", async () => {
        const p1 = PathUtils.join("dir");
        sourceTree.mkdir(p1);

        let res = await PathChangeProcessingUtils.processOne(
            pathChangeQueue, getCopyHandler(), winstonlogger); // creates the root
        res = await PathChangeProcessingUtils.processOne(
            pathChangeQueue, getCopyHandler(), winstonlogger); // processes the p1
        expect(res).to.be.true;
        compareTrees(sourceTree, targetTree);
    });

    it("simple processOne nothing to do", async () => {
        const res = await PathChangeProcessingUtils.processOne(
            pathChangeQueue, getCopyHandler(), winstonlogger);
        expect(res).to.be.true;
        compareTrees(sourceTree, targetTree);
    });

    it("simple processAll", async () => {
        const p1 = PathUtils.join("dir", "file.txt");
        const p2 = PathUtils.join("dir", "file2.txt");
        const p3 = PathUtils.join("file3.txt");
        sourceTree.set(p1, "content1");
        sourceTree.set(p2, "content2");
        sourceTree.set(p3, "content3");

        let res = await PathChangeProcessingUtils.processAll(pathChangeQueue, getCopyHandler(), winstonlogger);
        expect(res).to.be.true;
        compareTrees(sourceTree, targetTree);

        sourceTree.set(p1, "content changed");

        res = await PathChangeProcessingUtils.processAll(pathChangeQueue, getCopyHandler(), winstonlogger);
        expect(res).to.be.true;
        compareTrees(sourceTree, targetTree);

        sourceTree.remove(p2);

        res = await PathChangeProcessingUtils.processAll(pathChangeQueue, getCopyHandler(), winstonlogger);
        expect(res).to.be.true;
        compareTrees(sourceTree, targetTree);

        sourceTree.remove("dir");

        res = await PathChangeProcessingUtils.processAll(pathChangeQueue, getCopyHandler(), winstonlogger);
        expect(res).to.be.true;
        compareTrees(sourceTree, targetTree);
    });

    it("list fails", async () => {
        const p1 = PathUtils.join("dir", "file.txt");
        const p2 = PathUtils.join("dir", "file2.txt");
        sourceTree.set(p1, "content1");
        sourceTree.set(p2, "content2");

        const handler = getCopyHandler();
        handler.list = async (p) => {
            return null;
        };

        const tracedLogger = getCallTrackingLogger(winstonlogger);
        const res = await PathChangeProcessingUtils.processAll(pathChangeQueue, handler, tracedLogger);
        expect(res).to.be.false;
        expect(tracedLogger.lastLogError()).to.be.not.null;
    }, 100000);

    it("isDir fails", async () => {
        const p1 = PathUtils.join("dir", "file.txt");
        const p2 = PathUtils.join("dir", "file2.txt");
        sourceTree.set(p1, "content1");
        sourceTree.set(p2, "content2");

        const handler = getCopyHandler();
        handler.isDir = async (p) => {
            return null;
        };

        const tracedLogger = getCallTrackingLogger(winstonlogger);
        const res = await PathChangeProcessingUtils.processAll(pathChangeQueue, handler, tracedLogger);
        expect(res).to.be.false;
        expect(tracedLogger.lastLogError()).to.be.not.null;
    }, 100000);

    it("obsolete test", async () => {
        const p2 = PathUtils.join("file2.txt");
        sourceTree.set(p2, "content2");
        sourceTree.mkdir("dir");

        let res = await PathChangeProcessingUtils.processAll(pathChangeQueue, getCopyHandler(), winstonlogger);
        expect(res).to.be.true;

        const p1 = PathUtils.join("dir", "file.txt");
        sourceTree.set(p1, "content1");

        let ran = false;
        const debugActionAfterProcess = async () => {
            if (!ran) {
                sourceTree.remove(p1);
                ran = true;
            }
        };
        // this will obsolete the add "dir/file.txt"
        res = await PathChangeProcessingUtils.processOne(
            pathChangeQueue, getCopyHandler(), winstonlogger, debugActionAfterProcess);
        expect(res).to.be.true;
        compareTrees(sourceTree, targetTree);
    }, 100000);

    it("retry test", async () => {
        const p2 = PathUtils.join("file2.txt");
        sourceTree.set(p2, "content2");
        sourceTree.mkdir("dir");

        let res = await PathChangeProcessingUtils.processAll(pathChangeQueue, getCopyHandler(), winstonlogger);
        expect(res).to.be.true;

        const p1 = PathUtils.join("dir", "file.txt");
        sourceTree.set(p1, "content1");

        let ran = false;
        const debugActionAfterProcess = async () => {
            if (!ran) {
                sourceTree.set(p1, "content2");
                ran = true;
            }
        };

        // this will retry the add "dir/file.txt"
        res = await PathChangeProcessingUtils.processOne(
            pathChangeQueue, getCopyHandler(), winstonlogger, debugActionAfterProcess);
        expect(ran).to.be.true;
        expect(res).to.be.true;
        compareTrees(sourceTree, targetTree);
    }, 100000);

    it("parameters test", async () => {
        const setup = () => {
            if (sourceTree.exists("")) {
                sourceTree.remove("");
            }
            const p1 = PathUtils.join("file.txt");
            sourceTree.set(p1, "content1");
        };

        setup();
        let res = await PathChangeProcessingUtils.processAll(pathChangeQueue, getCopyHandler(), winstonlogger);
        expect(res).to.be.true;
        compareTrees(sourceTree, targetTree);

        setup();
        res = await PathChangeProcessingUtils.processOne(pathChangeQueue, getCopyHandler(), winstonlogger);
        expect(res).to.be.true;

        setup();
        let actionCalled = false;
        res = await PathChangeProcessingUtils.processOne(pathChangeQueue, getCopyHandler(), winstonlogger, () => {
            actionCalled = true;
        });
        expect(res).to.be.true;
        expect(actionCalled).to.be.true;
    });
});
