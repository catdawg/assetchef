import { VError } from "verror";

import { PathRelationship, PathUtils } from "../../src/path/pathutils";

describe("pathextra", () => {
    it("test relationship", () => {
        const pathempty = PathUtils.join("");
        const pathsomething = PathUtils.join("something");
        const pathanother = PathUtils.join("another");
        const pathsomethingelse = PathUtils.join("something", "else");
        const pathsomethingelsedeeper = PathUtils.join("something", "else", "deeper");

        expect(PathUtils.getPathRelationship(pathempty, pathempty)).toEqual(PathRelationship.Equal);
        expect(PathUtils.getPathRelationship(pathsomething, pathanother)).toEqual(PathRelationship.Different);

        expect(PathUtils.getPathRelationship(pathempty, pathsomething)).toEqual(
            PathRelationship.Path2DirectlyInsidePath1);
        expect(PathUtils.getPathRelationship(pathsomething, pathempty)).toEqual(
            PathRelationship.Path1DirectlyInsidePath2);

        expect(PathUtils.getPathRelationship(pathempty, pathsomethingelse)).toEqual(
            PathRelationship.Path2InsidePath1);
        expect(PathUtils.getPathRelationship(pathsomethingelse, pathempty)).toEqual(
            PathRelationship.Path1InsidePath2);

        expect(PathUtils.getPathRelationship(pathsomething, pathsomethingelsedeeper)).
            toEqual(PathRelationship.Path2InsidePath1);
        expect(PathUtils.getPathRelationship(pathsomethingelsedeeper, pathsomething)).
            toEqual(PathRelationship.Path1InsidePath2);
    });

    it("test split", () => {
        expect(PathUtils.split("something/else")).toIncludeSameMembers(["something", "else"]);
        expect(PathUtils.split("something\\else")).toIncludeSameMembers(["something", "else"]);
        expect(PathUtils.split("something\\\\else")).toIncludeSameMembers(["something", "else"]);
        expect(PathUtils.split("something//else")).toIncludeSameMembers(["something", "else"]);
    });

    it("test normalize", () => {
        expect(PathUtils.normalize("something/else")).toEqual("something/else");
        expect(PathUtils.normalize("something//else")).toEqual("something/else");
        expect(PathUtils.normalize("something/./else")).toEqual("something/else");
        expect(PathUtils.normalize("something/a/../else")).toEqual("something/else");

        expect(PathUtils.normalize("something\\else")).toEqual("something/else");
        expect(PathUtils.normalize("something\\\\else")).toEqual("something/else");
        expect(PathUtils.normalize("something\\.\\else")).toEqual("something/else");
        expect(PathUtils.normalize("something\\a\\..\\else")).toEqual("something/else");
    });

    it("test resolve", () => {
        const drive = __dirname.substring(0, PathUtils.normalize(__dirname).indexOf(PathUtils.sep));
        expect(PathUtils.resolve("/ignored/soemthing", "/a/b", "c/d")).toEqual(drive + "/a/b/c/d");
        expect(PathUtils.resolve("\\ignored\\soemthing", "\\a\\b", "c\\d")).toEqual(drive + "/a/b/c/d");
    });

    it("test parse", () => {
        expect(PathUtils.parse("something/else").dir).toEqual("something");
        expect(PathUtils.parse("something\\else").dir).toEqual("something");
    });

    it("test errors", () => {

        expect(() => PathUtils.getPathRelationship(null, null)).toThrow(VError);
        expect(() => PathUtils.getPathRelationship(null, "something")).toThrow(VError);
        expect(() => PathUtils.getPathRelationship("something", null)).toThrow(VError);
        expect(() => PathUtils.split(null)).toThrow(VError);
        expect(() => PathUtils.parse(null)).toThrow(VError);
        expect(() => PathUtils.resolve(null)).toThrow(VError);
        expect(() => PathUtils.normalize(null)).toThrow(VError);
        expect(() => PathUtils.join(null)).toThrow(VError);
    });
});
