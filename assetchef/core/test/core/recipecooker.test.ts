import { IRecipeStepConfig } from "../../src/core/irecipeconfig";
import { RecipeCooker } from "../../src/core/recipecooker";
import { IRecipePlugin } from "../../src/irecipeplugin";
import { ISchemaDefinition } from "../../src/ischemadefinition";
import { IPathTreeRead } from "../../src/path/ipathtreeread";
import { PathTree } from "../../src/path/pathtree";
import { PathUtils } from "../../src/path/pathutils";
import { OneFilePluginBase, OneFilePluginBaseInstance } from "../../src/pluginbases/onefilepluginbase";
import { MockAsyncPathTree } from "../../src/testutils/mockasyncpathtree";
import { timeout } from "../../src/testutils/timeout";
import { winstonlogger } from "../../src/testutils/winstonlogger";

interface IToUpperConfig {
    extensionToUpper: string;
}

class ToUpperPluginInstance extends OneFilePluginBaseInstance {
    private toUpperConfig: IToUpperConfig;
    protected shouldCook(path: string, content: Buffer): boolean {
        const parsedPath = PathUtils.parse(path);
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

        const syncTree = new PathTree<Buffer>();
        const projectTree = new MockAsyncPathTree<Buffer>(syncTree);

        const config: IRecipeStepConfig[] = [
            {
                toupper: {
                    config: {
                        extensionToUpper: ".txt",
                    },
                },
            }, {
                split: {
                    config: {
                        extensionToSplit: ".txt",
                    },
                },
            }, {
                final: {
                    config: {},
                },
            },
        ];

        await recipe.setup(
            winstonlogger,
            projectTree,
            config,
            initialPathTree,
            plugins);

        await recipe.cookOnce();
    }

    function case1(initialPathTree: PathTree<Buffer>, filenamepostfix: string) {
        initialPathTree.set("a file" + filenamepostfix + ".txt", Buffer.from("data in this file"));
        initialPathTree.set("another file" + filenamepostfix + ".png", Buffer.from("image"));
    }

    function checkCase1(finalTree: IPathTreeRead<Buffer>, filenamepostfix: string) {
        const files = [...finalTree.listAll()];

        const path0 = PathUtils.join("a file" + filenamepostfix + "_0.txt");
        const path1 = PathUtils.join("a file" + filenamepostfix + "_1.txt");
        const path2 = PathUtils.join("a file" + filenamepostfix + "_2.txt");
        const path3 = PathUtils.join("a file" + filenamepostfix + "_3.txt");

        expect(files).toIncludeSameMembers(["", path0, path1, path2, path3, "another file" + filenamepostfix + ".png"]);

        expect(finalTree.get(path0).toString()).toEqual("DATA");
        expect(finalTree.get(path1).toString()).toEqual("IN");
        expect(finalTree.get(path2).toString()).toEqual("THIS");
        expect(finalTree.get(path3).toString()).toEqual("FILE");
    }

    function case1Addition(initialPathTree: PathTree<Buffer>, filenamepostfix: string) {
        initialPathTree.set("another file2" + filenamepostfix + ".png", Buffer.from("image2"));
    }

    function checkCase1Addition(finalTree: IPathTreeRead<Buffer>, filenamepostfix: string) {

        const files2 = [...finalTree.listAll()];

        const path0 = PathUtils.join("a file" + filenamepostfix + "_0.txt");
        const path1 = PathUtils.join("a file" + filenamepostfix + "_1.txt");
        const path2 = PathUtils.join("a file" + filenamepostfix + "_2.txt");
        const path3 = PathUtils.join("a file" + filenamepostfix + "_3.txt");

        expect(files2).toIncludeSameMembers(
            ["",
            path0,
            path1,
            path2,
            path3,
            "another file" + filenamepostfix + ".png",
            "another file2" + filenamepostfix + ".png"]);

        expect(finalTree.get(path0).toString()).toEqual("DATA");
        expect(finalTree.get(path1).toString()).toEqual("IN");
        expect(finalTree.get(path2).toString()).toEqual("THIS");
        expect(finalTree.get(path3).toString()).toEqual("FILE");
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
                },
            }, {
                split: {
                    config: {
                        extensionToSplit: ".png",
                    },
                },
            }, {
                final: {
                    config: {},
                },
            },
        ];

        const syncTree = new PathTree<Buffer>();
        const projectTree = new MockAsyncPathTree<Buffer>(syncTree);

        recipe.setup(winstonlogger, projectTree, config, initialPathTree, plugins);

        await recipe.cookOnce();

        finalTree = finalPlugin.instance.treeInterface;

        const files = [...finalTree.listAll()];

        expect(files).toIncludeSameMembers(["", "a file_case1.txt", "another file_case1_0.png"]);
        expect(finalTree.get("another file_case1_0.png").toString()).toEqual("IMAGE");
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
                },
            }, {
                final: {
                    config: {},
                },
            },
        ];

        const syncTree = new PathTree<Buffer>();
        const projectTree = new MockAsyncPathTree<Buffer>(syncTree);
        await recipe.setup(winstonlogger, projectTree, config, initialPathTree, plugins);
        winstonlogger.logInfo("======here");
        finalTree = finalPlugin.instance.treeInterface;

        await recipe.cookOnce();

        const files = [...finalTree.listAll()];

        expect(files).toIncludeSameMembers(["", "a file_case1.txt", "another file_case1_0.png"]);
        expect(finalTree.get("another file_case1_0.png").toString()).toEqual("image");
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
                await expect(recipe.cookContinuously()).rejects.toThrow();
            })(),
            (async () => {
                await timeout(50);
                await expect(recipe.cookOnce()).rejects.toThrow();
            })(),
            (async () => {
                await timeout(50);
                await expect(recipe.destroy()).rejects.toThrow();
            })(),
            (async () => {
                await timeout(50);
                await expect(basicSetup(recipe, initialPathTree, plugins)).rejects.toThrow();
            })(),
            (async () => {
                await timeout(50);
                await expect(recipe.reset()).rejects.toThrow();
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

        expect([...finalPlugin.instance.treeInterface.listAll()]).toBeEmpty();

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
