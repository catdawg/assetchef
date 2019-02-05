// tslint:disable:no-unused-expression
import * as chai from "chai";

import * as fse from "fs-extra";
import * as pathutils from "path";
import { RandomFSChanger } from "randomfschanger";

import { ReadFSPlugin } from "../../src/assetchef-readfs/readfs";
import { ReadFSPluginInstance } from "../../src/assetchef-readfs/readfsinstance";
import { IPathTreeReadonly } from "../../src/plugin/ipathtreereadonly";
import addPrefixToLogger from "../../src/utils/addprefixtologger";
import { PathTree } from "../../src/utils/path/pathtree";
import { timeout } from "../../src/utils/timeout";
import { WatchmanFSWatch } from "../../src/utils/watch/fswatch_watchman";
import { TmpFolder } from "../../test_utils/tmpfolder";
import winstonlogger from "../../test_utils/winstonlogger";

const expect = chai.expect;

describe("stress readfs", async () => {
    let tmpDirPath: string = null;
    let watchmanWatch: WatchmanFSWatch;
    let prevTree: PathTree<Buffer>;
    let plugin: ReadFSPlugin;
    let pluginInstance: ReadFSPluginInstance;

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
        watchmanWatch.addListener(pluginInstance.projectWatchListener);

        pluginInstance.setup({
            config: {
                include: [pathutils.join("**", "*")],
                includeRootAsFile: true,
            },
            logger: winstonlogger,
            needsProcessingCallback: () => { return; },
            prevStepTreeInterface: prevTree,
            projectPath: tmpDirPath,
        });
    });

    afterEach(async () => {
        pluginInstance.destroy();
    });

    async function checkTreeReflectActualDirectory(
        pathTree: IPathTreeReadonly<Buffer>,
        path: string,
    ): Promise<string> {
        if (!pathTree.exists("")) {
            return;
        }

        const directoriesToVist: string[] = [""];

        while (directoriesToVist.length > 0) {
            const directory = directoriesToVist.pop();

            const pathsInMem = [...pathTree.list(directory)];
            const pathsInFs = await fse.readdir(pathutils.join(path, directory));

            if (pathsInMem.length !== pathsInFs.length) {
                winstonlogger.logError("in FS: %s", pathsInFs);
                winstonlogger.logError("in Mem: %s", pathsInMem);
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
                setTimeout(resolve, 5 * 60 * 1000);
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
