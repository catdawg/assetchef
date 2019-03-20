import { IRecipePlugin } from "../../src/irecipeplugin";
import { ISchemaDefinition } from "../../src/ischemadefinition";
import { PathTree } from "../../src/path/pathtree";
import { PathUtils } from "../../src/path/pathutils";
import { winstonlogger } from "../../src/testutils/winstonlogger";

import { OneFilePluginBase, OneFilePluginBaseInstance } from "../../src/pluginbases/onefilepluginbase";

interface ISplitPluginConfig {
    extensionToSplit: string;
}

class SplitPluginInstance extends OneFilePluginBaseInstance {

    public setupComplete: boolean = false;
    public instanceDestroyed: boolean = false;

    private splitPluginConfig: ISplitPluginConfig;

    protected shouldCook(path: string, content: Buffer): boolean {
        const parsedPath = PathUtils.parse(path);
        return parsedPath.ext === this.splitPluginConfig.extensionToSplit;
    }

    protected async cookFile(path: string, content: Buffer): Promise<Array<{ path: string, content: Buffer }>> {
        const str = content.toString();
        const strSplit = str.split(" ");

        const parsedPath = PathUtils.parse(path);

        const res: Array<{path: string, content: Buffer}> = [];

        for (const token of strSplit) {
            res.push({
                path: PathUtils.join(parsedPath.dir, parsedPath.name + "_" + res.length + parsedPath.ext),
                content: Buffer.from(token),
            });
        }

        return res;
    }

    protected async setupOneFilePlugin(config: any): Promise<void> {
        this.splitPluginConfig = config;
        this.setupComplete = true;
    }

    protected async destroyOneFilePlugin(): Promise<void> {
        this.instanceDestroyed = true;
    }
}

class SplitPlugin extends OneFilePluginBase<SplitPluginInstance> {

    protected createTypedBaseInstance(): SplitPluginInstance {
        return new SplitPluginInstance();
    }

    protected getConfigSchema(): ISchemaDefinition {
        return {
            type: "object",
            properties: {
                extensionToSplit: {
                    type: "string",
                },
            },
            additionalProperties: false,
        };
    }
}

class BrokenPlugin extends OneFilePluginBase<BrokenPluginInstance> {
    protected getConfigSchema(): ISchemaDefinition {
        return {};
    }

    protected createTypedBaseInstance(): BrokenPluginInstance {
        return new BrokenPluginInstance();
    }
}

class BrokenPluginInstance extends OneFilePluginBaseInstance {
    protected shouldCook(path: string, content: Buffer): boolean {
        return true;
    }
    protected async cookFile(path: string, content: Buffer): Promise<Array<{ path: string; content: Buffer; }>> {
        return [{path: "file", content: Buffer.from("content")}];
    }
    protected async setupOneFilePlugin(config: any): Promise<void> {
        return;
    }
    protected async destroyOneFilePlugin(): Promise<void> {
        return;
    }
}

describe("onefilepluginbase", () => {

    let needsUpdate = false;
    function needsUpdateCallback() {
        needsUpdate = true;
    }

    it("test simple", async () => {
        const baseTree = new PathTree<Buffer>();

        const splitPlugin = new SplitPlugin();
        const splitPluginInterface: IRecipePlugin = splitPlugin;

        const splitPluginInstanceInterface = splitPluginInterface.createInstance();
        const splitPluginInstance: SplitPluginInstance = splitPluginInstanceInterface as SplitPluginInstance;

        await splitPluginInstanceInterface.setup( {
            logger: winstonlogger,
            projectPath: "",
            config: {extensionToSplit: ".txt"},
            prevStepTreeInterface: baseTree,
            needsProcessingCallback: needsUpdateCallback,
        });

        expect(splitPluginInstance.setupComplete).toBeTrue();

        const mainFile = PathUtils.join("folder1", "file.txt");
        const ignoredFile = PathUtils.join("folder1", "file.png");

        needsUpdate = false;
        baseTree.set(mainFile, Buffer.from("a file to split"));
        baseTree.set(ignoredFile, Buffer.from("an image"));

        expect(needsUpdate).toBeTrue();
        while (splitPluginInstanceInterface.needsUpdate()) {
            await splitPluginInstanceInterface.update();
        }

        const checkFull = () => {
            const files = [...splitPluginInstanceInterface.treeInterface.listAll()];

            const path0 = PathUtils.join("folder1", "file_0.txt");
            const path1 = PathUtils.join("folder1", "file_1.txt");
            const path2 = PathUtils.join("folder1", "file_2.txt");
            const path3 = PathUtils.join("folder1", "file_3.txt");

            expect(files).toIncludeSameMembers(["", "folder1", path0, path1, path2, path3, ignoredFile]);

            expect(splitPluginInstanceInterface.treeInterface.get(path0).toString()).toEqual("a");
            expect(splitPluginInstanceInterface.treeInterface.get(path1).toString()).toEqual("file");
            expect(splitPluginInstanceInterface.treeInterface.get(path2).toString()).toEqual("to");
            expect(splitPluginInstanceInterface.treeInterface.get(path3).toString()).toEqual("split");
            expect(splitPluginInstanceInterface.treeInterface.get(ignoredFile).toString()).toEqual("an image");
        };

        checkFull();

        needsUpdate = false;
        await splitPluginInstanceInterface.reset();

        expect(needsUpdate).toBeTrue();
        while (splitPluginInstanceInterface.needsUpdate()) {
            await splitPluginInstanceInterface.update();
        }

        checkFull();

        needsUpdate = false;
        baseTree.remove(mainFile);

        expect(needsUpdate).toBeTrue();
        while (splitPluginInstanceInterface.needsUpdate()) {
            await splitPluginInstanceInterface.update();
        }

        const filesAfterRemoval = [...splitPluginInstanceInterface.treeInterface.listAll()];
        expect(filesAfterRemoval).toIncludeSameMembers(["", "folder1", ignoredFile]);

        await splitPluginInstanceInterface.destroy();
        expect(splitPluginInstance.instanceDestroyed).toBeTrue();

        const pathAfterDestroy = PathUtils.join("folder3", "file_0.txt");
        needsUpdate = false;
        baseTree.set(pathAfterDestroy, Buffer.from("will be ignored"));

        expect(needsUpdate).toBeFalse();
    });

    it("test file change", async () => {
        const baseTree = new PathTree<Buffer>();

        const splitPlugin = new SplitPlugin();
        const splitPluginInterface: IRecipePlugin = splitPlugin;

        const splitPluginInstanceInterface = splitPluginInterface.createInstance();
        const splitPluginInstance: SplitPluginInstance = splitPluginInstanceInterface as SplitPluginInstance;

        await splitPluginInstanceInterface.setup( {
            logger: winstonlogger,
            projectPath: "",
            config: {extensionToSplit: ".txt"},
            prevStepTreeInterface: baseTree,
            needsProcessingCallback: needsUpdateCallback,
        });

        expect(splitPluginInstance.setupComplete).toBeTrue();

        needsUpdate = false;
        baseTree.set(PathUtils.join("folder1", "file.txt"), Buffer.from("a file to split"));

        expect(needsUpdate).toBeTrue();
        while (splitPluginInstanceInterface.needsUpdate()) {
            await splitPluginInstanceInterface.update();
        }

        const files = [...splitPluginInstanceInterface.treeInterface.listAll()];

        const path0 = PathUtils.join("folder1", "file_0.txt");
        const path1 = PathUtils.join("folder1", "file_1.txt");
        const path2 = PathUtils.join("folder1", "file_2.txt");
        const path3 = PathUtils.join("folder1", "file_3.txt");

        expect(files).toIncludeSameMembers(["", "folder1", path0, path1, path2, path3]);

        expect(splitPluginInstanceInterface.treeInterface.get(path0).toString()).toEqual("a");
        expect(splitPluginInstanceInterface.treeInterface.get(path1).toString()).toEqual("file");
        expect(splitPluginInstanceInterface.treeInterface.get(path2).toString()).toEqual("to");
        expect(splitPluginInstanceInterface.treeInterface.get(path3).toString()).toEqual("split");

        needsUpdate = false;
        baseTree.set(PathUtils.join("folder1", "file.txt"), Buffer.from("another file"));

        expect(needsUpdate).toBeTrue();
        while (splitPluginInstanceInterface.needsUpdate()) {
            await splitPluginInstanceInterface.update();
        }

        const filesAfterChange = [...splitPluginInstanceInterface.treeInterface.listAll()];

        expect(filesAfterChange).toIncludeSameMembers(["", "folder1", path0, path1]);

        expect(splitPluginInstanceInterface.treeInterface.get(path0).toString()).toEqual("another");
        expect(splitPluginInstanceInterface.treeInterface.get(path1).toString()).toEqual("file");
    });

    it("test folder removal", async () => {
        const baseTree = new PathTree<Buffer>();

        const splitPlugin = new SplitPlugin();
        const pluginInterface: IRecipePlugin = splitPlugin;

        const pluginInstanceInterface = pluginInterface.createInstance();
        const splitPluginInstance: SplitPluginInstance = pluginInstanceInterface as SplitPluginInstance;

        await pluginInstanceInterface.setup( {
            logger: winstonlogger,
            projectPath: "",
            config: {extensionToSplit: ".txt"},
            prevStepTreeInterface: baseTree,
            needsProcessingCallback: needsUpdateCallback,
        });

        expect(splitPluginInstance.setupComplete).toBeTrue();

        needsUpdate = false;
        baseTree.set(PathUtils.join("folder1", "file.txt"), Buffer.from("a file to split"));

        expect(needsUpdate).toBeTrue();
        while (pluginInstanceInterface.needsUpdate()) {
            await pluginInstanceInterface.update();
        }

        const files = [...pluginInstanceInterface.treeInterface.listAll()];

        const path0 = PathUtils.join("folder1", "file_0.txt");
        const path1 = PathUtils.join("folder1", "file_1.txt");
        const path2 = PathUtils.join("folder1", "file_2.txt");
        const path3 = PathUtils.join("folder1", "file_3.txt");

        expect(files).toIncludeSameMembers(["", "folder1", path0, path1, path2, path3]);

        expect(pluginInstanceInterface.treeInterface.get(path0).toString()).toEqual("a");
        expect(pluginInstanceInterface.treeInterface.get(path1).toString()).toEqual("file");
        expect(pluginInstanceInterface.treeInterface.get(path2).toString()).toEqual("to");
        expect(pluginInstanceInterface.treeInterface.get(path3).toString()).toEqual("split");

        needsUpdate = false;
        baseTree.remove("folder1");

        expect(needsUpdate).toBeTrue();
        while (pluginInstanceInterface.needsUpdate()) {
            await pluginInstanceInterface.update();
        }

        const filesAfterChange = [...pluginInstanceInterface.treeInterface.listAll()];

        expect(filesAfterChange).toIncludeSameMembers([""]);
    });

    it("test plugin error case", async () => {
        const plugin = new BrokenPlugin();
        const pluginInstance = plugin.createInstance();

        const baseTree = new PathTree<Buffer>();

        await pluginInstance.setup( {
            logger: winstonlogger,
            projectPath: "",
            config: {},
            prevStepTreeInterface: baseTree,
            needsProcessingCallback: needsUpdateCallback,
        });

        needsUpdate = false;
        baseTree.set("file1", Buffer.from("content"));
        baseTree.set("file2", Buffer.from("content"));

        expect(needsUpdate).toBeTrue();
        await expect((async () => {
            while (pluginInstance.needsUpdate()) {
                await pluginInstance.update();
            }
        })()).rejects.toThrow();
    });

    it("test config change", async () => {
        const baseTree = new PathTree<Buffer>();

        const splitPlugin = new SplitPlugin();
        const splitPluginInterface: IRecipePlugin = splitPlugin;

        const splitPluginInstanceInterface = splitPluginInterface.createInstance();
        const splitPluginInstance: SplitPluginInstance = splitPluginInstanceInterface as SplitPluginInstance;

        const config1 = {extensionToSplit: ".txt"};
        const config2 = {extensionToSplit: ".png"};

        await splitPluginInstanceInterface.setup( {
            logger: winstonlogger,
            projectPath: "",
            config: config1,
            prevStepTreeInterface: baseTree,
            needsProcessingCallback: needsUpdateCallback,
        });

        expect(splitPluginInstance.setupComplete).toBeTrue();

        const originalPath0 = PathUtils.join("folder1", "file.txt");
        const originalPath1 = PathUtils.join("folder2", "file.png");

        needsUpdate = false;
        baseTree.set(originalPath0, Buffer.from("a file to split"));
        baseTree.set(originalPath1, Buffer.from("a file to split"));

        expect(needsUpdate).toBeTrue();
        while (splitPluginInstanceInterface.needsUpdate()) {
            await splitPluginInstanceInterface.update();
        }

        const files = [...splitPluginInstanceInterface.treeInterface.listAll()];

        const path0 = PathUtils.join("folder1", "file_0.txt");
        const path1 = PathUtils.join("folder1", "file_1.txt");
        const path2 = PathUtils.join("folder1", "file_2.txt");
        const path3 = PathUtils.join("folder1", "file_3.txt");

        const path4 = PathUtils.join("folder2", "file_0.png");
        const path5 = PathUtils.join("folder2", "file_1.png");
        const path6 = PathUtils.join("folder2", "file_2.png");
        const path7 = PathUtils.join("folder2", "file_3.png");

        expect(files).toIncludeSameMembers(["", "folder1", "folder2", originalPath1, path0, path1, path2, path3]);

        expect(splitPluginInstanceInterface.treeInterface.get(path0).toString()).toEqual("a");
        expect(splitPluginInstanceInterface.treeInterface.get(path1).toString()).toEqual("file");
        expect(splitPluginInstanceInterface.treeInterface.get(path2).toString()).toEqual("to");
        expect(splitPluginInstanceInterface.treeInterface.get(path3).toString()).toEqual("split");
        expect(splitPluginInstanceInterface.treeInterface.get(originalPath1).toString()).toEqual("a file to split");

        await splitPluginInstanceInterface.setup( {
            logger: winstonlogger,
            projectPath: "",
            config: config2,
            prevStepTreeInterface: baseTree,
            needsProcessingCallback: needsUpdateCallback,
        });

        while (splitPluginInstanceInterface.needsUpdate()) {
            await splitPluginInstanceInterface.update();
        }

        const filesAfter = [...splitPluginInstanceInterface.treeInterface.listAll()];
        expect(filesAfter).toIncludeSameMembers(["", "folder1", "folder2", originalPath0, path4, path5, path6, path7]);

        expect(splitPluginInstanceInterface.treeInterface.get(path4).toString()).toEqual("a");
        expect(splitPluginInstanceInterface.treeInterface.get(path5).toString()).toEqual("file");
        expect(splitPluginInstanceInterface.treeInterface.get(path6).toString()).toEqual("to");
        expect(splitPluginInstanceInterface.treeInterface.get(path7).toString()).toEqual("split");
        expect(splitPluginInstanceInterface.treeInterface.get(originalPath0).toString()).toEqual("a file to split");
    });

    it("test not setup or destroyed", async () => {
        const baseTree = new PathTree<Buffer>();

        const splitPlugin = new SplitPlugin();
        const pluginInterface: IRecipePlugin = splitPlugin;

        const pluginInstanceInterface = pluginInterface.createInstance();
        const splitPluginInstance: SplitPluginInstance = pluginInstanceInterface as SplitPluginInstance;

        expect(splitPluginInstance.needsUpdate()).toBeFalse();
        splitPluginInstance.update();
        splitPluginInstance.reset();

        splitPluginInstance.destroy();

        await pluginInstanceInterface.setup( {
            logger: winstonlogger,
            projectPath: "",
            config: {extensionToSplit: ".txt"},
            prevStepTreeInterface: baseTree,
            needsProcessingCallback: needsUpdateCallback,
        });

        await splitPluginInstance.destroy();

        expect(splitPluginInstance.needsUpdate()).toBeFalse();

        splitPluginInstance.update();

        splitPluginInstance.reset();

        splitPluginInstance.destroy();

        await pluginInstanceInterface.setup( {
            logger: winstonlogger,
            projectPath: "",
            config: {extensionToSplit: ".txt"},
            prevStepTreeInterface: baseTree,
            needsProcessingCallback: needsUpdateCallback,
        });

        // check if everything is fine

        needsUpdate = false;
        baseTree.set(PathUtils.join("folder1", "file.txt"), Buffer.from("a file to split"));

        expect(needsUpdate).toBeTrue();
        while (pluginInstanceInterface.needsUpdate()) {
            await pluginInstanceInterface.update();
        }

        const files = [...pluginInstanceInterface.treeInterface.listAll()];

        const path0 = PathUtils.join("folder1", "file_0.txt");
        const path1 = PathUtils.join("folder1", "file_1.txt");
        const path2 = PathUtils.join("folder1", "file_2.txt");
        const path3 = PathUtils.join("folder1", "file_3.txt");

        expect(files).toIncludeSameMembers(["", "folder1", path0, path1, path2, path3]);

        expect(pluginInstanceInterface.treeInterface.get(path0).toString()).toEqual("a");
        expect(pluginInstanceInterface.treeInterface.get(path1).toString()).toEqual("file");
        expect(pluginInstanceInterface.treeInterface.get(path2).toString()).toEqual("to");
        expect(pluginInstanceInterface.treeInterface.get(path3).toString()).toEqual("split");
    });

    it("test reset when actually empty", async () => {
        const baseTree = new PathTree<Buffer>();

        const splitPlugin = new SplitPlugin();
        const pluginInterface: IRecipePlugin = splitPlugin;

        const pluginInstanceInterface = pluginInterface.createInstance();
        const splitPluginInstance: SplitPluginInstance = pluginInstanceInterface as SplitPluginInstance;

        await pluginInstanceInterface.setup( {
            logger: winstonlogger,
            projectPath: "",
            config: {extensionToSplit: ".txt"},
            prevStepTreeInterface: baseTree,
            needsProcessingCallback: needsUpdateCallback,
        });

        baseTree.set("afile.txt", Buffer.from("file content"));

        while (pluginInstanceInterface.needsUpdate()) {
            await pluginInstanceInterface.update();
        }

        baseTree.remove("");

        await pluginInstanceInterface.reset();

        while (pluginInstanceInterface.needsUpdate()) {
            await pluginInstanceInterface.update();
        }

        expect([...pluginInstanceInterface.treeInterface.listAll()]).toBeEmpty();
    });
});
