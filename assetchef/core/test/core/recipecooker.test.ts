// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";
import { IRecipeStepConfig } from "../../src/core/irecipeconfig";
import { RecipeCooker } from "../../src/core/recipecooker";
import { IRecipePlugin } from "../../src/irecipeplugin";
import { ISchemaDefinition } from "../../src/ischemadefinition";
import { IPathTreeReadonly } from "../../src/path/ipathtreereadonly";
import { PathTree } from "../../src/path/pathtree";
import { OneFilePluginBase, OneFilePluginBaseInstance } from "../../src/pluginbases/onefilepluginbase";
import { FakeFSWatch } from "../../src/testutils/fakefswatch";
import { timeout } from "../../src/testutils/timeout";
import { winstonlogger } from "../../src/testutils/winstonlogger";

async function runAndReturnError(f: () => Promise<any>): Promise<Error> {
    try {
        await f();
    } catch (e) {
        return e;
    }
    return null;
}

interface IToUpperConfig {
    extensionToUpper: string;
}

class ToUpperPluginInstance extends OneFilePluginBaseInstance {
    private toUpperConfig: IToUpperConfig;
    protected shouldCook(path: string, content: Buffer): boolean {
        const parsedPath = pathutils.parse(path);
        return parsedPath.ext === this.toUpperConfig.extensionToUpper;
    }
    protected async cookFile(path: string, content: Buffer): Promise<Array<{path: string, content: Buffer}>> {
        const str = content.toString();
        return [{path, content: Buffer.from(str.toUpperCase())}];
    }
    protected async setupOneFilePlugin(config: any): Promise<void> {
        this.toUpperConfig = config;
    }

    protected async destroyOneFilePlugin(): Promise<void> {
        return;
    }
}

class ToUpperPlugin extends OneFilePluginBase<ToUpperPluginInstance> {
    protected getConfigSchema(): ISchemaDefinition {
        return {
            type: "object",
            properties: {
                extensionToUpper: {
                    type: "string",
                },
            },
            additionalProperties: false,
        };
    }
    protected createTypedBaseInstance(): ToUpperPluginInstance {
        return new ToUpperPluginInstance();
    }
}

interface ISplitPluginConfig {
    extensionToSplit: string;
}

class SplitPluginInstance extends OneFilePluginBaseInstance {
    public setupComplete: boolean = false;
    public pluginDestroyed: boolean = false;

    private splitPluginConfig: ISplitPluginConfig;

    protected shouldCook(path: string, content: Buffer): boolean {
        const parsedPath = pathutils.parse(path);
        return parsedPath.ext === this.splitPluginConfig.extensionToSplit;
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
        this.splitPluginConfig = config;
        this.setupComplete = true;
    }

    protected async destroyOneFilePlugin(): Promise<void> {
        this.pluginDestroyed = true;
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

class FinalPluginInstance extends OneFilePluginBaseInstance {

    public setupComplete: boolean = false;
    public pluginDestroyed: boolean = false;

    protected shouldCook(path: string, content: Buffer): boolean {
        return false;
    }

    protected async cookFile(path: string, content: Buffer): Promise<Array<{ path: string, content: Buffer }>> {
        return [{path, content}];
    }

    protected async setupOneFilePlugin(config: any): Promise<void> {
        return;
    }

    protected async destroyOneFilePlugin(): Promise<void> {
        return;
    }
}

class FinalPlugin extends OneFilePluginBase<FinalPluginInstance> {
    public instance: FinalPluginInstance;
    protected createTypedBaseInstance(): FinalPluginInstance {
        return this.instance = new FinalPluginInstance();
    }

    protected getConfigSchema(): ISchemaDefinition {
        return {};
    }
}

describe("recipecooker", () => {

    async function basicSetup(
        recipe: RecipeCooker,
        initialPathTree: PathTree<Buffer>,
        plugins: {[index: string]: IRecipePlugin}): Promise<void> {

        const fakeFSWatch: FakeFSWatch = new FakeFSWatch();
        const config: IRecipeStepConfig[] = [
            {
                toupper: {
                    config: {
                        extensionToUpper: ".txt",
                    },
                    next: [{
                        split: {
                            config: {
                                extensionToSplit: ".txt",
                            },
                            next: [{
                                final: {
                                    config: {},
                                    next: [],
                                },
                            }],
                        },
                    }],
                },
            },
        ];

        await recipe.setup(
            winstonlogger,
            "",
            fakeFSWatch,
            config,
            initialPathTree,
            plugins);

        await recipe.cookOnce();
    }

    function case1(initialPathTree: PathTree<Buffer>, filenamepostfix: string) {
        initialPathTree.set("a file" + filenamepostfix + ".txt", Buffer.from("data in this file"));
        initialPathTree.set("another file" + filenamepostfix + ".png", Buffer.from("image"));
    }

    function checkCase1(finalTree: IPathTreeReadonly<Buffer>, filenamepostfix: string) {
        const files = [...finalTree.listAll()];

        const path0 = pathutils.join("a file" + filenamepostfix + "_0.txt");
        const path1 = pathutils.join("a file" + filenamepostfix + "_1.txt");
        const path2 = pathutils.join("a file" + filenamepostfix + "_2.txt");
        const path3 = pathutils.join("a file" + filenamepostfix + "_3.txt");

        expect(files).to.have.same.members(["", path0, path1, path2, path3, "another file" + filenamepostfix + ".png"]);

        expect(finalTree.get(path0).toString()).to.be.equal("DATA");
        expect(finalTree.get(path1).toString()).to.be.equal("IN");
        expect(finalTree.get(path2).toString()).to.be.equal("THIS");
        expect(finalTree.get(path3).toString()).to.be.equal("FILE");
    }

    function case1Addition(initialPathTree: PathTree<Buffer>, filenamepostfix: string) {
        initialPathTree.set("another file2" + filenamepostfix + ".png", Buffer.from("image2"));
    }

    function checkCase1Addition(finalTree: IPathTreeReadonly<Buffer>, filenamepostfix: string) {

        const files2 = [...finalTree.listAll()];

        const path0 = pathutils.join("a file" + filenamepostfix + "_0.txt");
        const path1 = pathutils.join("a file" + filenamepostfix + "_1.txt");
        const path2 = pathutils.join("a file" + filenamepostfix + "_2.txt");
        const path3 = pathutils.join("a file" + filenamepostfix + "_3.txt");

        expect(files2).to.have.same.members(
            ["",
            path0,
            path1,
            path2,
            path3,
            "another file" + filenamepostfix + ".png",
            "another file2" + filenamepostfix + ".png"]);

        expect(finalTree.get(path0).toString()).to.be.equal("DATA");
        expect(finalTree.get(path1).toString()).to.be.equal("IN");
        expect(finalTree.get(path2).toString()).to.be.equal("THIS");
        expect(finalTree.get(path3).toString()).to.be.equal("FILE");
    }

    it("test without setup", async () => {
        const recipe = new RecipeCooker();

        await recipe.cookOnce();

        await recipe.reset();

        await recipe.destroy();
    });

    it("test simple", async () => {
        const initialPathTree = new PathTree<Buffer>();

        const finalPlugin = new FinalPlugin();
        const plugins = {toupper: new ToUpperPlugin(), split: new SplitPlugin(), final: finalPlugin};

        const recipe = new RecipeCooker();
        await basicSetup(recipe, initialPathTree, plugins);

        case1(initialPathTree, "_case1");

        await recipe.cookOnce();

        const finalTree = finalPlugin.instance.treeInterface;

        checkCase1(finalTree, "_case1");
    });

    it("test reset", async () => {
        const initialPathTree = new PathTree<Buffer>();

        const finalPlugin = new FinalPlugin();
        const plugins = {toupper: new ToUpperPlugin(), split: new SplitPlugin(), final: finalPlugin};

        const recipe = new RecipeCooker();
        await basicSetup(recipe, initialPathTree, plugins);

        case1(initialPathTree, "_case1");

        await recipe.cookOnce();

        await recipe.reset();

        case1Addition(initialPathTree, "_case1");

        await recipe.cookOnce();
        const finalTree = finalPlugin.instance.treeInterface;
        checkCase1Addition(finalTree, "_case1");
    });

    it("test destroy", async () => {
        let initialPathTree = new PathTree<Buffer>();

        const finalPlugin = new FinalPlugin();
        const plugins = {toupper: new ToUpperPlugin(), split: new SplitPlugin(), final: finalPlugin};

        const recipe = new RecipeCooker();
        await basicSetup(recipe, initialPathTree, plugins);

        case1(initialPathTree, "_case1");

        await recipe.cookOnce();

        let finalTree = finalPlugin.instance.treeInterface;

        await recipe.destroy();

        initialPathTree = new PathTree<Buffer>();
        await basicSetup(recipe, initialPathTree, plugins);

        case1(initialPathTree, "_case2_");

        await recipe.cookOnce();

        finalTree = finalPlugin.instance.treeInterface;

        checkCase1(finalTree, "_case2_");
    });

    it("test reconfigure with different config", async () => {
        const initialPathTree = new PathTree<Buffer>();

        const finalPlugin = new FinalPlugin();
        const plugins = {toupper: new ToUpperPlugin(), split: new SplitPlugin(), final: finalPlugin};

        const recipe = new RecipeCooker();
        await basicSetup(recipe, initialPathTree, plugins);

        case1(initialPathTree, "_case1");

        await recipe.cookOnce();

        let finalTree = finalPlugin.instance.treeInterface;

        const config: IRecipeStepConfig[] = [
            {
                toupper: {
                    config: {
                        extensionToUpper: ".png",
                    },
                    next: [{
                        split: {
                            config: {
                                extensionToSplit: ".png",
                            },
                            next: [{
                                final: {
                                    config: {},
                                    next: [],
                                },
                            }],
                        },
                    }],
                },
            },
        ];

        const fakeFSWatch = new FakeFSWatch();

        recipe.setup(winstonlogger, "", fakeFSWatch, config, initialPathTree, plugins);

        await recipe.cookOnce();

        finalTree = finalPlugin.instance.treeInterface;

        const files = [...finalTree.listAll()];

        expect(files).to.have.same.members(["", "a file_case1.txt", "another file_case1_0.png"]);
        expect(finalTree.get("another file_case1_0.png").toString()).to.be.equal("IMAGE");
    });

    it("test reconfigure with different steps", async () => {
        const initialPathTree = new PathTree<Buffer>();

        const finalPlugin = new FinalPlugin();
        const plugins = {toupper: new ToUpperPlugin(), split: new SplitPlugin(), final: finalPlugin};

        const recipe = new RecipeCooker();
        await basicSetup(recipe, initialPathTree, plugins);

        case1(initialPathTree, "_case1");

        await recipe.cookOnce();

        let finalTree = finalPlugin.instance.treeInterface;

        const config: IRecipeStepConfig[] = [
            {
                split: {
                    config: {
                        extensionToSplit: ".png",
                    },
                    next: [{
                        final: {
                            config: {},
                            next: [],
                        },
                    }],
                },
            },
        ];

        const fakeFSWatch = new FakeFSWatch();
        await recipe.setup(winstonlogger, "",
             fakeFSWatch, config, initialPathTree, plugins);
        winstonlogger.logInfo("======here");
        finalTree = finalPlugin.instance.treeInterface;

        await recipe.cookOnce();

        const files = [...finalTree.listAll()];

        expect(files).to.have.same.members(["", "a file_case1.txt", "another file_case1_0.png"]);
        expect(finalTree.get("another file_case1_0.png").toString()).to.be.equal("image");
    });

    it("test actions while cooking", async () => {
        const initialPathTree = new PathTree<Buffer>();

        const finalPlugin = new FinalPlugin();
        const plugins = {toupper: new ToUpperPlugin(), split: new SplitPlugin(), final: finalPlugin};

        const recipe = new RecipeCooker();
        await basicSetup(recipe, initialPathTree, plugins);

        case1(initialPathTree, "_case1");

        await Promise.all([
            (async () => {
                await recipe.cookContinuously();
            })(),
            (async () => {
                await timeout(50);
                expect(await runAndReturnError(async () => await recipe.cookContinuously())).to.be.not.null;
            })(),
            (async () => {
                await timeout(50);
                expect(await runAndReturnError(async () => await recipe.cookOnce())).to.be.not.null;
            })(),
            (async () => {
                await timeout(50);
                expect(await runAndReturnError(async () => await recipe.destroy())).to.be.not.null;
            })(),
            (async () => {
                await timeout(50);
                expect(
                    await runAndReturnError(
                        async () => await basicSetup(recipe, initialPathTree, plugins))).to.be.not.null;
            })(),
            (async () => {
                await timeout(50);
                expect(await runAndReturnError(async () => await recipe.reset())).to.be.not.null;
            })(),
            (async () => {
                await timeout(50);
                case1Addition(initialPathTree, "_case1");
            })(),
            (async () => {
                await timeout(200);
                await recipe.stopCooking();
            })(),
        ]);

        checkCase1Addition(finalPlugin.instance.treeInterface, "_case1");
    });

    it("test stop cooking while not cooking", async () => {
        const initialPathTree = new PathTree<Buffer>();

        const finalPlugin = new FinalPlugin();
        const plugins = {toupper: new ToUpperPlugin(), split: new SplitPlugin(), final: finalPlugin};

        const recipe = new RecipeCooker();
        await basicSetup(recipe, initialPathTree, plugins);

        case1(initialPathTree, "_case1");

        recipe._actionForTestingMidCooking = async () => {
            recipe.stopCooking(); // not await so it doesn't deadlock
        };

        await recipe.cookOnce(); // will stop this

        expect([...finalPlugin.instance.treeInterface.listAll()]).to.be.empty;

        await recipe.cookOnce();

        checkCase1(finalPlugin.instance.treeInterface, "_case1");
    });

    it("test stop cooking while processing", async () => {
        const initialPathTree = new PathTree<Buffer>();

        const finalPlugin = new FinalPlugin();
        const plugins = {toupper: new ToUpperPlugin(), split: new SplitPlugin(), final: finalPlugin};

        const recipe = new RecipeCooker();
        await basicSetup(recipe, initialPathTree, plugins);

        case1(initialPathTree, "_case1");

        await recipe.stopCooking(); // nothing happens

        await recipe.cookOnce();

        checkCase1(finalPlugin.instance.treeInterface, "_case1");
    });
});
