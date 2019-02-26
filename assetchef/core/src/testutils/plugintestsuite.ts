// tslint:disable:no-unused-expression
import * as chai from "chai";

import * as fse from "fs-extra";
import * as pathutils from "path";

import { addPrefixToLogger } from "../comm/addprefixtologger";
import { IRecipePlugin, IRecipePluginInstance } from "../irecipeplugin";
import { IPathTreeReadonly } from "../path/ipathtreereadonly";
import { PathTree } from "../path/pathtree";
import { WatchmanFSWatch } from "../watch/fswatch_watchman";
import { ICancelWatch } from "../watch/ifswatch";
import { TmpFolder } from "./tmpfolder";
import { winstonlogger } from "./winstonlogger";

const expect = chai.expect;

export interface IPluginChange {
    change: (
        pluginInstance: IRecipePluginInstance, testFSPath: string, prevNodeContents: PathTree<Buffer>) => Promise<void>;
    fsContentsAfter?: IPathTreeReadonly<Buffer>;
    nodeContentsAfter?: IPathTreeReadonly<Buffer>;
}

export interface IPluginSimpleTestCase {
    config: any;
    fsContentsBefore?: IPathTreeReadonly<Buffer>;
    nodeContentsBefore?: IPathTreeReadonly<Buffer>;
    change1: IPluginChange;
    change2: IPluginChange;
}
export interface IPluginTestCase {
    name: string;
    config: any;
    fsContentsBefore?: IPathTreeReadonly<Buffer>;
    nodeContentsBefore?: IPathTreeReadonly<Buffer>;
    changes: IPluginChange[];
}

export interface IPluginTestCases {
    simple: IPluginSimpleTestCase;
    others: IPluginTestCase[];
}

async function getStat(path: string): Promise<fse.Stats> {
    let rootStat: fse.Stats = null;
    try {
        rootStat = await fse.stat(path);
    } catch (e) {
        return null;
    }

    return rootStat;
}

async function writeIntoFS(testPath: string, content: IPathTreeReadonly<Buffer>): Promise<void> {

    await fse.remove(testPath);
    if (content == null) {
        return;
    }

    for (const p of content.listAll()) {
        const fsPath = pathutils.join(testPath, p);
        if (content.isDir(p)) {
            await fse.mkdir (fsPath);
        } else {
            await fse.writeFile(fsPath, content.get(p));
        }
    }
}

function writeIntoPathTree(tree: PathTree<Buffer>, content: IPathTreeReadonly<Buffer>) {
    if (tree.exists("")) {
        tree.remove("");
    }
    if (content == null) {
        return;
    }
    for (const p of content.listAll()) {
        if (content.isDir(p)) {
            tree.mkdir(p);
        } else {
            tree.set(p, content.get(p));
        }
    }
}

async function checkTreeReflectActualDirectory(
    pathTree: IPathTreeReadonly<Buffer>,
    path: string,
): Promise<void> {
    if (pathTree == null) {
        return; // not important
    }

    if (!pathTree.exists("")) {
        return;
    }

    const rootStat = await getStat(path);

    if (rootStat == null) {
        expect(pathTree.exists("")).to.be.false;
        return;
    } else if (!rootStat.isDirectory()) {
        expect(pathTree.exists("")).to.be.true;
        expect(pathTree.isDir("")).to.be.false;

        const rootContent = await fse.readFile(path);
        expect(pathTree.get("")).to.deep.equal(rootContent);
        return;
    }

    const directoriesToVist: string[] = [""];

    while (directoriesToVist.length > 0) {
        const directory = directoriesToVist.pop();

        const pathsInMem = [...pathTree.list(directory)];
        const pathsInFs = await fse.readdir(pathutils.join(path, directory));

        if (pathsInMem.length !== pathsInFs.length) {
            winstonlogger.logError("in FS: %s", pathsInFs);
            winstonlogger.logError("in Tree: %s", pathsInMem);
        }

        expect(pathsInMem).to.have.same.members(pathsInFs, " must have same entries in directory " + directory);

        for (const p of pathsInFs) {
            const fullPath = pathutils.join(path, directory, p);
            const relativePath = pathutils.join(directory, p);

            const isDirInMem = pathTree.isDir(relativePath);
            const isDirInFs = (await fse.stat(fullPath)).isDirectory();

            expect(isDirInMem).to.be.equal(isDirInFs, "most both be the same, file or directory " + relativePath);

            if (isDirInFs) {
                directoriesToVist.push(relativePath);
            } else {
                const contentInFs = await fse.readFile(pathutils.join(path, directory, p));
                const contentInMem = pathTree.get(relativePath);

                expect(contentInFs).to.deep.equal(contentInMem, "must have same content " + relativePath);
            }
        }
    }
}

function checkTree(actual: IPathTreeReadonly<Buffer>, expected: IPathTreeReadonly<Buffer>) {
    if (expected == null) {
        return; // not important
    }
    const listActual = [...actual.listAll()];
    const listExpected = [...expected.listAll()];

    expect(listActual).to.have.same.members(listExpected);

    listActual.sort();
    listExpected.sort();

    for (const p of listActual) {
        if (actual.isDir(p)) {
            expect(expected.isDir(p)).to.be.true;
        } else {
            expect(actual.get(p)).to.deep.equal(expected.get(p));
        }
    }
}

function timeout(millis: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, millis);
    });
}

async function checkChange(
    testPath: string,
    prevTree: PathTree<Buffer>,
    pluginInstance: IRecipePluginInstance,
    change: IPluginChange) {

    await change.change(pluginInstance, testPath, prevTree);
    await timeout(2000);

    while (pluginInstance.needsUpdate()) {
        await pluginInstance.update();
    }

    await checkTreeReflectActualDirectory(change.fsContentsAfter, testPath);
    checkTree(pluginInstance.treeInterface, change.nodeContentsAfter);
}

export function plugintests(name: string, testFSPath: string, plugin: IRecipePlugin, testCases: IPluginTestCases) {

    let pluginInstance: IRecipePluginInstance;
    let tmpDirPath: string = null;
    let testPath: string = null;
    let watchmanWatch: WatchmanFSWatch;
    let watchmanWatchCancel: ICancelWatch;
    let prevTree: PathTree<Buffer>;
    let needsProcessingCalled: boolean;

    describe("plugin " + name, () => {

        beforeEach(async () => {
            winstonlogger.logInfo("before each...");
            tmpDirPath = TmpFolder.generate();
            testPath = pathutils.join(tmpDirPath, "readfstest");
            watchmanWatch = await WatchmanFSWatch.watchPath(
                addPrefixToLogger(winstonlogger, "fswatch: "), testPath);
            pluginInstance = plugin.createInstance();
            prevTree = new PathTree<Buffer>();
            if (pluginInstance.projectWatchListener != null) {
                watchmanWatchCancel = watchmanWatch.addListener(pluginInstance.projectWatchListener);
            }
        });
        afterEach(async () => {
            winstonlogger.logInfo("after each...");
            await pluginInstance.destroy();
            const files = await fse.readdir(tmpDirPath);
            for (const file of files) {
                const fullPath = pathutils.join(tmpDirPath, file);
                await fse.remove(fullPath);
            }
            await timeout(1500); // make sure all changes are flushed
            if (watchmanWatchCancel != null) {
                watchmanWatchCancel.cancel();
            }
            watchmanWatch.cancel();
        });

        it ("simple test", async () => {
            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectPath: testPath,
            });

            await writeIntoFS(testPath, testCases.simple.fsContentsBefore);
            writeIntoPathTree(prevTree, testCases.simple.nodeContentsBefore);

            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change1);
            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change2);

        }, 10000);

        it ("simple test", async () => {
            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectPath: testPath,
            });

            await writeIntoFS(testPath, testCases.simple.fsContentsBefore);
            writeIntoPathTree(prevTree, testCases.simple.nodeContentsBefore);

            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change1);
            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change2);

        }, 10000);

        it ("test update without needs update check", async () => {
            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectPath: testPath,
            });

            await writeIntoFS(testPath, testCases.simple.fsContentsBefore);
            writeIntoPathTree(prevTree, testCases.simple.nodeContentsBefore);

            await pluginInstance.update();

            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change1);

            await pluginInstance.update();

            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change2);

            await pluginInstance.update();

        }, 10000);

        it ("double setup", async () => {
            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectPath: testPath,
            });

            await writeIntoFS(testPath, testCases.simple.fsContentsBefore);
            writeIntoPathTree(prevTree, testCases.simple.nodeContentsBefore);

            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change1);

            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectPath: testPath,
            });
            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change2);

        }, 10000);

        it ("destroy", async () => {
            await pluginInstance.destroy(); // should do nothing without setup

            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectPath: testPath,
            });

            await writeIntoFS(testPath, testCases.simple.fsContentsBefore);
            writeIntoPathTree(prevTree, testCases.simple.nodeContentsBefore);

            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change1);

            await pluginInstance.destroy();

            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectPath: testPath,
            });
            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change2);

        }, 10000);

        it ("reset", async () => {
            await pluginInstance.reset(); // should do nothing without setup

            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectPath: testPath,
            });

            await writeIntoFS(testPath, testCases.simple.fsContentsBefore);
            writeIntoPathTree(prevTree, testCases.simple.nodeContentsBefore);

            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change1);

            await pluginInstance.reset();

            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change2);

        }, 10000);

        it ("update without setup", async () => {
            await pluginInstance.update(); // should do nothing

            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectPath: testPath,
            });

            await writeIntoFS(testPath, testCases.simple.fsContentsBefore);
            writeIntoPathTree(prevTree, testCases.simple.nodeContentsBefore);

            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change1);
            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change2);

        }, 10000);

        it ("needs update without setup", async () => {
            expect(pluginInstance.needsUpdate()).to.be.false;

            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectPath: testPath,
            });

            await writeIntoFS(testPath, testCases.simple.fsContentsBefore);
            writeIntoPathTree(prevTree, testCases.simple.nodeContentsBefore);

            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change1);
            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change2);

        }, 10000);

        it ("fs watch reset", async () => {
            if (pluginInstance.projectWatchListener == null) {
                return;
            }
            pluginInstance.projectWatchListener.onReset(); // should do nothing

            await pluginInstance.setup({
                config: testCases.simple.config,
                logger: winstonlogger,
                needsProcessingCallback: () => {
                    needsProcessingCalled = true;
                },
                prevStepTreeInterface: prevTree,
                projectPath: testPath,
            });

            await writeIntoFS(testPath, testCases.simple.fsContentsBefore);
            writeIntoPathTree(prevTree, testCases.simple.nodeContentsBefore);

            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change1);

            pluginInstance.projectWatchListener.onReset();
            await checkChange(testPath, prevTree, pluginInstance, testCases.simple.change2);

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
                    projectPath: testPath,
                });

                await writeIntoFS(testPath, testCase.fsContentsBefore);
                writeIntoPathTree(prevTree, testCase.nodeContentsBefore);

                for (const change of testCase.changes) {
                    await checkChange(testPath, prevTree, pluginInstance, change);
                }
            }, 1000000);
        }
    });
}