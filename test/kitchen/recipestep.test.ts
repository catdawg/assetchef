// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";
import * as sinon from "sinon";

import { RecipeStep } from "../../src/kitchen/recipestep";
import { ILogger, LoggerLevel } from "../../src/plugin/ilogger";
import { IPathChangeEvent, PathEventType } from "../../src/plugin/ipathchangeevent";
import { IPathTreeReadonly } from "../../src/plugin/ipathtreereadonly";
import { IRecipePlugin, IRecipePluginInstance } from "../../src/plugin/irecipeplugin";
import { PathChangeProcessingUtils } from "../../src/utils/path/pathchangeprocessingutils";
import { PathChangeQueue } from "../../src/utils/path/pathchangequeue";
import { PathTree } from "../../src/utils/path/pathtree";
import winstonlogger from "../../test_utils/winstonlogger";

const devnulllogger: ILogger = {
    logInfo: (...args: any[]): void => { return; },
    logWarn: (...args: any[]): void => { return; },
    logDebug: (...args: any[]): void => { return; },
    logError: (...args: any[]): void => { return; },
    log: (level: LoggerLevel, ...args: any[]): void => { return; },
};

interface IPrintingConfig {
    prefix: string;
}

const getPrintingPlugin = (): IRecipePlugin => {

    return {
        apiLevel: 1,
        configSchema: {
            properties: {
                prefix: {
                    type: "string",
                },
            },
            additionalProperties: false,
            required: ["prefix"],
        },
        createInstance: (): IRecipePluginInstance => {
            const actualTree: PathTree<Buffer> = new PathTree();
            const treeInterface = actualTree;
            const changeQueue: PathChangeQueue = new PathChangeQueue(() => {
                if (prevTree.exists("")) {
                    if (prevTree.isDir("")) {
                        changeQueue.push({eventType: PathEventType.AddDir, path: ""});
                    } else {
                        changeQueue.push({eventType: PathEventType.Add, path: ""});
                    }
                    needsUpdateCallback();
                }
            }, devnulllogger);

            let config: IPrintingConfig = null;
            let prefix = "";
            let needsUpdateCallback: () => void = null;
            let unlistenCallback: {unlisten: () => void} = null;
            let prevTree: IPathTreeReadonly<Buffer> = null;
            let logger: ILogger = null;
            return {
                treeInterface,
                setup: async (inLogger, inConfig, prevStepInterface, inNeedsUpdateCallback) => {
                    config = inConfig;
                    logger = inLogger;
                    prevTree = prevStepInterface;
                    needsUpdateCallback = inNeedsUpdateCallback;

                    prefix = config.prefix;

                    unlistenCallback = prevTree.listenChanges((e) => {
                        changeQueue.push(e);
                        needsUpdateCallback();
                    });

                    changeQueue.reset();

                },
                needsUpdate: () => {
                    return changeQueue.hasChanges();
                },
                update: async () => {
                    await PathChangeProcessingUtils.processOne(changeQueue, {
                        handleFileAdded: async (path) => {
                            const newContent = prevTree.get(path);
                            return () => {
                                logger.logInfo(prefix + "file %s added.", path);
                                actualTree.set(path, newContent);
                            };
                        },
                        handleFileChanged: async (path) => {
                            const changedContent = prevTree.get(path);
                            return () => {
                                logger.logInfo(prefix + "file %s changed.", path);
                                actualTree.set(path, changedContent);
                            };
                        },
                        handleFileRemoved: async (path) => {
                            return () => {
                                logger.logInfo(prefix + "file %s removed.", path);
                                actualTree.remove(path);
                            };
                        },
                        handleFolderAdded: async (path) => {
                            logger.logInfo(prefix + "dir %s added.", path);
                            return () => {
                                if (actualTree.exists(path)) {
                                    actualTree.remove(path);
                                }
                                actualTree.mkdir(path);
                            };
                        },
                        handleFolderRemoved: async (path) => {
                            return () => {
                                logger.logInfo(prefix + "dir %s removed.", path);
                                actualTree.remove(path);
                            };
                        },
                        isDir: async (path) => {
                            return prevTree.isDir(path);
                        },
                        list: async (path) => {
                            return [...prevTree.list(path)];
                        },
                    }, devnulllogger);
                },

                reset: async () => {
                    changeQueue.reset();
                },

                destroy: async () => {
                    unlistenCallback.unlisten();
                    logger.logInfo(prefix + "destroyed");

                    config = null;
                    prefix = "";
                    needsUpdateCallback = null;
                    unlistenCallback = null;
                    prevTree = null;
                    logger = null;
                },
            };
        },
    };
};

describe("recipestep", () => {
    let initialPathTree: PathTree<Buffer>;
    let node: RecipeStep;

    let logSpy: sinon.SinonSpy  = null;

    let loggerBeingListened: ILogger = null;

    let needsUpdate = false;
    const updateNeededCallback = () => {
        needsUpdate = true;
    };

    beforeEach(async () => {

        loggerBeingListened = winstonlogger;
        logSpy = sinon.spy(loggerBeingListened, "logInfo");

        initialPathTree = new PathTree<Buffer>();
        node = new RecipeStep();
        await node.setup(
            loggerBeingListened,
            initialPathTree,
            getPrintingPlugin(),
            {prefix: ""},
            updateNeededCallback);
    });

    afterEach(() => {
        logSpy.restore();
    });

    it("test simple", async () => {
        await node.update(); // nothing

        const rootFilePath = "new_file";
        const dirPath = "new_dir";
        const nestedFilePath = pathutils.join(dirPath, "new_file_inside_dir");

        needsUpdate = false;
        initialPathTree.set(rootFilePath, Buffer.from("file"));

        expect(needsUpdate).to.be.true;
        expect(node.needsUpdate()).to.be.true;
        while (node.needsUpdate()) {
            await node.update();
        }

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("added");

        needsUpdate = false;
        initialPathTree.set(nestedFilePath, Buffer.from("file2"));

        expect(needsUpdate).to.be.true;
        expect(node.needsUpdate()).to.be.true;
        await node.update(); // only one

        expect(logSpy.lastCall.args[0]).to.contain("dir");
        expect(logSpy.lastCall.args[0]).to.contain("added");

        await node.update(); // only one

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("added");

        needsUpdate = false;
        initialPathTree.remove(nestedFilePath);

        expect(needsUpdate).to.be.true;
        expect(node.needsUpdate()).to.be.true;
        while (node.needsUpdate()) {
            await node.update();
        }

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("removed");

        needsUpdate = false;
        initialPathTree.remove(dirPath);

        expect(needsUpdate).to.be.true;
        expect(node.needsUpdate()).to.be.true;
        while (node.needsUpdate()) {
            await node.update();
        }

        expect(logSpy.lastCall.args[0]).to.contain("dir");
        expect(logSpy.lastCall.args[0]).to.contain("removed");

        needsUpdate = false;
        initialPathTree.set(rootFilePath, Buffer.from("file change"));

        expect(needsUpdate).to.be.true;
        expect(node.needsUpdate()).to.be.true;
        while (node.needsUpdate()) {
            await node.update();
        }

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("changed");
    });

    it("test reconfigure", async () => {

        const plugin = getPrintingPlugin();
        await node.setup(
            loggerBeingListened,
            initialPathTree,
            plugin,
            {prefix: ""},
            updateNeededCallback);

        needsUpdate = false;
        initialPathTree.set("file.txt", Buffer.from("file"));

        expect(needsUpdate).to.be.true;
        expect(node.needsUpdate()).to.be.true;
        while (node.needsUpdate()) {
            await node.update();
        }

        expect(logSpy.lastCall.args[0]).to.not.contain("APREFIX");

        await node.setup(
            loggerBeingListened,
            initialPathTree,
            plugin,
            {prefix: "APREFIX"},
            updateNeededCallback);

        needsUpdate = false;
        initialPathTree.set("file2.txt", Buffer.from("file"));

        expect(needsUpdate).to.be.true;
        expect(node.needsUpdate()).to.be.true;
        while (node.needsUpdate()) {
            await node.update();
        }

        expect(logSpy.lastCall.args[0]).to.contain("APREFIX");
    });

    it("test reset", async () => {
        const rootFilePath = "new_file";

        needsUpdate = false;
        initialPathTree.set(rootFilePath, Buffer.from("file"));

        expect(needsUpdate).to.be.true;
        expect(node.needsUpdate()).to.be.true;
        while (node.needsUpdate()) {
            await node.update();
        }

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("added");

        needsUpdate = false;
        await node.reset();

        expect(needsUpdate).to.be.true;
        expect(node.needsUpdate()).to.be.true;
        while (node.needsUpdate()) {
            await node.update();
        }

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("added");
    });

    it("test destroy", async () => {
        const rootFilePath = "new_file";

        initialPathTree.set(rootFilePath, Buffer.from("file"));
        while (node.needsUpdate()) {
            await node.update();
        }

        await node.destroy();

        expect(logSpy.lastCall.args[0]).to.contain("destroyed");
    });
});
