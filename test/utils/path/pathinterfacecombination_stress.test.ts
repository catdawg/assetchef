// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";
import { VError } from "verror";

import { IPathChangeEvent, PathEventType } from "../../../src/plugin/ipathchangeevent";
import { PathInterfaceCombination } from "../../../src/utils/path/pathinterfacecombination";
import { PathTree } from "../../../src/utils/path/pathtree";
import { RandomPathTreeChanger } from "./randompathtreechanger";
import winstonlogger from "../../../src/utils/winstonlogger";
import addPrefixToLogger from "../../../src/utils/addprefixtologger";

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

describe("pathinterfacecombination stress", () => {

    it("test", () => {
        const primaryTree = new PathTree<string>();
        primaryTree.mkdir("");
        const secondaryTree = new PathTree<string>();
        secondaryTree.mkdir("");
        const combination = new PathInterfaceCombination(primaryTree, secondaryTree);
        const primaryChanger = new RandomPathTreeChanger("changer", primaryTree, 0);
        const secondaryChanger = new RandomPathTreeChanger("changer", secondaryTree, 1);

        for (let i = 0; i < 2000; ++i) {
            winstonlogger.logInfo("tick" + i);
            primaryChanger.tick();
            secondaryChanger.tick();
            checkIfCorrect(primaryTree, secondaryTree, combination, "");
        }
    });
});
