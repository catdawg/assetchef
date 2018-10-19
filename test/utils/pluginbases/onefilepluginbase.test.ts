// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";
import { VError } from "verror";

import { IRecipePlugin } from "../../../src/plugin/irecipeplugin";
import { ISchemaDefinition } from "../../../src/plugin/ischemadefinition";
import { PathTree } from "../../../src/utils/path/pathtree";
import { OneFilePluginBase } from "../../../src/utils/pluginbases/onefilepluginbase";
import winstonlogger from "../../../src/utils/winstonlogger";

interface ISplitPluginConfig {
    extensionToSplit: string;
}

class SplitPlugin extends OneFilePluginBase {

    public setupComplete: boolean = false;
    public destroyed: boolean = false;

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
        this.destroyed = true;
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

class BrokenPlugin extends OneFilePluginBase {
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
    protected getConfigSchema(): ISchemaDefinition {
        return {};
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

    it("test simple", async () => {
        const baseTree = new PathTree<Buffer>();

        const splitPlugin = new SplitPlugin();
        const splitPluginInterface: IRecipePlugin = splitPlugin;

        const pluginTree =
            await splitPluginInterface.setup(
                winstonlogger, {extensionToSplit: ".txt"}, baseTree.getReadonlyInterface());

        expect(splitPlugin.setupComplete).to.be.true;

        const mainFile = pathutils.join("folder1", "file.txt");
        const ignoredFile = pathutils.join("folder1", "file.png");

        baseTree.set(mainFile, Buffer.from("a file to split"));
        baseTree.set(ignoredFile, Buffer.from("an image"));

        await splitPluginInterface.update();

        const checkFull = () => {
            const files = [...pluginTree.listAll()];

            const path0 = pathutils.join("folder1", "file_0.txt");
            const path1 = pathutils.join("folder1", "file_1.txt");
            const path2 = pathutils.join("folder1", "file_2.txt");
            const path3 = pathutils.join("folder1", "file_3.txt");

            expect(files).to.have.same.members(["", "folder1", path0, path1, path2, path3, ignoredFile]);

            expect(pluginTree.get(path0).toString()).to.be.equal("a");
            expect(pluginTree.get(path1).toString()).to.be.equal("file");
            expect(pluginTree.get(path2).toString()).to.be.equal("to");
            expect(pluginTree.get(path3).toString()).to.be.equal("split");
            expect(pluginTree.get(ignoredFile).toString()).to.be.equal("an image");
        };

        checkFull();

        await splitPluginInterface.reset();

        await splitPluginInterface.update();

        checkFull();

        baseTree.remove(mainFile);

        await splitPluginInterface.update();

        const filesAfterRemoval = [...pluginTree.listAll()];
        expect(filesAfterRemoval).to.have.same.members(["", "folder1", ignoredFile]);

        await splitPluginInterface.destroy();
        expect(splitPlugin.destroyed).to.be.true;
    });

    it("test file change", async () => {
        const baseTree = new PathTree<Buffer>();

        const splitPlugin = new SplitPlugin();
        const splitPluginInterface: IRecipePlugin = splitPlugin;

        const pluginTree =
            await splitPluginInterface.setup(
                winstonlogger, {extensionToSplit: ".txt"}, baseTree.getReadonlyInterface());

        expect(splitPlugin.setupComplete).to.be.true;

        baseTree.set(pathutils.join("folder1", "file.txt"), Buffer.from("a file to split"));

        await splitPluginInterface.update();

        const files = [...pluginTree.listAll()];

        const path0 = pathutils.join("folder1", "file_0.txt");
        const path1 = pathutils.join("folder1", "file_1.txt");
        const path2 = pathutils.join("folder1", "file_2.txt");
        const path3 = pathutils.join("folder1", "file_3.txt");

        expect(files).to.have.same.members(["", "folder1", path0, path1, path2, path3]);

        expect(pluginTree.get(path0).toString()).to.be.equal("a");
        expect(pluginTree.get(path1).toString()).to.be.equal("file");
        expect(pluginTree.get(path2).toString()).to.be.equal("to");
        expect(pluginTree.get(path3).toString()).to.be.equal("split");

        baseTree.set(pathutils.join("folder1", "file.txt"), Buffer.from("another file"));

        await splitPluginInterface.update();

        const filesAfterChange = [...pluginTree.listAll()];

        expect(filesAfterChange).to.have.same.members(["", "folder1", path0, path1]);

        expect(pluginTree.get(path0).toString()).to.be.equal("another");
        expect(pluginTree.get(path1).toString()).to.be.equal("file");
    });

    it("test folder removal", async () => {
        const baseTree = new PathTree<Buffer>();

        const splitPlugin = new SplitPlugin();
        const splitPluginInterface: IRecipePlugin = splitPlugin;

        const pluginTree =
            await splitPluginInterface.setup(
                winstonlogger, {extensionToSplit: ".txt"}, baseTree.getReadonlyInterface());

        expect(splitPlugin.setupComplete).to.be.true;

        baseTree.set(pathutils.join("folder1", "file.txt"), Buffer.from("a file to split"));

        await splitPluginInterface.update();

        const files = [...pluginTree.listAll()];

        const path0 = pathutils.join("folder1", "file_0.txt");
        const path1 = pathutils.join("folder1", "file_1.txt");
        const path2 = pathutils.join("folder1", "file_2.txt");
        const path3 = pathutils.join("folder1", "file_3.txt");

        expect(files).to.have.same.members(["", "folder1", path0, path1, path2, path3]);

        expect(pluginTree.get(path0).toString()).to.be.equal("a");
        expect(pluginTree.get(path1).toString()).to.be.equal("file");
        expect(pluginTree.get(path2).toString()).to.be.equal("to");
        expect(pluginTree.get(path3).toString()).to.be.equal("split");

        baseTree.remove("folder1");

        await splitPluginInterface.update();

        const filesAfterChange = [...pluginTree.listAll()];

        expect(filesAfterChange).to.have.same.members([""]);
    });

    it("test error case", async () => {
        const plugin = new BrokenPlugin();

        const baseTree = new PathTree<Buffer>();

        await plugin.setup(winstonlogger, {}, baseTree.getReadonlyInterface());

        baseTree.set("file1", Buffer.from("content"));
        baseTree.set("file2", Buffer.from("content"));

        expect(await runAndReturnError(async () => { await plugin.update(); })).to.not.be.null;
    });
});
