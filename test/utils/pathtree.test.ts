// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";
import { VError } from "verror";

import { PathTree } from "../../src/utils/pathtree";

describe("pathtree", () => {

    it("test set", () => {
        const pathtree = new PathTree<string>();

        pathtree.set("afile", "content1");
        pathtree.set("afile2", "content2");

        const dircontents = pathtree.list("");
        expect(dircontents).to.have.same.members(["afile", "afile2"]);
    });

    it("test set errors", () => {
        const pathtree = new PathTree<string>();

        const path1 = ["dir", "afile"].join(pathutils.delimiter);
        const pathToFail = ["dir"].join(pathutils.delimiter);
        const pathToFail2 = ["dir", "afile", "something"].join(pathutils.delimiter);

        pathtree.set(path1, "content1");

        expect(() => pathtree.set(pathToFail, "content", false)).to.be.throw(VError);
        expect(pathtree.set(pathToFail, "content", true)).to.be.undefined;

        expect(() => pathtree.set(pathToFail2, "content", false)).to.be.throw(VError);
        expect(pathtree.set(pathToFail2, "content", true)).to.be.undefined;
    });

    it("test dir", () => {
        const pathtree = new PathTree<string>();

        const path1 = ["dir", "afile"].join(pathutils.delimiter);
        const path2 = ["dir", "dir2", "afile2"].join(pathutils.delimiter);

        pathtree.set(path1, "content1");
        pathtree.set(path2, "content2");

        let dircontents = pathtree.list("dir");
        expect(dircontents).to.have.same.members(["afile", "dir2"]);

        dircontents = pathtree.list(["dir", "dir2"].join(pathutils.delimiter));
        expect(dircontents).to.have.same.members(["afile2"]);
    });

    it("test list errors", () => {
        const pathtree = new PathTree<string>();

        const path1 = ["dir", "afile"].join(pathutils.delimiter);
        const path2 = ["dir", "dir2", "afile2"].join(pathutils.delimiter);
        const pathToFail = ["dir2"].join(pathutils.delimiter);

        pathtree.set(path1, "content1");
        pathtree.set(path2, "content2");

        expect(() => pathtree.list(pathToFail, false)).to.be.throw(VError);
        expect(pathtree.list(pathToFail, true)).to.be.null;
    });

    it("test removal", () => {
        const pathtree = new PathTree<string>();

        const path1 = ["dir", "afile"].join(pathutils.delimiter);
        const path2 = ["dir", "dir2", "afile2"].join(pathutils.delimiter);

        pathtree.set(path1, "content1");
        pathtree.set(path2, "content2");

        pathtree.remove(path1);

        const dircontents = pathtree.list("dir");
        expect(dircontents).to.have.same.members(["dir2"]);
    });

    it("test removal errors", () => {
        const pathtree = new PathTree<string>();

        const path1 = ["dir", "afile"].join(pathutils.delimiter);
        const pathToFail = ["dir", "afile2"].join(pathutils.delimiter);
        const pathToFail2 = ["dir", "afile", "afile3"].join(pathutils.delimiter);

        pathtree.set(path1, "content1");

        expect(() => pathtree.remove(pathToFail, false)).to.be.throw(VError);
        expect(pathtree.remove(pathToFail, true)).to.be.undefined;
        expect(() => pathtree.remove(pathToFail2, false)).to.be.throw(VError);
        expect(pathtree.remove(pathToFail2, true)).to.be.undefined;
    });

    it("test get", () => {
        const pathtree = new PathTree<string>();

        const path1 = ["dir", "afile"].join(pathutils.delimiter);

        pathtree.set(path1, "content1");

        expect(pathtree.get(path1)).to.be.equal("content1");
        pathtree.set(path1, "content2");
        expect(pathtree.get(path1)).to.be.equal("content2");
    });

    it("test get errors", () => {
        const pathtree = new PathTree<string>();

        const path1 = ["dir", "afile"].join(pathutils.delimiter);
        const pathToFail = ["dir", "afile2"].join(pathutils.delimiter);

        pathtree.set(path1, "content1");

        expect(() => pathtree.get(pathToFail, false)).to.be.throw(VError);
        expect(pathtree.get(pathToFail, true)).to.be.null;
    });

    it("test exists and isDir", () => {
        const pathtree = new PathTree<string>();

        const path1 = ["dir", "afile"].join(pathutils.delimiter);
        const path2 = ["dir", "dir2", "afile2"].join(pathutils.delimiter);
        const dir = ["dir"].join(pathutils.delimiter);

        pathtree.set(path1, "content1");
        pathtree.set(path1, "content2");

        expect(pathtree.exists(path1)).to.be.true;
        expect(pathtree.isDir(dir)).to.be.true;
        expect(!pathtree.isDir(path1)).to.be.true;
    });

    it("test isDir errors", () => {
        const pathtree = new PathTree<string>();

        const path1 = ["dir", "afile"].join(pathutils.delimiter);
        const path2 = ["dir", "dir2", "afile2"].join(pathutils.delimiter);
        const pathToFail = ["dir", "afile2"].join(pathutils.delimiter);
        const pathToFail2 = ["dir", "afile", "afile3"].join(pathutils.delimiter);
        const pathToFail3 = ["dir", "dir3", "afile3"].join(pathutils.delimiter);

        pathtree.set(path1, "content1");
        pathtree.set(path2, "content2");

        expect(() => pathtree.isDir(pathToFail, false)).to.be.throw(VError);
        expect(pathtree.isDir(pathToFail, true)).to.be.null;
        expect(() => pathtree.isDir(pathToFail2, false)).to.be.throw(VError);
        expect(pathtree.isDir(pathToFail2, true)).to.be.null;
        expect(() => pathtree.isDir(pathToFail3, false)).to.be.throw(VError);
        expect(pathtree.isDir(pathToFail3, true)).to.be.null;
    });
    it("test null arg errors", () => {
        const pathtree = new PathTree<string>();

        expect(() => pathtree.set(null, "content1", true)).to.be.throw(VError);
        expect(() => pathtree.set(null, "content1", false)).to.be.throw(VError);
        expect(() => pathtree.get(null, false)).to.be.throw(VError);
        expect(() => pathtree.get(null, true)).to.be.throw(VError);
        expect(() => pathtree.isDir(null, false)).to.be.throw(VError);
        expect(() => pathtree.isDir(null, true)).to.be.throw(VError);
        expect(() => pathtree.remove(null, false)).to.be.throw(VError);
        expect(() => pathtree.remove(null, true)).to.be.throw(VError);
        expect(() => pathtree.list(null, false)).to.be.throw(VError);
        expect(() => pathtree.list(null, true)).to.be.throw(VError);
        expect(() => pathtree.exists(null)).to.be.throw(VError);
});
