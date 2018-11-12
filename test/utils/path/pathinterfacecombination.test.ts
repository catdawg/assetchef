// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";
import { VError } from "verror";

import { IPathChangeEvent, PathEventType } from "../../../src/plugin/ipathchangeevent";
import { PathInterfaceCombination } from "../../../src/utils/path/pathinterfacecombination";
import { PathTree } from "../../../src/utils/path/pathtree";

describe("pathinterfacecombination", () => {

    it("test args", () => {
        const pathtree1 = new PathTree<string>();

        expect(() => new PathInterfaceCombination<string>(null, pathtree1)).to.be.throw(VError);
        expect(() => new PathInterfaceCombination<string>(pathtree1, null)).to.be.throw(VError);
        expect(() => new PathInterfaceCombination<string>(null, null)).to.be.throw(VError);
    });

    it("test exists", () => {
        const pathtree1 = new PathTree<string>();
        pathtree1.set("afile", "content1");
        const pathtree2 = new PathTree<string>();
        pathtree2.set("afile2", "content1");

        const combined = new PathInterfaceCombination<string>(pathtree1, pathtree2);

        expect(combined.exists("afile")).to.be.true;
        expect(combined.exists("afile2")).to.be.true;
        expect(combined.exists("something")).to.be.false;
    });

    it("test isDir", () => {
        const pathtree1 = new PathTree<string>();
        pathtree1.set(pathutils.join("folder", "file1"), "content1");
        const pathtree2 = new PathTree<string>();
        pathtree2.set("folder", "content2");

        const combined = new PathInterfaceCombination<string>(pathtree1, pathtree2);

        expect(combined.isDir("folder")).to.be.true;

        expect(() => combined.isDir("notthere")).to.be.throw(VError);

        const reversed = new PathInterfaceCombination<string>(pathtree2, pathtree1);

        expect(reversed.isDir("folder")).to.be.false;
    });

    it("test get", () => {
        const pathtree1 = new PathTree<string>();
        pathtree1.set(pathutils.join("folder", "file1"), "content1");
        const pathtree2 = new PathTree<string>();
        pathtree2.set("folder", "content2");

        const combined = new PathInterfaceCombination<string>(pathtree1, pathtree2);

        expect(() => combined.get("folder")).to.be.throw(VError); // folder is dir

        const reversed = new PathInterfaceCombination<string>(pathtree2, pathtree1);

        expect(reversed.get("folder")).to.be.equal("content2");

        expect(() => combined.get("notthere")).to.be.throw(VError);
    });

    it("test list", () => {
        const pathtree1 = new PathTree<string>();
        pathtree1.set("folder", "content2");
        const pathtree2 = new PathTree<string>();
        pathtree2.set(pathutils.join("folder", "file1"), "content1");
        pathtree2.set(pathutils.join("folder", "file2"), "content2");
        const pathtree3 = new PathTree<string>();
        pathtree3.set(pathutils.join("folder", "file1"), "content1");
        pathtree3.set(pathutils.join("folder", "file3"), "content2");

        const combined = new PathInterfaceCombination<string>(pathtree1, pathtree2);
        expect(() => [...combined.list("folder")]).to.be.throw(VError); // folder is file

        const folderFirst = new PathInterfaceCombination<string>(pathtree2, pathtree1);
        expect([...folderFirst.list("folder")]).to.have.same.deep.members(["file1", "file2"]);

        const combined2 = new PathInterfaceCombination<string>(pathtree2, pathtree3);
        const paths2 = [...combined2.list("folder")];
        expect(paths2).to.have.same.deep.members(["file1", "file2", "file3"]);
    });

    it("test listAll", () => {
        const path1 = pathutils.join("folder", "file1");
        const path2 = pathutils.join("folder", "file2");
        const path3 = pathutils.join("folder2", "file1");
        const path4 = pathutils.join("folder2", "file2");
        const pathtree1 = new PathTree<string>();
        pathtree1.set("folder", "content2");
        const pathtree2 = new PathTree<string>();
        pathtree2.set(path1, "content1");
        pathtree2.set(path2, "content2");
        pathtree2.set(path3, "content3");
        pathtree2.set(path4, "content3");

        const combined = new PathInterfaceCombination<string>(pathtree1, pathtree2);
        const paths = [...combined.listAll()];
        expect(paths).to.have.same.deep.members(["", "folder", "folder2", path3, path4]);

        const combined2 = new PathInterfaceCombination<string>(pathtree2, pathtree1);
        const paths2 = [...combined2.listAll()];
        expect(paths2).to.have.same.deep.members(
            ["", "folder", "folder2", path1, path2, path3, path4]);
    });

    it("test empty tree case", () => {

        const path1 = pathutils.join("folder", "file1");
        const emptyTree = new PathTree<string>();
        const fullTree = new PathTree<string>();
        fullTree.set(path1, "content1");

        const check = (combined: PathInterfaceCombination<string>) => {
            const listAllPaths = [...combined.listAll()];
            expect(listAllPaths).to.have.same.deep.members(["", "folder", path1]);

            const listPaths = [...combined.list("folder")];
            expect(listPaths).to.have.same.deep.members(["file1"]);

            expect(combined.get(path1)).to.be.equal("content1");
            expect(combined.isDir("folder")).to.be.true;
            expect(combined.isDir(path1)).to.be.false;
            expect(combined.exists(path1)).to.be.true;
            expect(combined.exists("no")).to.be.false;
        };

        check(new PathInterfaceCombination<string>(emptyTree, fullTree));
        check(new PathInterfaceCombination<string>(fullTree, emptyTree));
    });

    it("test simple listenChanges and unlisten ", () => {

        const path1 = pathutils.join("folder", "file1");
        const pathtree1 = new PathTree<string>();
        const pathtree2 = new PathTree<string>();

        const combined = new PathInterfaceCombination<string>(pathtree1, pathtree2);

        let changed = false;
        const unlisten = combined.listenChanges((ev) => {
            changed = true;
        });

        pathtree1.set(path1, "content1");
        expect(changed).to.be.true;

        changed = false;
        pathtree2.set(path1, "content1");
        expect(changed).to.be.true;

        changed = false;
        unlisten.unlisten();

        pathtree1.set(path1, "content2");
        expect(changed).to.be.false;

        pathtree2.set(path1, "content2");
        expect(changed).to.be.false;
    });

    it("test complex listenChanges on tree1", () => {

        const path1 = pathutils.join("folder", "file1");
        const path2 = pathutils.join("folder", "file1", "file2");
        const pathtree1 = new PathTree<string>();
        const pathtree2 = new PathTree<string>();

        const combined = new PathInterfaceCombination<string>(pathtree1, pathtree2);

        let changed = false;
        let lastEvent: IPathChangeEvent = null;
        const unlisten = combined.listenChanges((ev) => {
            lastEvent = ev;
            changed = true;
        });

        pathtree1.set(path1, "content1");
        expect(changed).to.be.true;
        expect(lastEvent.eventType).to.be.equal(PathEventType.Add);

        changed = false;
        lastEvent = null;
        pathtree1.set(path1, "content2");
        expect(changed).to.be.true;
        expect(lastEvent.eventType).to.be.equal(PathEventType.Change);

        changed = false;
        lastEvent = null;
        pathtree1.remove(path1);
        expect(changed).to.be.true;
        expect(lastEvent.eventType).to.be.equal(PathEventType.Unlink);

        pathtree1.set(path1, "content1");
        pathtree2.set(path1, "content2");

        changed = false;
        lastEvent = null;
        pathtree1.remove(path1);
        expect(changed).to.be.true;
        expect(lastEvent.eventType).to.be.equal(PathEventType.Change); // tree2 became primary

        pathtree1.set(path1, "content1");
        pathtree2.remove(path1);
        pathtree2.set(path2, "content2"); // shadowed folder

        changed = false;
        lastEvent = null;
        pathtree1.remove(path1);
        expect(changed).to.be.true;
        expect(lastEvent.eventType).to.be.equal(PathEventType.AddDir); // tree2 became primary

    });

    it("test complex listenChanges on tree2", () => {

        const pathFolderFile1 = pathutils.join("folder", "file1");
        const pathFolderFile1File2 = pathutils.join("folder", "file1", "file2");
        const pathFolderFile1Folder2 = pathutils.join("folder", "file1", "folder2");
        const pathFolderFile1Folder2File1 = pathutils.join("folder", "file1", "folder2", "file1");
        const pathFolderFile3 = pathutils.join("folder", "file3");
        const pathtree1 = new PathTree<string>();
        pathtree1.set(pathFolderFile1, "content1");
        const pathtree2 = new PathTree<string>();
        pathtree2.set(pathFolderFile1, "content1");

        const combined = new PathInterfaceCombination<string>(pathtree1, pathtree2);

        let changed = false;
        let lastEvent: IPathChangeEvent = null;
        const unlisten = combined.listenChanges((ev) => {
            lastEvent = ev;
            changed = true;
        });

        pathtree2.set(pathFolderFile1, "content1");
        expect(changed).to.be.false; // tree1 was primary

        pathtree2.remove(pathFolderFile1);
        expect(changed).to.be.false; // tree1 was primary

        pathtree2.set(pathFolderFile1File2, "content1");
        expect(changed).to.be.false; // tree1 was primary

        pathtree2.remove(pathFolderFile1File2);
        expect(changed).to.be.false; // tree1 was primary

        pathtree2.set(pathFolderFile1Folder2File1, "content2");
        expect(changed).to.be.false; // tree1 was primary

        pathtree2.remove(pathFolderFile1Folder2);
        expect(changed).to.be.false; // tree1 was primary

        pathtree2.set(pathFolderFile3, "content1");
        expect(changed).to.be.true;
        expect(lastEvent.eventType).to.be.equal(PathEventType.Add); // tree2 was primary

        changed = false;
        lastEvent = null;
        pathtree2.set(pathFolderFile3, "content2");
        expect(changed).to.be.true;
        expect(lastEvent.eventType).to.be.equal(PathEventType.Change); // tree2 was primary

        changed = false;
        lastEvent = null;
        pathtree2.remove(pathFolderFile3);
        expect(changed).to.be.true;
        expect(lastEvent.eventType).to.be.equal(PathEventType.Unlink); // tree2 was primary

        pathtree2.set(pathFolderFile3, "content1");

        changed = false;
        lastEvent = null;
        pathtree2.remove("folder");
        expect(changed).to.be.true;
        expect(lastEvent.eventType).to.be.equal(PathEventType.AddDir); // paths demerged
    });
});
