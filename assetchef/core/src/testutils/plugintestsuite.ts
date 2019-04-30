import "jest-extended";

import { IRecipePlugin, IRecipePluginInstance } from "../irecipeplugin";
import { IFileInfo } from "../path/ifileinfo";
import { IPathTreeAsyncRead } from "../path/ipathtreeasyncread";
import { IPathTreeAsyncWrite } from "../path/ipathtreeasyncwrite";
import { IPathTreeRead } from "../path/ipathtreeread";
import { PathTree } from "../path/pathtree";
import { PathUtils } from "../path/pathutils";
import { MockAsyncPathTree } from "./mockasyncpathtree";
import { timeout } from "./timeout";
import { winstonlogger } from "./winstonlogger";

export interface IPluginChange {
    change: (
        pluginInstance: IRecipePluginInstance,
        projectTree: IPathTreeAsyncRead<Buffer> & IPathTreeAsyncWrite<Buffer>,
        prevNodeContents: PathTree<Buffer>) => Promise<void>;
    projectContentsAfter?: IPathTreeRead<Buffer>;
    nodeContentsAfter?: IPathTreeRead<Buffer>;
}

export interface IPluginSimpleTestCase {
    config: any;
    projectContentsBefore?: IPathTreeRead<Buffer>;
    nodeContentsBefore?: IPathTreeRead<Buffer>;
    change1: IPluginChange;
    change2: IPluginChange;
}
export interface IPluginTestCase {
    name: string;
    config: any;
    projectContentsBefore?: IPathTreeRead<Buffer>;
    nodeContentsBefore?: IPathTreeRead<Buffer>;
    changes: IPluginChange[];
}

export interface IPluginTestCases {
    simple: IPluginSimpleTestCase;
    others: IPluginTestCase[];
}

async function getStat(
    projectTree: IPathTreeAsyncRead<Buffer> & IPathTreeAsyncRead<Buffer>,
    path: string): Promise<IFileInfo> {
    let rootStat: IFileInfo = null;
    try {
        rootStat = await projectTree.getInfo(path);
    } catch (e) {
        return null;
    }

    return rootStat;
}

async function writeIntoProjectTree(
    projectTree: IPathTreeAsyncWrite<Buffer> & IPathTreeAsyncRead<Buffer>,
    content: IPathTreeRead<Buffer>): Promise<void> {

    try {
        await projectTree.remove("");
    } catch (e) {
        // probably doesn't exist
    }
    if (content == null) {
        return;
    }

    for (const p of content.listAll()) {
        if (content.isDir(p)) {
            await projectTree.createFolder(p);
        } else {
            await projectTree.set(p, content.get(p));
        }
    }
}

function writeIntoPathTree(tree: PathTree<Buffer>, content: IPathTreeRead<Buffer>) {
    if (tree.exists("")) {
        tree.remove("");
    }
    if (content == null) {
        return;
    }
    for (const p of content.listAll()) {
        if (content.isDir(p)) {
            tree.createFolder(p);
        } else {
            tree.set(p, content.get(p));
        }
    }
}

async function checkTreeReflectActualDirectory(
    pathTree: IPathTreeRead<Buffer>,
    projectTree: IPathTreeAsyncRead<Buffer> & IPathTreeAsyncRead<Buffer>,
): Promise<void> {
    if (pathTree == null) {
        return; // not important
    }

    if (!pathTree.exists("")) {
        return;
    }

    const rootStat = await getStat(projectTree, "");

    if (rootStat == null) {
        expect(pathTree.exists("")).toBeFalse();
        return;
    } else if (!rootStat.isDirectory()) {
        expect(pathTree.exists("")).toBeTrue();
        expect(pathTree.isDir("")).toBeFalse();

        const rootContent = await projectTree.get("");
        expect(pathTree.get("")).toEqual(rootContent);
        return;
    }

    const directoriesToVist: string[] = [""];

    while (directoriesToVist.length > 0) {
        const directory = directoriesToVist.pop();

        const pathsInMem = [...pathTree.list(directory)];
        const pathsInFs = await projectTree.list(directory);

        if (pathsInMem.length !== pathsInFs.length) {
            winstonlogger.logError("in FS: %s", pathsInFs);
            winstonlogger.logError("in Tree: %s", pathsInMem);
        }

        expect(pathsInMem).toIncludeSameMembers(pathsInFs);

        for (const p of pathsInFs) {
            const fullPath = PathUtils.join(directory, p);
            const relativePath = PathUtils.join(directory, p);

            const isDirInMem = pathTree.isDir(relativePath);
            const isDirInFs = (await projectTree.getInfo(fullPath)).isDirectory();

            expect(isDirInMem).toBe(isDirInFs);

            if (isDirInFs) {
                directoriesToVist.push(relativePath);
            } else {
                const contentInFs = await projectTree.get(PathUtils.join(directory, p));
                const contentInMem = pathTree.get(relativePath);

                expect(contentInFs).toEqual(contentInMem);
            }
        }
    }
}

function checkTree(actual: IPathTreeRead<Buffer>, expected: IPathTreeRead<Buffer>) {
    if (expected == null) {
        return; // not important
    }
    const listActual = [...actual.listAll()];
    const listExpected = [...expected.listAll()];

    expect(listActual).toIncludeSameMembers(listExpected);
    for (const p of listActual) {
        if (actual.isDir(p)) {
            expect(expected.isDir(p)).toBeTrue();
        } else {
            expect(actual.get(p)).toEqual(expected.get(p));
        }
    }
}

async function checkChange(
    prevTree: PathTree<Buffer>,
    projectTree: IPathTreeAsyncRead<Buffer> & IPathTreeAsyncWrite<Buffer>,
    pluginInstance: IRecipePluginInstance,
    change: IPluginChange) {

    await change.change(pluginInstance, projectTree, prevTree);
    await timeout(projectTree.delayMs);

    while (pluginInstance.needsUpdate()) {
        await pluginInstance.update();
    }

    await checkTreeReflectActualDirectory(change.projectContentsAfter, projectTree);
    checkTree(pluginInstance.treeInterface, change.nodeContentsAfter);
}

export function plugintests(name: string, testFSPath: string, plugin: IRecipePlugin, testCases: IPluginTestCases) {

    let pluginInstance: IRecipePluginInstance;
    let prevTree: PathTree<Buffer>;
    let syncProjectTree: PathTree<Buffer>;
    let projectTree: MockAsyncPathTree<Buffer>;
    let needsProcessingCalled: boolean;

    describe("plugin " + name, () => {

        beforeEach(async () => {
            winstonlogger.logInfo("before each...");
            syncProjectTree = new PathTree<Buffer>();
            projectTree = new MockAsyncPathTree<Buffer>(syncProjectTree);
            pluginInstance = plugin.createInstance();
            prevTree = new PathTree<Buffer>();
        });
        afterEach(async () => {
            winstonlogger.logInfo("after each...");
            await pluginInstance.destroy();
        });

        it ("simple test", async () => {
            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectTree,
            });

            await writeIntoProjectTree(projectTree, testCases.simple.projectContentsBefore);
            writeIntoPathTree(prevTree, testCases.simple.nodeContentsBefore);

            await checkChange(prevTree, projectTree, pluginInstance, testCases.simple.change1);
            await checkChange(prevTree, projectTree, pluginInstance, testCases.simple.change2);

        }, 10000);

        it ("setup destroy setup", async () => {
            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectTree,
            });

            await writeIntoProjectTree(projectTree, testCases.simple.projectContentsBefore);
            writeIntoPathTree(prevTree, testCases.simple.nodeContentsBefore);

            await checkChange(prevTree, projectTree, pluginInstance, testCases.simple.change1);

            await pluginInstance.destroy();

            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectTree,
            });
            await checkChange(prevTree, projectTree, pluginInstance, testCases.simple.change2);

        }, 10000);

        it ("reset", async () => {
            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectTree,
            });

            await writeIntoProjectTree(projectTree, testCases.simple.projectContentsBefore);
            writeIntoPathTree(prevTree, testCases.simple.nodeContentsBefore);

            await checkChange(prevTree, projectTree, pluginInstance, testCases.simple.change1);

            await pluginInstance.reset();

            await checkChange(prevTree, projectTree, pluginInstance, testCases.simple.change2);

        }, 10000);

        it ("double setup", async () => {
            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectTree,
            });

            await writeIntoProjectTree(projectTree, testCases.simple.projectContentsBefore);
            writeIntoPathTree(prevTree, testCases.simple.nodeContentsBefore);

            await checkChange(prevTree, projectTree, pluginInstance, testCases.simple.change1);

            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectTree,
            });
            await checkChange(prevTree, projectTree, pluginInstance, testCases.simple.change2);

        }, 10000);

        it ("fs watch reset", async () => {
            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectTree,
            });

            await writeIntoProjectTree(projectTree, testCases.simple.projectContentsBefore);
            writeIntoPathTree(prevTree, testCases.simple.nodeContentsBefore);

            await checkChange(prevTree, projectTree, pluginInstance, testCases.simple.change1);

            projectTree.resetListen();
            await checkChange(prevTree, projectTree, pluginInstance, testCases.simple.change2);

        }, 10000);

        for (const testCase of testCases.others) {
            it ("test case " + testCase.name, async () => {
                await pluginInstance.setup({
                    config: testCase.config,
                    logger: winstonlogger,
                    needsProcessingCallback: () => {
                        needsProcessingCalled = true;
                    },
                    prevStepTreeInterface: prevTree,
                    projectTree,
                });

                await writeIntoProjectTree(projectTree, testCase.projectContentsBefore);
                writeIntoPathTree(prevTree, testCase.nodeContentsBefore);

                for (const change of testCase.changes) {
                    await checkChange(prevTree, projectTree, pluginInstance, change);
                }
            }, 1000000);
        }
    });
}
