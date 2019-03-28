import * as fse from "fs-extra";
import { RandomFSChanger } from "randomfschanger";

import {
    addPrefixToLogger,
    FSPathTree,
    IPathTreeRead,
    PathTree,
    PathUtils,
    timeout,
    TmpFolder,
    WatchmanFSWatch,
    winstonlogger,
} from "@assetchef/pluginapi";

import { ReadFSPlugin } from "../src/readfs";
import { ReadFSPluginInstance } from "../src/readfsinstance";

describe("stress readfs", async () => {
    let tmpDirPath: string = null;
    let watchmanWatch: WatchmanFSWatch;
    let prevTree: PathTree<Buffer>;
    let plugin: ReadFSPlugin;
    let pluginInstance: ReadFSPluginInstance;
    let fsPathTree: FSPathTree;

    beforeAll(async () => {
        tmpDirPath = TmpFolder.generate();
    });

    beforeEach(async () => {
        prevTree = new PathTree<Buffer>();
        plugin = new ReadFSPlugin();
        pluginInstance = plugin.createInstance() as ReadFSPluginInstance;
        await fse.remove(tmpDirPath);
        await fse.mkdir(tmpDirPath);
        if (watchmanWatch != null) {
            watchmanWatch.cancel();
        }
        watchmanWatch = await WatchmanFSWatch.watchPath(addPrefixToLogger(winstonlogger, "fswatch: "), tmpDirPath);

        fsPathTree = new FSPathTree(tmpDirPath, watchmanWatch);

        pluginInstance.setup({
            config: {
                path: "",
            },
            logger: winstonlogger,
            needsProcessingCallback: () => { return; },
            prevStepTreeInterface: prevTree,
            projectTree: fsPathTree,
        });
    });

    afterEach(async () => {
        pluginInstance.destroy();
    });

    async function checkTreeReflectActualDirectory(
        pathTree: IPathTreeRead<Buffer>,
        path: string,
    ): Promise<string> {
        if (!pathTree.exists("")) {
            return;
        }

        const directoriesToVist: string[] = [""];

        while (directoriesToVist.length > 0) {
            const directory = directoriesToVist.pop();

            const pathsInMem = [...pathTree.list(directory)];
            const pathsInFs = await fse.readdir(PathUtils.join(path, directory));

            expect(pathsInMem.sort()).toEqual(pathsInFs.sort());

            for (const p of pathsInFs) {
                const fullPath = PathUtils.join(path, directory, p);
                const relativePath = PathUtils.join(directory, p);

                const isDirInMem = pathTree.isDir(relativePath);
                const isDirInFs = (await fse.stat(fullPath)).isDirectory();

                expect(isDirInMem).toBe(isDirInFs);

                if (isDirInFs) {
                    directoriesToVist.push(relativePath);
                } else {
                    const contentInFs = await fse.readFile(PathUtils.join(path, directory, p));
                    const contentInMem = pathTree.get(relativePath);

                    expect({file: relativePath, content: contentInFs.toString()}).toEqual(
                        {file: relativePath, content: contentInMem.toString()});
                }
            }
        }
    }

    async function randomTest(seed: number) {

        while (pluginInstance.needsUpdate()) {
            await pluginInstance.update();
        }
        await checkTreeReflectActualDirectory(pluginInstance.treeInterface, tmpDirPath);

        const randomFSChanger = new RandomFSChanger(tmpDirPath, {
            seed,
            log: (str: string) => {
                winstonlogger.logInfo("[randomfschanger] %s", str);
            },
        });
        let finish = false;
        await Promise.all([(async () => {
            randomFSChanger.start();

            await new Promise((resolve) => {
                setTimeout(resolve, 1 * 60 * 1000);
            });
            finish = true;
        })(), (async () => {
            while (!finish) {
                while (pluginInstance.needsUpdate()) {
                    await pluginInstance.update();
                }
                try {
                    await checkTreeReflectActualDirectory(pluginInstance.treeInterface, tmpDirPath);
                    winstonlogger.logInfo("!!!!Sync successful in the middle of random FSChanges!!!!");
                } catch (e) {
                    await timeout(2500);
                    if (!pluginInstance.needsUpdate()) {
                        throw e;
                    }
                }
                await timeout(2500);
            }

            while (pluginInstance.needsUpdate()) {
                await pluginInstance.update();
            }
        })()]);
        await randomFSChanger.stop();
        await timeout(2500);
        while (pluginInstance.needsUpdate()) {
            await pluginInstance.update();
        }
        await checkTreeReflectActualDirectory(pluginInstance.treeInterface, tmpDirPath);
        await timeout(2500);
    }

    it("test with randomfschanger 1", async () => {
        await randomTest(1);
    }, 60000000);
});
