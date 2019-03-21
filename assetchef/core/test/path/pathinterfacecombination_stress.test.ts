import Chance from "chance";

import { PathEventType } from "../../src/path/ipathchangeevent";
import { IPathTreeRead } from "../../src/path/ipathtreeread";

import { PathChangeProcessingUtils, ProcessCommitMethod } from "../../src/path/pathchangeprocessingutils";
import { PathChangeQueue } from "../../src/path/pathchangequeue";
import { PathInterfaceCombination } from "../../src/path/pathinterfacecombination";
import { PathTree } from "../../src/path/pathtree";
import { PathUtils } from "../../src/path/pathutils";
import { RandomPathTreeChanger } from "../../src/testutils/randompathtreechanger";
import { winstonlogger } from "../../src/testutils/winstonlogger";

function checkIfCorrect(
    primaryTree: PathTree<string>,
    secondaryTree: PathTree<string>,
    combination: PathInterfaceCombination<string>,
    path: string) {

    if (primaryTree != null && primaryTree.exists(path)) {
        expect(combination.exists(path)).toBeTrue();
        expect(combination.isDir(path)).toEqual(primaryTree.isDir(path));

        if (!combination.isDir(path)) {
            expect(combination.get(path)).toEqual(primaryTree.get(path));
            return;
        } else {
            const primaryFiles = [...primaryTree.list(path)];

            if (secondaryTree != null && secondaryTree.exists(path) && secondaryTree.isDir(path)) {
                const secondaryFiles = [...secondaryTree.list(path)];

                const expectedFileList = [...primaryFiles];
                for (const file of secondaryFiles) {
                    if (primaryFiles.indexOf(file) === -1) {
                        expectedFileList.push(file);
                    }
                }
                expect([...combination.list(path)]).toIncludeSameMembers(expectedFileList);

                for (const file of expectedFileList) {
                    checkIfCorrect(primaryTree, secondaryTree, combination, PathUtils.join(path, file));
                }
            } else {
                expect([...combination.list(path)]).toIncludeSameMembers(primaryFiles);

                for (const file of primaryFiles) {
                    checkIfCorrect(primaryTree, null, combination, PathUtils.join(path, file));
                }
            }
        }
    } else {
        expect(secondaryTree).not.toBeNull();
        expect(secondaryTree.exists(path)).toBeTrue();
        expect(combination.isDir(path)).toEqual(secondaryTree.isDir(path));

        if (!secondaryTree.isDir(path)) {
            expect(combination.get(path)).toEqual(secondaryTree.get(path));
        } else {
            const secondaryFiles = [...secondaryTree.list(path)];
            expect([...combination.list(path)]).toIncludeSameMembers(secondaryFiles);

            for (const file of secondaryFiles) {
                checkIfCorrect(null, secondaryTree, combination, PathUtils.join(path, file));
            }
        }

    }
}

const getCopyHandler = (sourceTree: IPathTreeRead<string>, targetTree: PathTree<string>) =>  {
    const fileAddedAndChangedHandler = async (path: string): Promise<ProcessCommitMethod> => {
        let filecontent: string = null;
        try {
            filecontent = sourceTree.get(path);
        } catch (err) {
            return null;
        }
        return () => {
            if (targetTree.exists(path)) {
                targetTree.remove(path);
            }
            targetTree.set(path, filecontent);
        };
    };

    const pathRemovedHandler = async (path: string): Promise<ProcessCommitMethod> => {
        return () => {
            if (targetTree.exists(path)) {
                targetTree.remove(path);
            }
        };
    };
    return {
        handleFileAdded: fileAddedAndChangedHandler,
        handleFileChanged: fileAddedAndChangedHandler,
        handleFileRemoved: pathRemovedHandler,
        handleFolderAdded: async (path: string): Promise<ProcessCommitMethod> => {
            return () => {
                if (targetTree.exists(path)) {
                    targetTree.remove(path);
                }
                targetTree.createFolder(path);
            };
        },
        handleFolderRemoved: pathRemovedHandler,
        isDir: async (path: string): Promise<boolean> => {
            try {
                return sourceTree.isDir(path);
            } catch (err) {
                return null;
            }
        },
        list: async (path: string): Promise<string[]> => {
            try {
                return [...sourceTree.list(path)];
            } catch (err) {
                return null;
            }
        },
    };
};

const compareTrees = (tree1: IPathTreeRead<string>, tree2: IPathTreeRead<string>) => {
    const list1 = [...tree1.listAll()];
    const list2 = [...tree2.listAll()];

    expect(list1).toIncludeSameMembers(list2);

    list1.sort();
    list2.sort();

    for (const p of list1) {
        if (tree1.isDir(p)) {
            expect(tree2.isDir(p)).toBeTrue();
        } else {
            expect(tree1.get(p)).toEqual(tree2.get(p));
        }
    }
};

describe("pathinterfacecombination stress", () => {

    it("test", async () => {
        const primaryTree = new PathTree<string>();
        primaryTree.createFolder("");
        const secondaryTree = new PathTree<string>();
        secondaryTree.createFolder("");
        const combination = new PathInterfaceCombination<string>(primaryTree, secondaryTree);
        const primaryChanger = new RandomPathTreeChanger("changer", primaryTree, 0);
        const secondaryChanger = new RandomPathTreeChanger("changer", secondaryTree, 1);

        const reader = new PathTree<string>();

        const pathChangeQueue = new PathChangeQueue(() => {
            pathChangeQueue.push({eventType: PathEventType.AddDir, path: ""});
        }, winstonlogger);

        pathChangeQueue.reset();

        combination.listenChanges((ev) => {
            pathChangeQueue.push(ev);
        });

        const chance = new Chance(0);

        for (let i = 0; i < 500; ++i) {
            winstonlogger.logInfo("tick" + i);
            primaryChanger.tick();
            secondaryChanger.tick();

            if (chance.d10() > 9) {
                winstonlogger.logInfo("checking");
                await PathChangeProcessingUtils.processAll(
                    pathChangeQueue, getCopyHandler(combination, reader), winstonlogger, 0);
                compareTrees(combination, reader);
                checkIfCorrect(primaryTree, secondaryTree, combination, "");
            }
        }
    });
});
