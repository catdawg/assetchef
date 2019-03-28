import { ILogger, LoggerLevel } from "../../src/comm/ilogger";
import { RecipeStep } from "../../src/core/recipestep";
import { IRecipePlugin, IRecipePluginInstance, IRecipePluginInstanceSetupParams } from "../../src/irecipeplugin";
import { PathEventType } from "../../src/path/ipathchangeevent";
import { PathChangeProcessingUtils } from "../../src/path/pathchangeprocessingutils";
import { PathChangeQueue } from "../../src/path/pathchangequeue";
import { PathTree } from "../../src/path/pathtree";
import { PathUtils } from "../../src/path/pathutils";
import { getCallTrackingLogger, ILoggerTracer } from "../../src/testutils/loggingtracer";
import { MockAsyncPathTree } from "../../src/testutils/mockasyncpathtree";
import { MockFSWatch } from "../../src/testutils/mockfswatch";
import { winstonlogger } from "../../src/testutils/winstonlogger";

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
            let params: IRecipePluginInstanceSetupParams;
            let pluginConfig: IPrintingConfig = null;
            const changeQueue: PathChangeQueue = new PathChangeQueue(() => {
                if (params.prevStepTreeInterface.exists("")) {
                    if (params.prevStepTreeInterface.isDir("")) {
                        changeQueue.push({eventType: PathEventType.AddDir, path: ""});
                    } else {
                        changeQueue.push({eventType: PathEventType.Add, path: ""});
                    }
                    params.needsProcessingCallback();
                }
            }, devnulllogger);

            let prefix = "";
            let unlistenCallback: {unlisten: () => void} = null;
            let unlistenWatch: {unlisten: () => void} = null;

            return {
                treeInterface,
                setup: async (inConfig) => {
                    params = inConfig;
                    pluginConfig = params.config;

                    prefix = pluginConfig.prefix;

                    unlistenCallback = params.prevStepTreeInterface.listenChanges((e) => {
                        changeQueue.push(e);
                        params.needsProcessingCallback();
                    });

                    unlistenWatch = params.projectTree.listenChanges({
                        onEvent: (ev) => {
                            params.logger.logInfo(prefix + "fs ev %s in path %s.", ev.eventType, ev.path);
                        },
                        onReset: () => {
                            params.logger.logInfo(prefix + "fs reset");
                        },
                    });

                    changeQueue.reset();

                },
                needsUpdate: () => {
                    return changeQueue.hasChanges();
                },
                update: async () => {
                    await PathChangeProcessingUtils.processOne(changeQueue, {
                        handleFileAdded: async (path) => {
                            const newContent = params.prevStepTreeInterface.get(path);
                            return () => {
                                params.logger.logInfo(prefix + "file %s added.", path);
                                actualTree.set(path, newContent);
                            };
                        },
                        handleFileChanged: async (path) => {
                            const changedContent = params.prevStepTreeInterface.get(path);
                            return () => {
                                params.logger.logInfo(prefix + "file %s changed.", path);
                                actualTree.set(path, changedContent);
                            };
                        },
                        handleFileRemoved: async (path) => {
                            return () => {
                                params.logger.logInfo(prefix + "file %s removed.", path);
                                actualTree.remove(path);
                            };
                        },
                        handleFolderAdded: async (path) => {
                            params.logger.logInfo(prefix + "dir %s added.", path);
                            return () => {
                                if (actualTree.exists(path)) {
                                    actualTree.remove(path);
                                }
                                actualTree.createFolder(path);
                            };
                        },
                        handleFolderRemoved: async (path) => {
                            return () => {
                                params.logger.logInfo(prefix + "dir %s removed.", path);
                                actualTree.remove(path);
                            };
                        },
                        isDir: async (path) => {
                            return params.prevStepTreeInterface.isDir(path);
                        },
                        list: async (path) => {
                            return [...params.prevStepTreeInterface.list(path)];
                        },
                    }, devnulllogger, 2500);
                },

                reset: async () => {
                    changeQueue.reset();
                },

                destroy: async () => {
                    unlistenCallback.unlisten();
                    unlistenWatch.unlisten();
                    params.logger.logInfo(prefix + "destroyed");

                    pluginConfig = null;
                    prefix = "";
                    unlistenCallback = null;
                    params = null;
                },
            };
        },
    };
};

describe("recipestep", () => {
    let initialPathTree: PathTree<Buffer>;
    let node: RecipeStep;

    let loggerBeingListened: ILoggerTracer = null;

    let syncTree: PathTree<Buffer>;
    let projectTree: MockAsyncPathTree<Buffer>;

    let needsUpdate = false;
    const updateNeededCallback = () => {
        needsUpdate = true;
    };

    beforeEach(async () => {

        loggerBeingListened = getCallTrackingLogger(winstonlogger);

        initialPathTree = new PathTree<Buffer>();
        syncTree = new PathTree<Buffer>();
        projectTree = new MockAsyncPathTree<Buffer>(syncTree);
        node = new RecipeStep();
        await node.setup(
            loggerBeingListened,
            projectTree,
            initialPathTree,
            getPrintingPlugin(),
            {prefix: ""},
            updateNeededCallback);
    });

    it("test simple", async () => {
        await node.update(); // nothing

        const rootFilePath = "new_file";
        const dirPath = "new_dir";
        const nestedFilePath = PathUtils.join(dirPath, "new_file_inside_dir");

        needsUpdate = false;
        initialPathTree.set(rootFilePath, Buffer.from("file"));

        expect(needsUpdate).toBeTrue();
        expect(node.needsUpdate()).toBeTrue();
        while (node.needsUpdate()) {
            await node.update();
        }

        let lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).toContain("file");
        expect(lastLog).toContain("added");

        needsUpdate = false;
        initialPathTree.set(nestedFilePath, Buffer.from("file2"));

        expect(needsUpdate).toBeTrue();
        expect(node.needsUpdate()).toBeTrue();
        await node.update(); // only one

        lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).toContain("dir");
        expect(lastLog).toContain("added");

        await node.update(); // only one

        lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).toContain("file");
        expect(lastLog).toContain("added");

        needsUpdate = false;
        initialPathTree.remove(nestedFilePath);

        expect(needsUpdate).toBeTrue();
        expect(node.needsUpdate()).toBeTrue();
        while (node.needsUpdate()) {
            await node.update();
        }

        lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).toContain("file");
        expect(lastLog).toContain("removed");

        needsUpdate = false;
        initialPathTree.remove(dirPath);

        expect(needsUpdate).toBeTrue();
        expect(node.needsUpdate()).toBeTrue();
        while (node.needsUpdate()) {
            await node.update();
        }

        lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).toContain("dir");
        expect(lastLog).toContain("removed");

        needsUpdate = false;
        initialPathTree.set(rootFilePath, Buffer.from("file change"));

        expect(needsUpdate).toBeTrue();
        expect(node.needsUpdate()).toBeTrue();
        while (node.needsUpdate()) {
            await node.update();
        }

        lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).toContain("file");
        expect(lastLog).toContain("changed");
    });

    it("test reconfigure", async () => {

        const plugin = getPrintingPlugin();
        await node.setup(
            loggerBeingListened,
            projectTree,
            initialPathTree,
            plugin,
            {prefix: ""},
            updateNeededCallback);

        needsUpdate = false;
        initialPathTree.set("file.txt", Buffer.from("file"));

        expect(needsUpdate).toBeTrue();
        expect(node.needsUpdate()).toBeTrue();
        while (node.needsUpdate()) {
            await node.update();
        }

        let lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).not.toContain("APREFIX");

        await node.setup(
            loggerBeingListened,
            projectTree,
            initialPathTree,
            plugin,
            {prefix: "APREFIX"},
            updateNeededCallback);

        needsUpdate = false;
        initialPathTree.set("file2.txt", Buffer.from("file"));

        expect(needsUpdate).toBeTrue();
        expect(node.needsUpdate()).toBeTrue();
        while (node.needsUpdate()) {
            await node.update();
        }

        lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).toContain("APREFIX");
    });

    it("test fs watch", async () => {

        const plugin = getPrintingPlugin();
        await node.setup(
            loggerBeingListened,
            projectTree,
            initialPathTree,
            plugin,
            {prefix: ""},
            updateNeededCallback);

        syncTree.set("something", Buffer.from("content"));
        expect(loggerBeingListened.lastLogInfo()).toContain("fs ev");

        projectTree.resetListen();
        expect(loggerBeingListened.lastLogInfo()).toContain("fs reset");
    });

    it("test reset", async () => {
        const rootFilePath = "new_file";

        needsUpdate = false;
        initialPathTree.set(rootFilePath, Buffer.from("file"));

        expect(needsUpdate).toBeTrue();
        expect(node.needsUpdate()).toBeTrue();
        while (node.needsUpdate()) {
            await node.update();
        }

        let lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).toContain("file");
        expect(lastLog).toContain("added");

        needsUpdate = false;
        await node.reset();

        expect(needsUpdate).toBeTrue();
        expect(node.needsUpdate()).toBeTrue();
        while (node.needsUpdate()) {
            await node.update();
        }
        lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).toContain("file");
        expect(lastLog).toContain("added");
    });

    it("test destroy", async () => {
        const rootFilePath = "new_file";

        initialPathTree.set(rootFilePath, Buffer.from("file"));
        while (node.needsUpdate()) {
            await node.update();
        }

        await node.destroy();
        const lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).toContain("destroyed");
    });
});
