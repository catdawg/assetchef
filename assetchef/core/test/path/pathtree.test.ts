// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import { VError } from "verror";

import { IPathChangeEvent, PathEventType } from "../../src/path/ipathchangeevent";

import { PathTree } from "../../src/path/pathtree";
import { PathUtils } from "../../src/path/pathutils";

describe("pathtree", () => {

    it("test set", () => {
        const pathtree = new PathTree<string>();

        pathtree.set("afile", "content1");
        pathtree.set("afile2", "content2");

        const dircontents = [...pathtree.list("")];
        expect(dircontents).to.have.same.members(["afile", "afile2"]);
    });

    it("test set root", () => {
        const pathtree = new PathTree<string>();
        pathtree.set("", "content1");
        expect(pathtree.get("")).to.be.equal("content1");

    });

    it("test set errors", () => {
        const pathtree = new PathTree<string>();

        const path1 = PathUtils.join("dir", "afile");
        const pathToFail = PathUtils.join("dir");
        const pathToFail2 = PathUtils.join("dir", "afile", "something");

        pathtree.set(path1, "content1");

        expect(() => pathtree.set(pathToFail, "content")).to.be.throw(VError);

        expect(() => pathtree.set(pathToFail2, "content")).to.be.throw(VError);
    });

    it("test dir", () => {
        const pathtree = new PathTree<string>();

        const path1 = PathUtils.join("dir", "afile");
        const path2 = PathUtils.join("dir", "dir2", "afile2");

        pathtree.set(path1, "content1");
        pathtree.set(path2, "content2");

        let dircontents = [...pathtree.list("")];
        expect(dircontents).to.have.same.members(["dir"]);

        dircontents = [...pathtree.list("dir")];
        expect(dircontents).to.have.same.members(["dir2", "afile"]);

        dircontents = [...pathtree.list(PathUtils.join("dir", "dir2"))];
        expect(dircontents).to.have.same.members(["afile2"]);
    });

    it("test list errors", () => {
        const pathtree = new PathTree<string>();

        const path1 = PathUtils.join("dir", "afile");
        const path2 = PathUtils.join("dir", "dir2", "afile2");
        const pathToFail = PathUtils.join("dir2");

        pathtree.set(path1, "content1");
        pathtree.set(path2, "content2");

        expect(() => [...pathtree.list(pathToFail)]).to.be.throw(VError);
    });

    it("test removal", () => {
        const pathtree = new PathTree<string>();

        const path1 = PathUtils.join("dir", "afile");
        const path3 = PathUtils.join("dir", "dir2", "afile2");

        pathtree.set(path1, "content1");
        pathtree.set(path3, "content2");

        pathtree.remove(path1);

        const dircontents = [...pathtree.list("dir")];
        expect(dircontents).to.have.same.members(["dir2"]);

        pathtree.remove("");

        expect(pathtree.exists("")).to.be.false;
        expect([...pathtree.listAll()]).to.have.same.members([]);
    });

    it("test removal errors", () => {
        const pathtree = new PathTree<string>();

        const path1 = PathUtils.join("dir", "afile");
        const pathToFail = PathUtils.join("dir", "afile2");
        const pathToFail2 = PathUtils.join("dir", "afile", "afile3");

        pathtree.set(path1, "content1");

        expect(() => pathtree.remove(pathToFail)).to.be.throw(VError);
        expect(() => pathtree.remove(pathToFail2)).to.be.throw(VError);
    });

    it("test get", () => {
        const pathtree = new PathTree<string>();

        const path1 = PathUtils.join("dir", "afile");
        const path2 = PathUtils.join("dir", "afile2");

        pathtree.set(path1, "content1");

        expect(pathtree.get(path1)).to.be.equal("content1");
        pathtree.set(path2, "content3");
        pathtree.set(path1, "content2");
        expect(pathtree.get(path1)).to.be.equal("content2");
        expect(pathtree.get(path2)).to.be.equal("content3");
    });

    it("test get errors", () => {
        const pathtree = new PathTree<string>();

        const path1 = PathUtils.join("dir", "afile");
        const pathToFail = PathUtils.join("dir", "afile2");

        pathtree.set(path1, "content1");

        expect(() => pathtree.get(pathToFail)).to.be.throw(VError);
    });

    it("test exists and isDir", () => {
        const pathtree = new PathTree<string>();

        const path1 = PathUtils.join("dir", "afile");
        const dir = PathUtils.join("dir");

        pathtree.set(path1, "content1");
        pathtree.set(path1, "content2");

        expect(pathtree.exists(path1)).to.be.true;
        expect(pathtree.isDir(dir)).to.be.true;
        expect(!pathtree.isDir(path1)).to.be.true;
    });

    it("test isDir errors", () => {
        const pathtree = new PathTree<string>();

        const path1 = PathUtils.join("dir", "afile");
        const path2 = PathUtils.join("dir", "dir2", "afile2");
        const pathToFail = PathUtils.join("dir", "afile2");
        const pathToFail2 = PathUtils.join("dir", "afile", "afile3");
        const pathToFail3 = PathUtils.join("dir", "dir3", "afile3");

        pathtree.set(path1, "content1");
        pathtree.set(path2, "content2");

        expect(() => pathtree.isDir(pathToFail)).to.be.throw(VError);
        expect(() => pathtree.isDir(pathToFail2)).to.be.throw(VError);
        expect(() => pathtree.isDir(pathToFail3)).to.be.throw(VError);
    });

    it("test listall", () => {
        const pathtree = new PathTree<string>();

        const path0 = "dir";
        const path1 = PathUtils.join("dir", "afile");
        const path2 = PathUtils.join("dir", "dir2", "afile2");
        const path3 = PathUtils.join("dir", "dir2");

        pathtree.set(path1, "content1");
        pathtree.set(path2, "content2");

        const dircontents = [...pathtree.listAll()];
        expect(dircontents).to.have.same.members(["", path0, path1, path2, path3]);
    });

    it("test listall when root is leaf", () => {
        const pathtree = new PathTree<string>();

        pathtree.set("", "content1");

        const dircontents = [...pathtree.listAll()];
        expect(dircontents).to.have.same.members([""]);
    });

    it("test mkdir", () => {
        const pathtree = new PathTree<string>();

        const path0 = "dir";
        const path1 = PathUtils.join("dir", "dir2");
        pathtree.mkdir(path0);
        pathtree.mkdir(path1);
        expect(pathtree.exists(path0)).to.be.true;
        expect(pathtree.isDir(path0)).to.be.true;
        expect(pathtree.exists(path1)).to.be.true;
        expect(pathtree.isDir(path1)).to.be.true;
    });

    it("test mkdir root", () => {
        const pathtree = new PathTree<string>();
        expect(pathtree.exists("")).to.be.false;
        pathtree.mkdir("");
        expect(pathtree.exists("")).to.be.true;
    });

    it("test mkdir errors", () => {
        const pathtree = new PathTree<string>();

        const path0 = "dir";
        pathtree.set(path0, "woot");

        expect(() => pathtree.mkdir(path0)).to.be.throw(VError);
    });

    it("test emitter", () => {
        const pathtree = new PathTree<string>();

        const eventList: IPathChangeEvent[] = [];

        pathtree.listenChanges((event) => eventList.push(event));

        const path0 = "dir";
        const path1 = PathUtils.join("dir", "afile");

        pathtree.set(path1, "something");
        expect(eventList).have.same.deep.members(
            [{eventType: PathEventType.AddDir, path: ""},
            {eventType: PathEventType.AddDir, path: path0},
            {eventType: PathEventType.Add, path: path1}],
        );

        eventList.length = 0;
        pathtree.set(path1, "else");
        expect(eventList).have.same.deep.members([
            {eventType: PathEventType.Change, path: path1}],
        );

        eventList.length = 0;
        pathtree.remove(path1);
        expect(eventList).have.same.deep.members([
            {eventType: PathEventType.Unlink, path: path1}],
        );

        eventList.length = 0;
        pathtree.remove(path0);
        expect(eventList).have.same.deep.members([
            {eventType: PathEventType.UnlinkDir, path: path0}],
        );
    });

    it("test faster access", () => {
        const pathtree = new PathTree<string>();

        const path0 = "dir";
        pathtree.mkdir(path0);
        // fails because it's a dir and uses fast access
        expect(() => pathtree.set(path0, "content1")).to.be.throw(VError);
        // fails because it's a dir and uses fast access
        expect(() => pathtree.get(path0)).to.be.throw(VError);

        pathtree.remove(path0);
        pathtree.set(path0, "content1");
        // fails because it's a file and uses fast access
        expect(() => [...pathtree.list(path0)]).to.be.throw(VError);
    });

    it("test readonly interface", () => {
        const pathtree = new PathTree<string>();

        const file0 = "file0";
        const folder = "dir";
        const file1 = "file1";
        const content1 = "content";
        const content2 = "another content";
        const path0 = file0;
        const pathFolder = folder;
        const path1 = PathUtils.join(folder, file1);

        pathtree.set(path0, content1);
        pathtree.set(path1, content1);

        const readonlyInterface = pathtree;
        expect(readonlyInterface.get(path0)).to.equal(content1);
        expect(readonlyInterface.exists(path0)).to.be.true;
        expect(readonlyInterface.isDir(path0)).to.be.false;
        expect([...readonlyInterface.list(pathFolder)]).to.have.same.members([file1]);
        expect([...readonlyInterface.listAll()]).to.have.same.members(["", path0, pathFolder, path1]);

        let changeTriggered = false;

        const unlistenChanges = readonlyInterface.listenChanges((_e: IPathChangeEvent) => changeTriggered = true);
        pathtree.set(path0, content2);
        expect(changeTriggered).to.be.true;
        changeTriggered = false;
        unlistenChanges.unlisten();
        pathtree.set(path0, content1);
        expect(changeTriggered).to.be.false;
    });

    it("test from obj", () => {
        const pathTree = PathTree.stringTreeFrom({
            obj: "content1",
            folder: {
                obj2: "content2",
            },
        });

        expect(pathTree.get("obj")).to.be.equal("content1");
        expect(pathTree.get(PathUtils.join("folder", "obj2"))).to.be.equal("content2");

        const pathTree2 = PathTree.bufferTreeFrom(Buffer.from("rootcontent"));

        expect(pathTree2.get("").toString()).to.be.equal("rootcontent");

        const pathTree3 = PathTree.bufferTreeFrom(null);

        expect(pathTree3.exists("")).to.be.false;
    });

    it("test null arg errors", () => {
        const pathtree = new PathTree<string>();

        expect(() => pathtree.set(null, "content1")).to.be.throw(VError);
        expect(() => pathtree.get(null)).to.be.throw(VError);
        expect(() => pathtree.isDir(null)).to.be.throw(VError);
        expect(() => pathtree.mkdir(null)).to.be.throw(VError);
        expect(() => pathtree.remove(null)).to.be.throw(VError);
        expect(() => [...pathtree.list(null)]).to.be.throw(VError);
        expect(() => pathtree.exists(null)).to.be.throw(VError);
    });
});
