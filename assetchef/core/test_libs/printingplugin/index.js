const pluginapi = require("@assetchef/pluginapi");

const getPrintingPlugin = (withFsListener = true) => {

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
        createInstance: () => {
            const actualTree = new pluginapi.PathTree();
            const treeInterface = actualTree;
            let params;
            let pluginConfig = null;
            const changeQueue = new pluginapi.PathChangeQueue(() => {
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
            let unlistenCallback = null;
            let unlistenProjectCallback = null;

            return {
                treeInterface,
                setup: async (inConfig) => {
                    params = inConfig;
                    pluginConfig = params.config;

                    prefix = pluginConfig.prefix;

                    unlistenProjectCallback = params.projectTree.listenChanges({
                        onEvent: (ev) => {
                            params.logger.logInfo(prefix + "project ev %s in path %s.", ev.eventType, ev.path);
                        },
                        onReset: () => {
                            params.logger.logInfo(prefix + "project reset");
                        },
                    });

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
                    unlistenProjectCallback.unlisten();
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

module.exports = getPrintingPlugin(true);