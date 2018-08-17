// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";

import { PathChangeEvent, PathEventComparisonEnum, PathEventType } from "../../src/path/pathchangeevent";

describe("pathchangequeue event comparison", () => {

    const addEv = new PathChangeEvent(PathEventType.Add, pathutils.join("a", "path", "to", "somefile"));
    const changeEv = new PathChangeEvent(PathEventType.Change, pathutils.join("a", "path", "to", "somefile"));
    const unlinkEv = new PathChangeEvent(PathEventType.Unlink, pathutils.join("a", "path", "to", "somefile"));
    const addDirEv = new PathChangeEvent(PathEventType.AddDir, pathutils.join("a", "path", "to", "somefile"));
    const unlinkDirEv = new PathChangeEvent(PathEventType.UnlinkDir, pathutils.join("a", "path", "to", "somefile"));

    it("different test", () => {
        const oldEv = new PathChangeEvent(PathEventType.Change, pathutils.join("a", "path", "to", "somefile"));
        const newEv = new PathChangeEvent(PathEventType.Change, pathutils.join("a", "path", "to", "anotherfile"));

        expect(PathChangeEvent.compareEvents(oldEv, newEv)).to.be.equal(PathEventComparisonEnum.Different);
    });

    it("same path old ev is add", () => {
        const oldAddEv = new PathChangeEvent(PathEventType.Add, pathutils.join("a", "path", "to", "somefile"));

        expect(PathChangeEvent.compareEvents(oldAddEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, changeEv)).to.be.equal(PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEvent.compareEvents(oldAddEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.BothObsolete);
        expect(PathChangeEvent.compareEvents(oldAddEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, unlinkDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
    });

    it("same path old ev is change", () => {
        const oldChangeEv = new PathChangeEvent(PathEventType.Change, pathutils.join("a", "path", "to", "somefile"));

        expect(PathChangeEvent.compareEvents(oldChangeEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, changeEv)).to.be.equal(PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEvent.compareEvents(oldChangeEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(PathChangeEvent.compareEvents(oldChangeEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
    });

    it("same path old ev is unlink", () => {
        const oldUnlinkEv = new PathChangeEvent(PathEventType.Unlink, pathutils.join("a", "path", "to", "somefile"));

        expect(PathChangeEvent.compareEvents(oldUnlinkEv, addEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
    });

    it("same path old ev is adddir", () => {
        const oldAddDirEv = new PathChangeEvent(PathEventType.AddDir, pathutils.join("a", "path", "to", "somefile"));

        expect(PathChangeEvent.compareEvents(oldAddDirEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.BothObsolete);
    });

    it("same path old ev is UnlinkDir", () => {
        const oldUnlinkDirEv =
            new PathChangeEvent(PathEventType.UnlinkDir, pathutils.join("a", "path", "to", "somefile"));

        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
    });

    it("new path directly inside old path", () => {
        const oldAddDirEv = new PathChangeEvent(PathEventType.AddDir, pathutils.join("a", "path", "to"));

        expect(PathChangeEvent.compareEvents(oldAddDirEv, addEv)).to.be.equal(PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, changeEv)).to.be.equal(PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, addDirEv)).to.be.equal(PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewUpdatesOld);

        const oldUnlinkDirEv = new PathChangeEvent(PathEventType.UnlinkDir, pathutils.join("a", "path", "to"));
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, addEv)).to.be.equal(PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);

        const oldUnlinkEv = new PathChangeEvent(PathEventType.Unlink, pathutils.join("a", "path", "to"));
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);

        const oldChangeEv = new PathChangeEvent(PathEventType.Change, pathutils.join("a", "path", "to"));
        expect(PathChangeEvent.compareEvents(oldChangeEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);

        const oldAddEv = new PathChangeEvent(PathEventType.Add, pathutils.join("a", "path", "to"));
        expect(PathChangeEvent.compareEvents(oldAddEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, unlinkDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
    });

    it("old path directly inside new path", () => {
        const oldAddDirEv =
            new PathChangeEvent(PathEventType.AddDir, pathutils.join("a", "path", "to", "somefile", "otherfile"));

        expect(PathChangeEvent.compareEvents(oldAddDirEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldUnlinkDirEv =
            new PathChangeEvent(PathEventType.UnlinkDir, pathutils.join("a", "path", "to", "somefile", "otherfile"));
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldUnlinkEv =
            new PathChangeEvent(PathEventType.Unlink, pathutils.join("a", "path", "to", "somefile", "otherfile"));
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldChangeEv =
            new PathChangeEvent(PathEventType.Change, pathutils.join("a", "path", "to", "somefile", "otherfile"));
        expect(PathChangeEvent.compareEvents(oldChangeEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldAddEv =
            new PathChangeEvent(PathEventType.Add, pathutils.join("a", "path", "to", "somefile", "otherfile"));
        expect(PathChangeEvent.compareEvents(oldAddEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
    });

    it("old path inside new path", () => {
        const oldAddDirEv =
            new PathChangeEvent(PathEventType.AddDir,
                pathutils.join("a", "path", "to", "somefile", "otherfile", "evenother"));

        expect(PathChangeEvent.compareEvents(oldAddDirEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldUnlinkDirEv =
            new PathChangeEvent(PathEventType.UnlinkDir,
                pathutils.join("a", "path", "to", "somefile", "otherfile", "evenother"));
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldUnlinkEv =
            new PathChangeEvent(PathEventType.Unlink,
                pathutils.join("a", "path", "to", "somefile", "otherfile", "evenother"));
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldChangeEv =
            new PathChangeEvent(PathEventType.Change,
                pathutils.join("a", "path", "to", "somefile", "otherfile", "evenother"));
        expect(PathChangeEvent.compareEvents(oldChangeEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldAddEv =
            new PathChangeEvent(PathEventType.Add,
                pathutils.join("a", "path", "to", "somefile", "otherfile", "evenother"));
        expect(PathChangeEvent.compareEvents(oldAddEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
    });

    it("new path inside old path", () => {
        const oldAddDirEv = new PathChangeEvent(PathEventType.AddDir, pathutils.join("a", "path"));

        expect(PathChangeEvent.compareEvents(oldAddDirEv, addEv)).to.be.equal(PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, changeEv)).to.be.equal(PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, addDirEv)).to.be.equal(PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEvent.compareEvents(oldAddDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);

        const oldUnlinkDirEv = new PathChangeEvent(PathEventType.UnlinkDir, pathutils.join("a", "path"));
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, addEv)).to.be.equal(PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEvent.compareEvents(oldUnlinkDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);

        const oldUnlinkEv = new PathChangeEvent(PathEventType.Unlink, pathutils.join("a", "path"));
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldUnlinkEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);

        const oldChangeEv = new PathChangeEvent(PathEventType.Change, pathutils.join("a", "path"));
        expect(PathChangeEvent.compareEvents(oldChangeEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldChangeEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);

        const oldAddEv = new PathChangeEvent(PathEventType.Add, pathutils.join("a", "path"));
        expect(PathChangeEvent.compareEvents(oldAddEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEvent.compareEvents(oldAddEv, unlinkDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
    });

    it("are related", () => {

        const oldAddDirEv = new PathChangeEvent(PathEventType.AddDir, pathutils.join("a", "path", "to"));
        expect(PathChangeEvent.areRelatedEvents(oldAddDirEv, addEv)).to.be.true;
        expect(PathChangeEvent.areRelatedEvents(addEv, oldAddDirEv)).to.be.true;
        expect(PathChangeEvent.areRelatedEvents(addEv, changeEv)).to.be.true;
    });
});
