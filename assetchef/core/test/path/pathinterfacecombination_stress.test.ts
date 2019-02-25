// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import Chance from "chance";
import * as pathutils from "path";

import { PathEventType } from "../../src/path/ipathchangeevent";
import { IPathTreeReadonly } from "../../src/path/ipathtreereadonly";

import { PathChangeProcessingUtils, ProcessCommitMethod } from "../../src/path/pathchangeprocessingutils";
import { PathChangeQueue } from "../../src/path/pathchangequeue";
import { PathInterfaceCombination } from "../../src/path/pathinterfacecombination";
import { PathTree } from "../../src/path/pathtree";
import { RandomPathTreeChanger } from "../../src/testutils/randompathtreechanger";
import { winstonlogger } from "../../src/testutils/winstonlogger";

function checkIfCorrect(
    primaryTree: PathTree<string>,
    secondaryTree: PathTree<string>,
    combination: PathInterfaceCombination<string>,
    path: string) {

    if (primaryTree != null && primaryTree.exists(path)) {
        expect(combination.exists(path)).to.be.true;
        expect(combination.isDir(path)).to.be.equal(primaryTree.isDir(path));

        if (!combination.isDir(path)) {
            expect(combination.get(path)).to.be.equal(primaryTree.get(path));
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
                expect([...combination.list(path)]).to.have.same.deep.members(expectedFileList);

                for (const file of expectedFileList) {
                    checkIfCorrect(primaryTree, secondaryTree, combination, pathutils.join(path, file));
                }
            } else {
                expect([...combination.list(path)]).to.have.same.deep.members(primaryFiles);

                for (const file of primaryFiles) {
                    checkIfCorrect(primaryTree, null, combination, pathutils.join(path, file));
                }
            }
        }
    } else {
        expect(secondaryTree).to.be.not.null;
        expect(secondaryTree.exists(path)).to.be.true;
        expect(combination.isDir(path)).to.be.equal(secondaryTree.isDir(path));

        if (!secondaryTree.isDir(path)) {
            expect(combination.get(path)).to.be.equal(secondaryTree.get(path));
        } else {
            const secondaryFiles = [...secondaryTree.list(path)];
            expect([...combination.list(path)]).to.have.same.deep.members(secondaryFiles);

            for (const file of secondaryFiles) {
                checkIfCorrect(null, secondaryTree, combination, pathutils.join(path, file));
            }
        }

    }
}

const getCopyHandler = (sourceTree: IPathTreeReadonly<string>, targetTree: PathTree<string>) =>  {
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
                targetTree.mkdir(path);
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

const compareTrees = (tree1: IPathTreeReadonly<string>, tree2: IPathTreeReadonly<string>) => {
    const list1 = [...tree1.listAll()];
    const list2 = [...tree2.listAll()];

    expect(list1).to.have.same.members(list2);

    list1.sort();
    list2.sort();

    for (const p of list1) {
        if (tree1.isDir(p)) {
            expect(tree2.isDir(p)).to.be.true;
        } else {
            expect(tree1.get(p)).to.be.equal(tree2.get(p));
        }
    }
};

describe("pathinterfacecombination stress", () => {

    it("test", async () => {
        const primaryTree = new PathTree<string>();
        primaryTree.mkdir("");
        const secondaryTree = new PathTree<string>();
        secondaryTree.mkdir("");
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
                    pathChangeQueue, getCopyHandler(combination, reader), winstonlogger);
                compareTrees(combination, reader);
                checkIfCorrect(primaryTree, secondaryTree, combination, "");
            }
        }
    });
});
