const PathChangeQueue = require("../../dist/utils/path/pathchangequeue").PathChangeQueue;
const PathTree = require("../../dist/utils/path/pathtree").PathTree;
const PathEventType = require("../../dist/plugin/ipathchangeevent").PathEventType;
const processAll = require("../../dist/utils/path/pathchangeprocessor").processAll;

class PrintingPlugin {
    constructor() {
        // private
        this.actualTree = null;
        this.prevTree = null;
        this.changeQueue = null;
        this.logger = null;

        // plugin contract
        this.configSchema = {};
    }

    async update(){
        const res = await processAll(this.changeQueue, {
            handleFileAdded: async (path) => {
                const newContent = this.prevTree.get(path);
                return () => {
                    this.logger.logInfo("file %s added.", path);
                    this.actualTree.set(path, newContent);
                };
            },
            handleFileChanged: async (path) => {
                const changedContent = this.prevTree.get(path);
                return () => {
                    this.logger.logInfo("file %s changed.", path);
                    this.actualTree.set(path, changedContent);
                };
            },
            handleFileRemoved: async (path) => {
                return () => {
                    this.logger.logInfo("file %s removed.", path);
                    this.actualTree.remove(path);
                };
            },
            handleFolderAdded: async (path) => {
                this.logger.logInfo("dir %s added.", path);
                return () => {
                    if (this.actualTree.exists(path)) {
                        this.actualTree.remove(path);
                    }
                    this.actualTree.mkdir(path);
                };
            },
            handleFolderRemoved: async (path) => {
                return () => {
                    this.logger.logInfo("dir %s removed.", path);
                    this.actualTree.remove(path);
                };
            },
            isDir: async (path) => {
                return this.prevTree.isDir(path);
            },
            list: async (path) => {
                return [...this.prevTree.list(path)];
            },
        });

        return {finished: res.processed};
    }

    async reset() {
        this.changeQueue.reset();
    }

    async setup(logger, config, prevStepInterface) {
        this.logger = logger;
        this.prevTree = prevStepInterface;

        this.actualTree = new PathTree();
        this.changeQueue = new PathChangeQueue(() => {
            this.changeQueue.push({eventType: PathEventType.AddDir, path: ""});
        }, logger);

        this.prevTree.addChangeListener((e) => {
            this.changeQueue.push(e);
        });

        this.changeQueue.reset();

        return this.actualTree.getReadonlyInterface();
    }

    async destroy() {
        this.logger.logInfo("destroyed");
    }
}

module.exports = new PrintingPlugin();
