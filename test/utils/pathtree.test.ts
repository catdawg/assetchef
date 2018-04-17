// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";
import { VError } from "verror";

import {DirChangeEvent, DirEventType} from "../../src/utils/dirchangeevent";
import { PathTree } from "../../src/utils/pathtree";

describe("pathtree", () => {

    it("test set", () => {
        const pathtree = new PathTree<string>();

        pathtree.set("afile", "content1");
        pathtree.set("afile2", "content2");

        const dircontents = [...pathtree.list("")];
        expect(dircontents).to.have.same.members(["afile", "afile2"]);
    });

    it("test set errors", () => {
        const pathtree = new PathTree<string>();

        const path1 = pathutils.join("dir", "afile");
        const pathToFail = pathutils.join("dir");
        const pathToFail2 = pathutils.join("dir", "afile", "something");

        pathtree.set(path1, "content1");

        expect(() => pathtree.set(pathToFail, "content", false)).to.be.throw(VError);
        expect(pathtree.set(pathToFail, "content", true)).to.be.undefined;

        expect(() => pathtree.set(pathToFail2, "content", false)).to.be.throw(VError);
        expect(pathtree.set(pathToFail2, "content", true)).to.be.undefined;
    });

    it("test dir", () => {
        const pathtree = new PathTree<string>();

        const path1 = pathutils.join("dir", "afile");
        const path2 = pathutils.join("dir", "dir2", "afile2");
        const path3 = pathutils.join("dir", "dir2");

        pathtree.set(path1, "content1");
        pathtree.set(path2, "content2");

        let dircontents = [...pathtree.list("dir")];
        expect(dircontents).to.have.same.members([path1, path3]);

        dircontents = [...pathtree.list(pathutils.join("dir", "dir2"))];
        expect(dircontents).to.have.same.members([path2]);
    });

    it("test list errors", () => {
        const pathtree = new PathTree<string>();

        const path1 = pathutils.join("dir", "afile");
        const path2 = pathutils.join("dir", "dir2", "afile2");
        const pathToFail = pathutils.join("dir2");

        pathtree.set(path1, "content1");
        pathtree.set(path2, "content2");

        expect(() => [...pathtree.list(pathToFail, false)]).to.be.throw(VError);
        expect([...pathtree.list(pathToFail, true)]).to.be.empty;
    });

    it("test removal", () => {
        const pathtree = new PathTree<string>();

        const path1 = pathutils.join("dir", "afile");
        const path2 = pathutils.join("dir", "dir2");
        const path3 = pathutils.join("dir", "dir2", "afile2");

        pathtree.set(path1, "content1");
        pathtree.set(path3, "content2");

        pathtree.remove(path1);

        const dircontents = [...pathtree.list("dir")];
        expect(dircontents).to.have.same.members([path2]);
    });

    it("test removal errors", () => {
        const pathtree = new PathTree<string>();

        const path1 = pathutils.join("dir", "afile");
        const pathToFail = pathutils.join("dir", "afile2");
        const pathToFail2 = pathutils.join("dir", "afile", "afile3");

        pathtree.set(path1, "content1");

        expect(() => pathtree.remove(pathToFail, false)).to.be.throw(VError);
        expect(pathtree.remove(pathToFail, true)).to.be.undefined;
        expect(() => pathtree.remove(pathToFail2, false)).to.be.throw(VError);
        expect(pathtree.remove(pathToFail2, true)).to.be.undefined;
    });

    it("test get", () => {
        const pathtree = new PathTree<string>();

        const path1 = pathutils.join("dir", "afile");
        const path2 = pathutils.join("dir", "afile2");

        pathtree.set(path1, "content1");

        expect(pathtree.get(path1)).to.be.equal("content1");
        pathtree.set(path2, "content3");
        pathtree.set(path1, "content2");
        expect(pathtree.get(path1)).to.be.equal("content2");
        expect(pathtree.get(path2)).to.be.equal("content3");
    });

    it("test get errors", () => {
        const pathtree = new PathTree<string>();

        const path1 = pathutils.join("dir", "afile");
        const pathToFail = pathutils.join("dir", "afile2");

        pathtree.set(path1, "content1");

        expect(() => pathtree.get(pathToFail, false)).to.be.throw(VError);
        expect(pathtree.get(pathToFail, true)).to.be.null;
    });

    it("test exists and isDir", () => {
        const pathtree = new PathTree<string>();

        const path1 = pathutils.join("dir", "afile");
        const path2 = pathutils.join("dir", "dir2", "afile2");
        const dir = pathutils.join("dir");

        pathtree.set(path1, "content1");
        pathtree.set(path1, "content2");

        expect(pathtree.exists(path1)).to.be.true;
        expect(pathtree.isDir(dir)).to.be.true;
        expect(!pathtree.isDir(path1)).to.be.true;
    });

    it("test isDir errors", () => {
        const pathtree = new PathTree<string>();

        const path1 = pathutils.join("dir", "afile");
        const path2 = pathutils.join("dir", "dir2", "afile2");
        const pathToFail = pathutils.join("dir", "afile2");
        const pathToFail2 = pathutils.join("dir", "afile", "afile3");
        const pathToFail3 = pathutils.join("dir", "dir3", "afile3");

        pathtree.set(path1, "content1");
        pathtree.set(path2, "content2");

        expect(() => pathtree.isDir(pathToFail, false)).to.be.throw(VError);
        expect(pathtree.isDir(pathToFail, true)).to.be.null;
        expect(() => pathtree.isDir(pathToFail2, false)).to.be.throw(VError);
        expect(pathtree.isDir(pathToFail2, true)).to.be.null;
        expect(() => pathtree.isDir(pathToFail3, false)).to.be.throw(VError);
        expect(pathtree.isDir(pathToFail3, true)).to.be.null;
    });

    it("test listall", () => {
        const pathtree = new PathTree<string>();

        const path0 = "dir";
        const path1 = pathutils.join("dir", "afile");
        const path2 = pathutils.join("dir", "dir2", "afile2");
        const path3 = pathutils.join("dir", "dir2");

        pathtree.set(path1, "content1");
        pathtree.set(path2, "content2");

        const dircontents = [...pathtree.listAll()];
        expect(dircontents).to.have.same.members([path0, path1, path2, path3]);
    });

    it("test mkdir", () => {
        const pathtree = new PathTree<string>();

        const path0 = "dir";
        const path1 = pathutils.join("dir", "dir2");
        pathtree.mkdir(path0);
        pathtree.mkdir(path1);
        expect(pathtree.exists(path0)).to.be.true;
        expect(pathtree.isDir(path0)).to.be.true;
        expect(pathtree.exists(path1)).to.be.true;
        expect(pathtree.isDir(path1)).to.be.true;
    });

    it("test mkdir errors", () => {
        const pathtree = new PathTree<string>();

        const path0 = "dir";
        pathtree.set(path0, "woot");

        expect(() => pathtree.mkdir(path0, false)).to.be.throw(VError);
        expect(pathtree.mkdir(path0, true)).to.be.undefined;
    });

    it("test emitter", () => {
        const pathtree = new PathTree<string>();

        const eventList = [];

        pathtree.addListener("treechanged", (event) => eventList.push(event));

        const path0 = "dir";
        const path1 = pathutils.join("dir", "afile");
        const path2 = pathutils.join("dir", "dir2", "afile2");
        const path3 = pathutils.join("dir", "dir2");

        pathtree.set(path1, "something");
        expect(eventList).have.same.deep.members(
            [new DirChangeEvent(DirEventType.AddDir, path0), new DirChangeEvent(DirEventType.Add, path1)],
        );

        eventList.length = 0;
        pathtree.set(path1, "else");
        expect(eventList).have.same.deep.members(
            [new DirChangeEvent(DirEventType.Change, path1)],
        );

        eventList.length = 0;
        pathtree.remove(path1);
        expect(eventList).have.same.deep.members(
            [new DirChangeEvent(DirEventType.Unlink, path1)],
        );

        eventList.length = 0;
        pathtree.remove(path0);
        expect(eventList).have.same.deep.members(
            [new DirChangeEvent(DirEventType.UnlinkDir, path0)],
        );
    });

    it("test faster access", () => {
        const pathtree = new PathTree<string>();

        const path0 = "dir";
        const path1 = pathutils.join("dir", "afile");
        const path2 = pathutils.join("dir", "dir2", "afile2");
        const path3 = pathutils.join("dir", "dir2");

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

    it("test null arg errors", () => {
        const pathtree = new PathTree<string>();

        expect(() => pathtree.set(null, "content1", true)).to.be.throw(VError);
        expect(() => pathtree.set(null, "content1", false)).to.be.throw(VError);
        expect(() => pathtree.get(null, false)).to.be.throw(VError);
        expect(() => pathtree.get(null, true)).to.be.throw(VError);
        expect(() => pathtree.isDir(null, false)).to.be.throw(VError);
        expect(() => pathtree.isDir(null, true)).to.be.throw(VError);
        expect(() => pathtree.mkdir(null, false)).to.be.throw(VError);
        expect(() => pathtree.mkdir(null, true)).to.be.throw(VError);
        expect(() => pathtree.remove(null, false)).to.be.throw(VError);
        expect(() => pathtree.remove(null, true)).to.be.throw(VError);
        expect(() => [...pathtree.list(null, false)]).to.be.throw(VError);
        expect(() => [...pathtree.list(null, true)]).to.be.throw(VError);
        expect(() => pathtree.exists(null)).to.be.throw(VError);
    });
});
