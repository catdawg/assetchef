// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;
import * as pathutils from "path";
import { VError } from "verror";

import { PathChangeEvent, PathEventType } from "../../src/path/pathchangeevent";
import { PathChangeProcessor, ProcessCommitMethod} from "../../src/path/pathchangeprocessor";
import { PathChangeQueue } from "../../src/path/pathchangequeue";
import { PathTree } from "../../src/path/pathtree";

describe("pathchangeprocessor", () => {

    let sourceTree: PathTree<string>;
    let targetTree: PathTree<string>;

    let pathChangeQueue: PathChangeQueue;
    let pathChangeProcessor: PathChangeProcessor;

    beforeEach(async () => {
        sourceTree = new PathTree<string>();
        targetTree = new PathTree<string>();
        pathChangeQueue = new PathChangeQueue(() => {
            pathChangeQueue.push(new PathChangeEvent(PathEventType.AddDir, ""));
        });
        sourceTree.addListener("treechanged", (ev) => pathChangeQueue.push(ev));
        pathChangeProcessor = new PathChangeProcessor(pathChangeQueue);
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

    it("constructor", async () => {
        expect(() => new PathChangeProcessor(null)).to.throw(VError);
    });

    it("simple processAll", async () => {
        const p1 = pathutils.join("dir", "file.txt");
        const p2 = pathutils.join("dir", "file2.txt");
        const p3 = pathutils.join("file3.txt");
        sourceTree.set(p1, "content1");
        sourceTree.set(p2, "content2");
        sourceTree.set(p3, "content3");

        let res = await pathChangeProcessor.processAll(getCopyHandler());
        expect(res.error == null).to.be.true;
        compareTrees(sourceTree, targetTree);

        sourceTree.set(p1, "content changed");

        res = await pathChangeProcessor.processAll(getCopyHandler());
        expect(res.error == null).to.be.true;
        compareTrees(sourceTree, targetTree);

        sourceTree.remove(p2);

        res = await pathChangeProcessor.processAll(getCopyHandler());
        expect(res.error == null).to.be.true;
        compareTrees(sourceTree, targetTree);

        sourceTree.remove("dir");

        res = await pathChangeProcessor.processAll(getCopyHandler());
        expect(res.error == null).to.be.true;
        compareTrees(sourceTree, targetTree);
    });

    it("list fails", async () => {
        const p1 = pathutils.join("dir", "file.txt");
        const p2 = pathutils.join("dir", "file2.txt");
        sourceTree.set(p1, "content1");
        sourceTree.set(p2, "content2");

        const handler = getCopyHandler();
        handler.list = async (p) => {
            return null;
        };

        const res = await pathChangeProcessor.processAll(handler);
        expect(res.error != null).to.be.true;
    }, 100000);

    it("isDir fails", async () => {
        const p1 = pathutils.join("dir", "file.txt");
        const p2 = pathutils.join("dir", "file2.txt");
        sourceTree.set(p1, "content1");
        sourceTree.set(p2, "content2");

        const handler = getCopyHandler();
        handler.isDir = async (p) => {
            return null;
        };

        const res = await pathChangeProcessor.processAll(handler);
        expect(res.error != null).to.be.true;
    }, 100000);

    it("obsolete test", async () => {
        const p2 = pathutils.join("file2.txt");
        sourceTree.set(p2, "content2");

        let res = await pathChangeProcessor.processAll(getCopyHandler());
        expect(res.error == null).to.be.true;

        const p1 = pathutils.join("dir", "file.txt");
        sourceTree.set(p1, "content1");

        pathChangeProcessor._debugActionAfterProcess = async () => {
            sourceTree.remove("dir");
        };
        res = await pathChangeProcessor.processAll(getCopyHandler());
        expect(res.error == null).to.be.true;
        compareTrees(sourceTree, targetTree);
    }, 100000);

    it("retry test", async () => {
        const p2 = pathutils.join("file2.txt");
        sourceTree.set(p2, "content2");

        let res = await pathChangeProcessor.processAll(getCopyHandler());
        expect(res.error == null).to.be.true;

        const p1 = pathutils.join("dir", "file.txt");
        sourceTree.set(p1, "content1");

        pathChangeProcessor._debugActionAfterProcess = async () => {
            sourceTree.set(p1, "content2");
        };
        res = await pathChangeProcessor.processAll(getCopyHandler());
        expect(res.error == null).to.be.true;
        compareTrees(sourceTree, targetTree);
    }, 100000);
});
