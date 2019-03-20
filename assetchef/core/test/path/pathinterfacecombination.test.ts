import { VError } from "verror";

import { IPathChangeEvent, PathEventType } from "../../src/path/ipathchangeevent";

import { PathInterfaceCombination } from "../../src/path/pathinterfacecombination";
import { PathTree } from "../../src/path/pathtree";
import { PathUtils } from "../../src/path/pathutils";

describe("pathinterfacecombination", () => {

    it("test args", () => {
        const pathtree1 = new PathTree<string>();

        expect(() => new PathInterfaceCombination<string>(null, pathtree1)).toThrow(VError);
        expect(() => new PathInterfaceCombination<string>(pathtree1, null)).toThrow(VError);
        expect(() => new PathInterfaceCombination<string>(null, null)).toThrow(VError);
    });

    it("test exists", () => {
        const pathtree1 = new PathTree<string>();
        pathtree1.set("afile", "content1");
        const pathtree2 = new PathTree<string>();
        pathtree2.set("afile2", "content1");

        const combined = new PathInterfaceCombination<string>(pathtree1, pathtree2);

        expect(combined.exists("afile")).toBeTrue();
        expect(combined.exists("afile2")).toBeTrue();
        expect(combined.exists("something")).toBeFalse();
    });

    it("test isDir", () => {
        const pathtree1 = new PathTree<string>();
        pathtree1.set(PathUtils.join("folder", "file1"), "content1");
        const pathtree2 = new PathTree<string>();
        pathtree2.set("folder", "content2");

        const combined = new PathInterfaceCombination<string>(pathtree1, pathtree2);

        expect(combined.isDir("folder")).toBeTrue();

        expect(() => combined.isDir("notthere")).toThrow(VError);

        const reversed = new PathInterfaceCombination<string>(pathtree2, pathtree1);

        expect(reversed.isDir("folder")).toBeFalse();
    });

    it("test get", () => {
        const pathtree1 = new PathTree<string>();
        pathtree1.set(PathUtils.join("folder", "file1"), "content1");
        const pathtree2 = new PathTree<string>();
        pathtree2.set("folder", "content2");

        const combined = new PathInterfaceCombination<string>(pathtree1, pathtree2);

        expect(() => combined.get("folder")).toThrow(VError); // folder is dir

        const reversed = new PathInterfaceCombination<string>(pathtree2, pathtree1);

        expect(reversed.get("folder")).toEqual("content2");

        expect(() => combined.get("notthere")).toThrow(VError);
    });

    it("test list", () => {
        const pathtree1 = new PathTree<string>();
        pathtree1.set("folder", "content2");
        const pathtree2 = new PathTree<string>();
        pathtree2.set(PathUtils.join("folder", "file1"), "content1");
        pathtree2.set(PathUtils.join("folder", "file2"), "content2");
        const pathtree3 = new PathTree<string>();
        pathtree3.set(PathUtils.join("folder", "file1"), "content1");
        pathtree3.set(PathUtils.join("folder", "file3"), "content2");

        const combined = new PathInterfaceCombination<string>(pathtree1, pathtree2);
        expect(() => [...combined.list("folder")]).toThrow(VError); // folder is file

        const folderFirst = new PathInterfaceCombination<string>(pathtree2, pathtree1);
        expect([...folderFirst.list("folder")]).toIncludeSameMembers(["file1", "file2"]);

        const combined2 = new PathInterfaceCombination<string>(pathtree2, pathtree3);
        const paths2 = [...combined2.list("folder")];
        expect(paths2).toIncludeSameMembers(["file1", "file2", "file3"]);
    });

    it("test listAll", () => {
        const path1 = PathUtils.join("folder", "file1");
        const path2 = PathUtils.join("folder", "file2");
        const path3 = PathUtils.join("folder2", "file1");
        const path4 = PathUtils.join("folder2", "file2");
        const pathtree1 = new PathTree<string>();
        pathtree1.set("folder", "content2");
        const pathtree2 = new PathTree<string>();
        pathtree2.set(path1, "content1");
        pathtree2.set(path2, "content2");
        pathtree2.set(path3, "content3");
        pathtree2.set(path4, "content3");

        const combined = new PathInterfaceCombination<string>(pathtree1, pathtree2);
        const paths = [...combined.listAll()];
        expect(paths).toIncludeSameMembers(["", "folder", "folder2", path3, path4]);

        const combined2 = new PathInterfaceCombination<string>(pathtree2, pathtree1);
        const paths2 = [...combined2.listAll()];
        expect(paths2).toIncludeSameMembers(
            ["", "folder", "folder2", path1, path2, path3, path4]);
    });

    it("test empty tree case", () => {

        const path1 = PathUtils.join("folder", "file1");
        const emptyTree = new PathTree<string>();
        const fullTree = new PathTree<string>();
        fullTree.set(path1, "content1");

        const check = (combined: PathInterfaceCombination<string>) => {
            const listAllPaths = [...combined.listAll()];
            expect(listAllPaths).toIncludeSameMembers(["", "folder", path1]);

            const listPaths = [...combined.list("folder")];
            expect(listPaths).toIncludeSameMembers(["file1"]);

            expect(combined.get(path1)).toEqual("content1");
            expect(combined.isDir("folder")).toBeTrue();
            expect(combined.isDir(path1)).toBeFalse();
            expect(combined.exists(path1)).toBeTrue();
            expect(combined.exists("no")).toBeFalse();
        };

        check(new PathInterfaceCombination<string>(emptyTree, fullTree));
        check(new PathInterfaceCombination<string>(fullTree, emptyTree));
    });

    it("test simple listenChanges and unlisten ", () => {

        const path1 = PathUtils.join("folder", "file1");
        const pathtree1 = new PathTree<string>();
        const pathtree2 = new PathTree<string>();

        const combined = new PathInterfaceCombination<string>(pathtree1, pathtree2);

        let changed = false;
        const unlisten = combined.listenChanges((ev) => {
            changed = true;
        });

        pathtree1.set(path1, "content1");
        expect(changed).toBeTrue();

        changed = false;
        pathtree2.set(path1, "content1");
        expect(changed).toBeTrue();

        changed = false;
        unlisten.unlisten();

        pathtree1.set(path1, "content2");
        expect(changed).toBeFalse();

        pathtree2.set(path1, "content2");
        expect(changed).toBeFalse();
    });

    it("test complex listenChanges on tree1", () => {

        const path1 = PathUtils.join("folder", "file1");
        const path2 = PathUtils.join("folder", "file1", "file2");
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
        expect(changed).toBeTrue();
        expect(lastEvent.eventType).toEqual(PathEventType.Add);

        changed = false;
        lastEvent = null;
        pathtree1.set(path1, "content2");
        expect(changed).toBeTrue();
        expect(lastEvent.eventType).toEqual(PathEventType.Change);

        changed = false;
        lastEvent = null;
        pathtree1.remove(path1);
        expect(changed).toBeTrue();
        expect(lastEvent.eventType).toEqual(PathEventType.Unlink);

        pathtree1.set(path1, "content1");
        pathtree2.set(path1, "content2");

        changed = false;
        lastEvent = null;
        pathtree1.remove(path1);
        expect(changed).toBeTrue();
        expect(lastEvent.eventType).toEqual(PathEventType.Change); // tree2 became primary

        pathtree1.set(path1, "content1");
        pathtree2.remove(path1);
        pathtree2.set(path2, "content2"); // shadowed folder

        changed = false;
        lastEvent = null;
        pathtree1.remove(path1);
        expect(changed).toBeTrue();
        expect(lastEvent.eventType).toEqual(PathEventType.AddDir); // tree2 became primary

    });

    it("test complex listenChanges on tree2", () => {

        const pathFolderFile1 = PathUtils.join("folder", "file1");
        const pathFolderFile1File2 = PathUtils.join("folder", "file1", "file2");
        const pathFolderFile1Folder2 = PathUtils.join("folder", "file1", "folder2");
        const pathFolderFile1Folder2File1 = PathUtils.join("folder", "file1", "folder2", "file1");
        const pathFolderFile3 = PathUtils.join("folder", "file3");
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
        expect(changed).toBeFalse(); // tree1 was primary

        pathtree2.remove(pathFolderFile1);
        expect(changed).toBeFalse(); // tree1 was primary

        pathtree2.set(pathFolderFile1File2, "content1");
        expect(changed).toBeFalse(); // tree1 was primary

        pathtree2.remove(pathFolderFile1File2);
        expect(changed).toBeFalse(); // tree1 was primary

        pathtree2.set(pathFolderFile1Folder2File1, "content2");
        expect(changed).toBeFalse(); // tree1 was primary

        pathtree2.remove(pathFolderFile1Folder2);
        expect(changed).toBeFalse(); // tree1 was primary

        pathtree2.set(pathFolderFile3, "content1");
        expect(changed).toBeTrue();
        expect(lastEvent.eventType).toEqual(PathEventType.Add); // tree2 was primary

        changed = false;
        lastEvent = null;
        pathtree2.set(pathFolderFile3, "content2");
        expect(changed).toBeTrue();
        expect(lastEvent.eventType).toEqual(PathEventType.Change); // tree2 was primary

        changed = false;
        lastEvent = null;
        pathtree2.remove(pathFolderFile3);
        expect(changed).toBeTrue();
        expect(lastEvent.eventType).toEqual(PathEventType.Unlink); // tree2 was primary

        pathtree2.set(pathFolderFile3, "content1");

        changed = false;
        lastEvent = null;
        pathtree2.remove("folder");
        expect(changed).toBeTrue();
        expect(lastEvent.eventType).toEqual(PathEventType.AddDir); // paths demerged
    });
});
