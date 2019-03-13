// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import { VError } from "verror";

import { PathRelationship, PathUtils } from "../../src/path/pathutils";

describe("pathextra", () => {
    it("test relationship", () => {
        const pathempty = PathUtils.join("");
        const pathsomething = PathUtils.join("something");
        const pathanother = PathUtils.join("another");
        const pathsomethingelse = PathUtils.join("something", "else");
        const pathsomethingelsedeeper = PathUtils.join("something", "else", "deeper");

        expect(PathUtils.getPathRelationship(pathempty, pathempty)).to.be.equal(PathRelationship.Equal);
        expect(PathUtils.getPathRelationship(pathsomething, pathanother)).to.be.equal(PathRelationship.Different);

        expect(PathUtils.getPathRelationship(pathempty, pathsomething)).to.be.equal(
            PathRelationship.Path2DirectlyInsidePath1);
        expect(PathUtils.getPathRelationship(pathsomething, pathempty)).to.be.equal(
            PathRelationship.Path1DirectlyInsidePath2);

        expect(PathUtils.getPathRelationship(pathempty, pathsomethingelse)).to.be.equal(
            PathRelationship.Path2InsidePath1);
        expect(PathUtils.getPathRelationship(pathsomethingelse, pathempty)).to.be.equal(
            PathRelationship.Path1InsidePath2);

        expect(PathUtils.getPathRelationship(pathsomething, pathsomethingelsedeeper)).
            to.be.equal(PathRelationship.Path2InsidePath1);
        expect(PathUtils.getPathRelationship(pathsomethingelsedeeper, pathsomething)).
            to.be.equal(PathRelationship.Path1InsidePath2);
    });

    it("test split", () => {
        expect(PathUtils.split("something/else")).to.have.same.members(["something", "else"]);
        expect(PathUtils.split("something\\else")).to.have.same.members(["something", "else"]);
        expect(PathUtils.split("something\\\\else")).to.have.same.members(["something", "else"]);
        expect(PathUtils.split("something//else")).to.have.same.members(["something", "else"]);
    });

    it("test normalize", () => {
        expect(PathUtils.normalize("something/else")).to.equal("something/else");
        expect(PathUtils.normalize("something//else")).to.equal("something/else");
        expect(PathUtils.normalize("something/./else")).to.equal("something/else");
        expect(PathUtils.normalize("something/a/../else")).to.equal("something/else");

        expect(PathUtils.normalize("something\\else")).to.equal("something/else");
        expect(PathUtils.normalize("something\\\\else")).to.equal("something/else");
        expect(PathUtils.normalize("something\\.\\else")).to.equal("something/else");
        expect(PathUtils.normalize("something\\a\\..\\else")).to.equal("something/else");
    });

    it("test resolve", () => {
        const drive = __dirname.substring(0, PathUtils.normalize(__dirname).indexOf(PathUtils.sep));
        expect(PathUtils.resolve("/ignored/soemthing", "/a/b", "c/d")).to.equal(drive + "/a/b/c/d");
        expect(PathUtils.resolve("\\ignored\\soemthing", "\\a\\b", "c\\d")).to.equal(drive + "/a/b/c/d");
    });

    it("test parse", () => {
        expect(PathUtils.parse("something/else").dir).to.equal("something");
        expect(PathUtils.parse("something\\else").dir).to.equal("something");
    });

    it("test errors", () => {

        expect(() => PathUtils.getPathRelationship(null, null)).to.be.throw(VError);
        expect(() => PathUtils.getPathRelationship(null, "something")).to.be.throw(VError);
        expect(() => PathUtils.getPathRelationship("something", null)).to.be.throw(VError);
        expect(() => PathUtils.split(null)).to.be.throw(VError);
        expect(() => PathUtils.parse(null)).to.be.throw(VError);
        expect(() => PathUtils.resolve(null)).to.be.throw(VError);
        expect(() => PathUtils.normalize(null)).to.be.throw(VError);
        expect(() => PathUtils.join(null)).to.be.throw(VError);
    });
});
