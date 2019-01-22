// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";

import { RecipeStep } from "../../src/kitchen/recipestep";
import { IFSWatchListener } from "../../src/plugin/ifswatch";
import { ILogger, LoggerLevel } from "../../src/plugin/ilogger";
import { IPathChangeEvent, PathEventType } from "../../src/plugin/ipathchangeevent";
import { IPathTreeReadonly } from "../../src/plugin/ipathtreereadonly";
import { IRecipePlugin, IRecipePluginInstance, IRecipePluginInstanceSetupParams } from "../../src/plugin/irecipeplugin";
import { PathChangeProcessingUtils } from "../../src/utils/path/pathchangeprocessingutils";
import { PathChangeQueue } from "../../src/utils/path/pathchangequeue";
import { PathTree } from "../../src/utils/path/pathtree";
import { FakeFSWatch } from "../../test_utils/fakefswatch";
import { getCallTrackingLogger, ILoggerTracer } from "../../test_utils/loggingtracer";
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

const getPrintingPlugin = (withFsListener: boolean = true): IRecipePlugin => {

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

            let watchListener: IFSWatchListener = null;

            if (withFsListener) {
                watchListener = {
                    onEvent: (ev) => {
                        params.logger.logInfo(prefix + "fs ev %s in path %s.", ev.eventType, ev.path);
                    },
                    onReset: () => {
                        params.logger.logInfo(prefix + "fs reset");
                    },
                };
            }
            return {
                treeInterface,
                projectWatchListener: watchListener,
                setup: async (inConfig) => {
                    params = inConfig;
                    pluginConfig = params.config;

                    prefix = pluginConfig.prefix;

                    unlistenCallback = params.prevStepTreeInterface.listenChanges((e) => {
                        changeQueue.push(e);
                        params.needsProcessingCallback();
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
                                actualTree.mkdir(path);
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
                    }, devnulllogger);
                },

                reset: async () => {
                    changeQueue.reset();
                },

                destroy: async () => {
                    unlistenCallback.unlisten();
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

    let fakeFSWatch: FakeFSWatch;

    let needsUpdate = false;
    const updateNeededCallback = () => {
        needsUpdate = true;
    };

    beforeEach(async () => {

        loggerBeingListened = getCallTrackingLogger(winstonlogger);

        initialPathTree = new PathTree<Buffer>();
        fakeFSWatch = new FakeFSWatch();
        node = new RecipeStep();
        await node.setup(
            loggerBeingListened,
            "",
            fakeFSWatch,
            initialPathTree,
            getPrintingPlugin(),
            {prefix: ""},
            updateNeededCallback);
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

        let lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).to.contain("file");
        expect(lastLog).to.contain("added");

        needsUpdate = false;
        initialPathTree.set(nestedFilePath, Buffer.from("file2"));

        expect(needsUpdate).to.be.true;
        expect(node.needsUpdate()).to.be.true;
        await node.update(); // only one

        lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).to.contain("dir");
        expect(lastLog).to.contain("added");

        await node.update(); // only one

        lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).to.contain("file");
        expect(lastLog).to.contain("added");

        needsUpdate = false;
        initialPathTree.remove(nestedFilePath);

        expect(needsUpdate).to.be.true;
        expect(node.needsUpdate()).to.be.true;
        while (node.needsUpdate()) {
            await node.update();
        }

        lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).to.contain("file");
        expect(lastLog).to.contain("removed");

        needsUpdate = false;
        initialPathTree.remove(dirPath);

        expect(needsUpdate).to.be.true;
        expect(node.needsUpdate()).to.be.true;
        while (node.needsUpdate()) {
            await node.update();
        }

        lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).to.contain("dir");
        expect(lastLog).to.contain("removed");

        needsUpdate = false;
        initialPathTree.set(rootFilePath, Buffer.from("file change"));

        expect(needsUpdate).to.be.true;
        expect(node.needsUpdate()).to.be.true;
        while (node.needsUpdate()) {
            await node.update();
        }

        lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).to.contain("file");
        expect(lastLog).to.contain("changed");
    });

    it("test reconfigure", async () => {

        const plugin = getPrintingPlugin();
        await node.setup(
            loggerBeingListened,
            "",
            fakeFSWatch,
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

        let lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).to.not.contain("APREFIX");

        await node.setup(
            loggerBeingListened,
            "",
            fakeFSWatch,
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

        lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).to.contain("APREFIX");
    });

    it("test fs watch", async () => {

        const plugin = getPrintingPlugin();
        await node.setup(
            loggerBeingListened,
            "",
            fakeFSWatch,
            initialPathTree,
            plugin,
            {prefix: ""},
            updateNeededCallback);

        fakeFSWatch.emitEv.emit({eventType: PathEventType.Add, path: "thedispatchedeventpath"});
        expect(loggerBeingListened.lastLogInfo()).to.contain("fs ev");

        fakeFSWatch.emitReset.emit();
        expect(loggerBeingListened.lastLogInfo()).to.contain("fs reset");

        const pluginWithoutFSWatch = getPrintingPlugin(false);

        await node.setup(
            loggerBeingListened,
            "",
            fakeFSWatch,
            initialPathTree,
            pluginWithoutFSWatch,
            {prefix: "APREFIX"},
            updateNeededCallback);

        loggerBeingListened.lastLogInfo(); // resets
        fakeFSWatch.emitEv.emit({eventType: PathEventType.Add, path: "fs ev"});
        expect(loggerBeingListened.lastLogInfo()).to.be.null;

        loggerBeingListened.lastLogInfo(); // resets
        fakeFSWatch.emitReset.emit();
        expect(loggerBeingListened.lastLogInfo()).to.be.null;
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

        let lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).to.contain("file");
        expect(lastLog).to.contain("added");

        needsUpdate = false;
        await node.reset();

        expect(needsUpdate).to.be.true;
        expect(node.needsUpdate()).to.be.true;
        while (node.needsUpdate()) {
            await node.update();
        }
        lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).to.contain("file");
        expect(lastLog).to.contain("added");
    });

    it("test destroy", async () => {
        const rootFilePath = "new_file";

        initialPathTree.set(rootFilePath, Buffer.from("file"));
        while (node.needsUpdate()) {
            await node.update();
        }

        await node.destroy();
        const lastLog = loggerBeingListened.lastLogInfo();
        expect(lastLog).to.contain("destroyed");
    });
});
