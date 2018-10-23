// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";
import * as sinon from "sinon";

import { RecipeStep } from "../../src/kitchen/recipestep";
import { ILogger } from "../../src/plugin/ilogger";
import { PathEventType } from "../../src/plugin/ipathchangeevent";
import { IPathTreeReadonly } from "../../src/plugin/ipathtreereadonly";
import { IRecipePlugin } from "../../src/plugin/irecipeplugin";
import { PathChangeProcessingUtils } from "../../src/utils/path/pathchangeprocessingutils";
import { PathChangeQueue } from "../../src/utils/path/pathchangequeue";
import { PathTree } from "../../src/utils/path/pathtree";
import winstonlogger from "../../src/utils/winstonlogger";

const getPrintingPlugin = (): IRecipePlugin => {

    let logger: ILogger = null;
    let prevTree: IPathTreeReadonly<Buffer> = null;
    let actualTree: PathTree<Buffer> = null;
    let changeQueue: PathChangeQueue = null;

    return {
        apiLevel: 1,
        configSchema: null,
        createInstance: () => {
            let treeInterface = null;
            return {
                treeInterface,
                setup: async (inLogger, config, prevStepInterface) => {
                    logger = inLogger;
                    prevTree = prevStepInterface;

                    actualTree = new PathTree();
                    changeQueue = new PathChangeQueue(() => {
                        changeQueue.push({eventType: PathEventType.AddDir, path: ""});
                    }, logger);

                    prevTree.addChangeListener((e) => {
                        changeQueue.push(e);
                    });

                    changeQueue.reset();

                    treeInterface = actualTree.getReadonlyInterface();
                },
                update: async () => {
                    const res = await PathChangeProcessingUtils.processAll(changeQueue, {
                        handleFileAdded: async (path) => {
                            const newContent = prevTree.get(path);
                            return () => {
                                logger.logInfo("file %s added.", path);
                                actualTree.set(path, newContent);
                            };
                        },
                        handleFileChanged: async (path) => {
                            const changedContent = prevTree.get(path);
                            return () => {
                                logger.logInfo("file %s changed.", path);
                                actualTree.set(path, changedContent);
                            };
                        },
                        handleFileRemoved: async (path) => {
                            return () => {
                                logger.logInfo("file %s removed.", path);
                                actualTree.remove(path);
                            };
                        },
                        handleFolderAdded: async (path) => {
                            logger.logInfo("dir %s added.", path);
                            return () => {
                                if (actualTree.exists(path)) {
                                    actualTree.remove(path);
                                }
                                actualTree.mkdir(path);
                            };
                        },
                        handleFolderRemoved: async (path) => {
                            return () => {
                                logger.logInfo("dir %s removed.", path);
                                actualTree.remove(path);
                            };
                        },
                        isDir: async (path) => {
                            return prevTree.isDir(path);
                        },
                        list: async (path) => {
                            return [...prevTree.list(path)];
                        },
                    });

                    return {finished: res.processed};
                },

                reset: async () => {
                    changeQueue.reset();
                },

                destroy: async () => {
                    logger.logInfo("destroyed");
                },
            };
        },
    };
};

describe("recipestep", () => {
    let initialPathTree: PathTree<Buffer>;
    let node: RecipeStep;

    let logSpy: sinon.SinonSpy  = null;
    let logSpyErr: sinon.SinonSpy = null;

    beforeEach(async () => {
        logSpy = sinon.spy(process.stdout, "write");
        logSpyErr = sinon.spy(process.stderr, "write");

        initialPathTree = new PathTree<Buffer>();
        node = new RecipeStep();
        await node.setup(winstonlogger, initialPathTree.getReadonlyInterface(), getPrintingPlugin(), {});
    });

    afterEach(() => {
        logSpy.restore();
        logSpyErr.restore();
    });

    it("test simple", async () => {
        const rootFilePath = "new_file";
        const dirPath = "new_dir";
        const nestedFilePath = pathutils.join(dirPath, "new_file_inside_dir");

        initialPathTree.set(rootFilePath, Buffer.from("file"));

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("added");

        initialPathTree.set(nestedFilePath, Buffer.from("file2"));

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("dir");
        expect(logSpy.lastCall.args[0]).to.contain("added");

        initialPathTree.remove(nestedFilePath);

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("removed");

        initialPathTree.remove(dirPath);

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("dir");
        expect(logSpy.lastCall.args[0]).to.contain("removed");

        initialPathTree.set(rootFilePath, Buffer.from("file change"));

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("changed");
    });

    it("test reset", async () => {
        const rootFilePath = "new_file";

        initialPathTree.set(rootFilePath, Buffer.from("file"));

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("added");

        await node.reset();

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("added");
    });

    it("test destroy", async () => {
        const rootFilePath = "new_file";

        initialPathTree.set(rootFilePath, Buffer.from("file"));

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("added");

        await node.destroy();

        expect(logSpy.lastCall.args[0]).to.contain("destroyed");
    });
});
