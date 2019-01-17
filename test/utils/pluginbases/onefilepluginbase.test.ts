// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";
import { VError } from "verror";

import { IRecipePlugin } from "../../../src/plugin/irecipeplugin";
import { ISchemaDefinition } from "../../../src/plugin/ischemadefinition";
import { PathTree } from "../../../src/utils/path/pathtree";
import { OneFilePluginBase, OneFilePluginBaseInstance } from "../../../src/utils/pluginbases/onefilepluginbase";
import winstonlogger from "../../../test_utils/winstonlogger";

interface ISplitPluginConfig {
    extensionToSplit: string;
}

class SplitPluginInstance extends OneFilePluginBaseInstance {

    public setupComplete: boolean = false;
    public instanceDestroyed: boolean = false;

    private config: ISplitPluginConfig;

    protected shouldCook(path: string, content: Buffer): boolean {
        const parsedPath = pathutils.parse(path);
        return parsedPath.ext === this.config.extensionToSplit;
    }

    protected async cookFile(path: string, content: Buffer): Promise<Array<{ path: string, content: Buffer }>> {
        const str = content.toString();
        const strSplit = str.split(" ");

        const parsedPath = pathutils.parse(path);

        const res: Array<{path: string, content: Buffer}> = [];

        for (const token of strSplit) {
            res.push({
                path: pathutils.join(parsedPath.dir, parsedPath.name + "_" + res.length + parsedPath.ext),
                content: Buffer.from(token),
            });
        }

        return res;
    }

    protected async setupOneFilePlugin(config: any): Promise<void> {
        this.config = config;
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

async function runAndReturnError(f: () => Promise<any>): Promise<Error> {
    try {
        await f();
    } catch (e) {
        return e;
    }
    return null;
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

        await splitPluginInstanceInterface.setup(
            winstonlogger,
            {extensionToSplit: ".txt"},
            baseTree,
            needsUpdateCallback);

        expect(splitPluginInstance.setupComplete).to.be.true;

        const mainFile = pathutils.join("folder1", "file.txt");
        const ignoredFile = pathutils.join("folder1", "file.png");

        needsUpdate = false;
        baseTree.set(mainFile, Buffer.from("a file to split"));
        baseTree.set(ignoredFile, Buffer.from("an image"));

        expect(needsUpdate).to.be.true;
        while (splitPluginInstanceInterface.needsUpdate()) {
            await splitPluginInstanceInterface.update();
        }

        const checkFull = () => {
            const files = [...splitPluginInstanceInterface.treeInterface.listAll()];

            const path0 = pathutils.join("folder1", "file_0.txt");
            const path1 = pathutils.join("folder1", "file_1.txt");
            const path2 = pathutils.join("folder1", "file_2.txt");
            const path3 = pathutils.join("folder1", "file_3.txt");

            expect(files).to.have.same.members(["", "folder1", path0, path1, path2, path3, ignoredFile]);

            expect(splitPluginInstanceInterface.treeInterface.get(path0).toString()).to.be.equal("a");
            expect(splitPluginInstanceInterface.treeInterface.get(path1).toString()).to.be.equal("file");
            expect(splitPluginInstanceInterface.treeInterface.get(path2).toString()).to.be.equal("to");
            expect(splitPluginInstanceInterface.treeInterface.get(path3).toString()).to.be.equal("split");
            expect(splitPluginInstanceInterface.treeInterface.get(ignoredFile).toString()).to.be.equal("an image");
        };

        checkFull();

        needsUpdate = false;
        await splitPluginInstanceInterface.reset();

        expect(needsUpdate).to.be.true;
        while (splitPluginInstanceInterface.needsUpdate()) {
            await splitPluginInstanceInterface.update();
        }

        checkFull();

        needsUpdate = false;
        baseTree.remove(mainFile);

        expect(needsUpdate).to.be.true;
        while (splitPluginInstanceInterface.needsUpdate()) {
            await splitPluginInstanceInterface.update();
        }

        const filesAfterRemoval = [...splitPluginInstanceInterface.treeInterface.listAll()];
        expect(filesAfterRemoval).to.have.same.members(["", "folder1", ignoredFile]);

        await splitPluginInstanceInterface.destroy();
        expect(splitPluginInstance.instanceDestroyed).to.be.true;

        const pathAfterDestroy = pathutils.join("folder3", "file_0.txt");
        needsUpdate = false;
        baseTree.set(pathAfterDestroy, Buffer.from("will be ignored"));

        expect(needsUpdate).to.be.false;
    });

    it("test file change", async () => {
        const baseTree = new PathTree<Buffer>();

        const splitPlugin = new SplitPlugin();
        const splitPluginInterface: IRecipePlugin = splitPlugin;

        const splitPluginInstanceInterface = splitPluginInterface.createInstance();
        const splitPluginInstance: SplitPluginInstance = splitPluginInstanceInterface as SplitPluginInstance;

        await splitPluginInstanceInterface.setup(
            winstonlogger,
            {extensionToSplit: ".txt"},
            baseTree,
            needsUpdateCallback);

        expect(splitPluginInstance.setupComplete).to.be.true;

        needsUpdate = false;
        baseTree.set(pathutils.join("folder1", "file.txt"), Buffer.from("a file to split"));

        expect(needsUpdate).to.be.true;
        while (splitPluginInstanceInterface.needsUpdate()) {
            await splitPluginInstanceInterface.update();
        }

        const files = [...splitPluginInstanceInterface.treeInterface.listAll()];

        const path0 = pathutils.join("folder1", "file_0.txt");
        const path1 = pathutils.join("folder1", "file_1.txt");
        const path2 = pathutils.join("folder1", "file_2.txt");
        const path3 = pathutils.join("folder1", "file_3.txt");

        expect(files).to.have.same.members(["", "folder1", path0, path1, path2, path3]);

        expect(splitPluginInstanceInterface.treeInterface.get(path0).toString()).to.be.equal("a");
        expect(splitPluginInstanceInterface.treeInterface.get(path1).toString()).to.be.equal("file");
        expect(splitPluginInstanceInterface.treeInterface.get(path2).toString()).to.be.equal("to");
        expect(splitPluginInstanceInterface.treeInterface.get(path3).toString()).to.be.equal("split");

        needsUpdate = false;
        baseTree.set(pathutils.join("folder1", "file.txt"), Buffer.from("another file"));

        expect(needsUpdate).to.be.true;
        while (splitPluginInstanceInterface.needsUpdate()) {
            await splitPluginInstanceInterface.update();
        }

        const filesAfterChange = [...splitPluginInstanceInterface.treeInterface.listAll()];

        expect(filesAfterChange).to.have.same.members(["", "folder1", path0, path1]);

        expect(splitPluginInstanceInterface.treeInterface.get(path0).toString()).to.be.equal("another");
        expect(splitPluginInstanceInterface.treeInterface.get(path1).toString()).to.be.equal("file");
    });

    it("test folder removal", async () => {
        const baseTree = new PathTree<Buffer>();

        const splitPlugin = new SplitPlugin();
        const pluginInterface: IRecipePlugin = splitPlugin;

        const pluginInstanceInterface = pluginInterface.createInstance();
        const splitPluginInstance: SplitPluginInstance = pluginInstanceInterface as SplitPluginInstance;

        await pluginInstanceInterface.setup(
            winstonlogger,
            {extensionToSplit: ".txt"},
            baseTree,
            needsUpdateCallback);

        expect(splitPluginInstance.setupComplete).to.be.true;

        needsUpdate = false;
        baseTree.set(pathutils.join("folder1", "file.txt"), Buffer.from("a file to split"));

        expect(needsUpdate).to.be.true;
        while (pluginInstanceInterface.needsUpdate()) {
            await pluginInstanceInterface.update();
        }

        const files = [...pluginInstanceInterface.treeInterface.listAll()];

        const path0 = pathutils.join("folder1", "file_0.txt");
        const path1 = pathutils.join("folder1", "file_1.txt");
        const path2 = pathutils.join("folder1", "file_2.txt");
        const path3 = pathutils.join("folder1", "file_3.txt");

        expect(files).to.have.same.members(["", "folder1", path0, path1, path2, path3]);

        expect(pluginInstanceInterface.treeInterface.get(path0).toString()).to.be.equal("a");
        expect(pluginInstanceInterface.treeInterface.get(path1).toString()).to.be.equal("file");
        expect(pluginInstanceInterface.treeInterface.get(path2).toString()).to.be.equal("to");
        expect(pluginInstanceInterface.treeInterface.get(path3).toString()).to.be.equal("split");

        needsUpdate = false;
        baseTree.remove("folder1");

        expect(needsUpdate).to.be.true;
        while (pluginInstanceInterface.needsUpdate()) {
            await pluginInstanceInterface.update();
        }

        const filesAfterChange = [...pluginInstanceInterface.treeInterface.listAll()];

        expect(filesAfterChange).to.have.same.members([""]);
    });

    it("test plugin error case", async () => {
        const plugin = new BrokenPlugin();
        const pluginInstance = plugin.createInstance();

        const baseTree = new PathTree<Buffer>();

        await pluginInstance.setup(
            winstonlogger,
            {},
            baseTree,
            needsUpdateCallback);

        needsUpdate = false;
        baseTree.set("file1", Buffer.from("content"));
        baseTree.set("file2", Buffer.from("content"));

        expect(needsUpdate).to.be.true;
        expect(await runAndReturnError(async () => {
            while (pluginInstance.needsUpdate()) {
                await pluginInstance.update();
            }
        })).to.not.be.null;
    });

    it("test config change", async () => {
        const baseTree = new PathTree<Buffer>();

        const splitPlugin = new SplitPlugin();
        const splitPluginInterface: IRecipePlugin = splitPlugin;

        const splitPluginInstanceInterface = splitPluginInterface.createInstance();
        const splitPluginInstance: SplitPluginInstance = splitPluginInstanceInterface as SplitPluginInstance;

        const config1 = {extensionToSplit: ".txt"};
        const config2 = {extensionToSplit: ".png"};

        await splitPluginInstanceInterface.setup(
            winstonlogger,
            config1,
            baseTree,
            needsUpdateCallback);

        expect(splitPluginInstance.setupComplete).to.be.true;

        const originalPath0 = pathutils.join("folder1", "file.txt");
        const originalPath1 = pathutils.join("folder2", "file.png");

        needsUpdate = false;
        baseTree.set(originalPath0, Buffer.from("a file to split"));
        baseTree.set(originalPath1, Buffer.from("a file to split"));

        expect(needsUpdate).to.be.true;
        while (splitPluginInstanceInterface.needsUpdate()) {
            await splitPluginInstanceInterface.update();
        }

        const files = [...splitPluginInstanceInterface.treeInterface.listAll()];

        const path0 = pathutils.join("folder1", "file_0.txt");
        const path1 = pathutils.join("folder1", "file_1.txt");
        const path2 = pathutils.join("folder1", "file_2.txt");
        const path3 = pathutils.join("folder1", "file_3.txt");

        const path4 = pathutils.join("folder2", "file_0.png");
        const path5 = pathutils.join("folder2", "file_1.png");
        const path6 = pathutils.join("folder2", "file_2.png");
        const path7 = pathutils.join("folder2", "file_3.png");

        expect(files).to.have.same.members(["", "folder1", "folder2", originalPath1, path0, path1, path2, path3]);

        expect(splitPluginInstanceInterface.treeInterface.get(path0).toString()).to.be.equal("a");
        expect(splitPluginInstanceInterface.treeInterface.get(path1).toString()).to.be.equal("file");
        expect(splitPluginInstanceInterface.treeInterface.get(path2).toString()).to.be.equal("to");
        expect(splitPluginInstanceInterface.treeInterface.get(path3).toString()).to.be.equal("split");
        expect(splitPluginInstanceInterface.treeInterface.get(originalPath1).toString()).to.be.equal("a file to split");

        await splitPluginInstanceInterface.setup(
            winstonlogger,
            config2,
            baseTree,
            needsUpdateCallback);

        while (splitPluginInstanceInterface.needsUpdate()) {
            await splitPluginInstanceInterface.update();
        }

        const filesAfter = [...splitPluginInstanceInterface.treeInterface.listAll()];
        expect(filesAfter).to.have.same.members(["", "folder1", "folder2", originalPath0, path4, path5, path6, path7]);

        expect(splitPluginInstanceInterface.treeInterface.get(path4).toString()).to.be.equal("a");
        expect(splitPluginInstanceInterface.treeInterface.get(path5).toString()).to.be.equal("file");
        expect(splitPluginInstanceInterface.treeInterface.get(path6).toString()).to.be.equal("to");
        expect(splitPluginInstanceInterface.treeInterface.get(path7).toString()).to.be.equal("split");
        expect(splitPluginInstanceInterface.treeInterface.get(originalPath0).toString()).to.be.equal("a file to split");
    });

    it("test not setup or destroyed", async () => {
        const baseTree = new PathTree<Buffer>();

        const splitPlugin = new SplitPlugin();
        const pluginInterface: IRecipePlugin = splitPlugin;

        const pluginInstanceInterface = pluginInterface.createInstance();
        const splitPluginInstance: SplitPluginInstance = pluginInstanceInterface as SplitPluginInstance;

        expect(splitPluginInstance.needsUpdate()).to.be.false;
        expect(await runAndReturnError(async () => {
            await splitPluginInstance.update();
        })).to.be.null;

        expect(await runAndReturnError(async () => {
            await splitPluginInstance.reset();
        })).to.be.null;

        expect(await runAndReturnError(async () => {
            await splitPluginInstance.destroy();
        })).to.be.null;

        await pluginInstanceInterface.setup(
            winstonlogger,
            {extensionToSplit: ".txt"},
            baseTree,
            needsUpdateCallback);

        await splitPluginInstance.destroy();

        expect(splitPluginInstance.needsUpdate()).to.be.false;

        expect(await runAndReturnError(async () => {
            await splitPluginInstance.update();
        })).to.be.null;

        expect(await runAndReturnError(async () => {
            await splitPluginInstance.reset();
        })).to.be.null;

        expect(await runAndReturnError(async () => {
            await splitPluginInstance.destroy();
        })).to.be.null;

        await pluginInstanceInterface.setup(
            winstonlogger,
            {extensionToSplit: ".txt"},
            baseTree,
            needsUpdateCallback);

        // check if everything is fine

        needsUpdate = false;
        baseTree.set(pathutils.join("folder1", "file.txt"), Buffer.from("a file to split"));

        expect(needsUpdate).to.be.true;
        while (pluginInstanceInterface.needsUpdate()) {
            await pluginInstanceInterface.update();
        }

        const files = [...pluginInstanceInterface.treeInterface.listAll()];

        const path0 = pathutils.join("folder1", "file_0.txt");
        const path1 = pathutils.join("folder1", "file_1.txt");
        const path2 = pathutils.join("folder1", "file_2.txt");
        const path3 = pathutils.join("folder1", "file_3.txt");

        expect(files).to.have.same.members(["", "folder1", path0, path1, path2, path3]);

        expect(pluginInstanceInterface.treeInterface.get(path0).toString()).to.be.equal("a");
        expect(pluginInstanceInterface.treeInterface.get(path1).toString()).to.be.equal("file");
        expect(pluginInstanceInterface.treeInterface.get(path2).toString()).to.be.equal("to");
        expect(pluginInstanceInterface.treeInterface.get(path3).toString()).to.be.equal("split");
    });

    it("test setup null params", async () => {
        const baseTree = new PathTree<Buffer>();

        const splitPlugin = new SplitPlugin();
        const pluginInterface: IRecipePlugin = splitPlugin;

        const pluginInstanceInterface = pluginInterface.createInstance();
        const splitPluginInstance: SplitPluginInstance = pluginInstanceInterface as SplitPluginInstance;

        expect(await runAndReturnError(async () => {
        await pluginInstanceInterface.setup(
            null,
            {extensionToSplit: ".txt"},
            baseTree,
            needsUpdateCallback);
        })).to.be.not.null;
        expect(await runAndReturnError(async () => {
        await pluginInstanceInterface.setup(
            winstonlogger,
            null,
            baseTree,
            needsUpdateCallback);
        })).to.be.not.null;
        expect(await runAndReturnError(async () => {
        await pluginInstanceInterface.setup(
            winstonlogger,
            {extensionToSplit: ".txt"},
            null,
            needsUpdateCallback);
        })).to.be.not.null;
        expect(await runAndReturnError(async () => {
        await pluginInstanceInterface.setup(
            winstonlogger,
            {extensionToSplit: ".txt"},
            baseTree,
            null);
        })).to.be.not.null;
    });

    it("test reset when actually empty", async () => {
        const baseTree = new PathTree<Buffer>();

        const splitPlugin = new SplitPlugin();
        const pluginInterface: IRecipePlugin = splitPlugin;

        const pluginInstanceInterface = pluginInterface.createInstance();
        const splitPluginInstance: SplitPluginInstance = pluginInstanceInterface as SplitPluginInstance;

        await pluginInstanceInterface.setup(
            winstonlogger,
            {extensionToSplit: ".txt"},
            baseTree,
            needsUpdateCallback);

        baseTree.set("afile.txt", Buffer.from("file content"));

        while (pluginInstanceInterface.needsUpdate()) {
            await pluginInstanceInterface.update();
        }

        baseTree.remove("");

        await pluginInstanceInterface.reset();

        while (pluginInstanceInterface.needsUpdate()) {
            await pluginInstanceInterface.update();
        }

        expect([...pluginInstanceInterface.treeInterface.listAll()]).to.be.empty;
    });
});
