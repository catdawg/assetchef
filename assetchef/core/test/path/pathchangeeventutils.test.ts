// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";

import { IPathChangeEvent, PathEventType } from "../../src/path/ipathchangeevent";

import { PathChangeEventUtils, PathEventComparisonEnum } from "../../src/path/pathchangeeventutils";

describe("pathchangeeventutils", () => {

    const addEv: IPathChangeEvent = {eventType: PathEventType.Add, path: pathutils.join("a", "path", "to", "somefile")};
    const changeEv: IPathChangeEvent = {
        eventType: PathEventType.Change, path: pathutils.join("a", "path", "to", "somefile")};
    const unlinkEv: IPathChangeEvent = {
        eventType: PathEventType.Unlink, path: pathutils.join("a", "path", "to", "somefile")};
    const addDirEv: IPathChangeEvent = {
        eventType: PathEventType.AddDir, path: pathutils.join("a", "path", "to", "somefile")};
    const unlinkDirEv: IPathChangeEvent = {
        eventType: PathEventType.UnlinkDir, path: pathutils.join("a", "path", "to", "somefile")};

    it("different test", () => {
        const oldEv: IPathChangeEvent = {
            eventType: PathEventType.Change, path: pathutils.join("a", "path", "to", "somefile")};
        const newEv: IPathChangeEvent = {
            eventType: PathEventType.Change, path: pathutils.join("a", "path", "to", "anotherfile")};

        expect(PathChangeEventUtils.compareEvents(oldEv, newEv)).to.be.equal(PathEventComparisonEnum.Different);
    });

    it("same path old ev is add", () => {
        const oldAddEv: IPathChangeEvent = {
            eventType: PathEventType.Add, path: pathutils.join("a", "path", "to", "somefile")};

        expect(PathChangeEventUtils.compareEvents(oldAddEv, addEv)).to.be.equal(PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
    });

    it("same path old ev is change", () => {
        const oldChangeEv: IPathChangeEvent = {
            eventType: PathEventType.Change, path: pathutils.join("a", "path", "to", "somefile")};

        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
    });

    it("same path old ev is unlink", () => {
        const oldUnlinkEv: IPathChangeEvent = {
            eventType: PathEventType.Unlink, path: pathutils.join("a", "path", "to", "somefile")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
    });

    it("same path old ev is adddir", () => {
        const oldAddDirEv: IPathChangeEvent = {
            eventType: PathEventType.AddDir, path: pathutils.join("a", "path", "to", "somefile")};

        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
    });

    it("same path old ev is UnlinkDir", () => {
        const oldUnlinkDirEv: IPathChangeEvent = {
            eventType: PathEventType.UnlinkDir, path: pathutils.join("a", "path", "to", "somefile")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
    });

    it("new path directly inside old path", () => {
        const oldAddDirEv: IPathChangeEvent = {
            eventType: PathEventType.AddDir, path: pathutils.join("a", "path", "to")};

        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addEv)).to.be.equal(
            PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewUpdatesOld);

        const oldUnlinkDirEv: IPathChangeEvent = {
            eventType: PathEventType.UnlinkDir, path: pathutils.join("a", "path", "to")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);

        const oldUnlinkEv: IPathChangeEvent = {
            eventType: PathEventType.Unlink, path: pathutils.join("a", "path", "to")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);

        const oldChangeEv: IPathChangeEvent = {
            eventType: PathEventType.Change, path: pathutils.join("a", "path", "to")};

        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);

        const oldAddEv: IPathChangeEvent = {
            eventType: PathEventType.Add, path: pathutils.join("a", "path", "to")};

        expect(PathChangeEventUtils.compareEvents(oldAddEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
    });

    it("old path directly inside new path", () => {
        const oldAddDirEv: IPathChangeEvent = {
            eventType: PathEventType.AddDir, path: pathutils.join("a", "path", "to", "somefile", "otherfile")};

        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldUnlinkDirEv: IPathChangeEvent = {
            eventType: PathEventType.UnlinkDir, path: pathutils.join("a", "path", "to", "somefile", "otherfile")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldUnlinkEv: IPathChangeEvent = {
            eventType: PathEventType.Unlink, path: pathutils.join("a", "path", "to", "somefile", "otherfile")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldChangeEv: IPathChangeEvent = {
            eventType: PathEventType.Change, path: pathutils.join("a", "path", "to", "somefile", "otherfile")};

        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldAddEv: IPathChangeEvent = {
            eventType: PathEventType.Add, path: pathutils.join("a", "path", "to", "somefile", "otherfile")};

        expect(PathChangeEventUtils.compareEvents(oldAddEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
    });

    it("old path inside new path", () => {
        const oldAddDirEv: IPathChangeEvent = {
            eventType: PathEventType.AddDir,
                path: pathutils.join("a", "path", "to", "somefile", "otherfile", "evenother")};

        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldUnlinkDirEv: IPathChangeEvent = {
            eventType: PathEventType.UnlinkDir,
            path: pathutils.join("a", "path", "to", "somefile", "otherfile", "evenother")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldUnlinkEv: IPathChangeEvent = {
            eventType: PathEventType.Unlink,
            path: pathutils.join("a", "path", "to", "somefile", "otherfile", "evenother")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldChangeEv: IPathChangeEvent = {
            eventType: PathEventType.Change,
            path: pathutils.join("a", "path", "to", "somefile", "otherfile", "evenother")};

        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldAddEv: IPathChangeEvent = {
            eventType: PathEventType.Add,
            path: pathutils.join("a", "path", "to", "somefile", "otherfile", "evenother")};

        expect(PathChangeEventUtils.compareEvents(oldAddEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
    });

    it("new path inside old path", () => {
        const oldAddDirEv: IPathChangeEvent = {eventType: PathEventType.AddDir, path: pathutils.join("a", "path")};

        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);

        const oldUnlinkDirEv: IPathChangeEvent = {
            eventType: PathEventType.UnlinkDir, path: pathutils.join("a", "path")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);

        const oldUnlinkEv: IPathChangeEvent = {eventType: PathEventType.Unlink, path: pathutils.join("a", "path")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);

        const oldChangeEv: IPathChangeEvent = {eventType: PathEventType.Change, path: pathutils.join("a", "path")};

        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);

        const oldAddEv: IPathChangeEvent = {eventType: PathEventType.Add, path: pathutils.join("a", "path")};

        expect(PathChangeEventUtils.compareEvents(oldAddEv, addEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
    });

    it("are related", () => {
        expect(PathChangeEventUtils.areRelatedEvents(addEv, changeEv)).to.be.true;

        const oldAddDirEv: IPathChangeEvent = {
            eventType: PathEventType.AddDir, path: pathutils.join("a", "path", "to")};

        expect(PathChangeEventUtils.areRelatedEvents(oldAddDirEv, addEv)).to.be.true;
        expect(PathChangeEventUtils.areRelatedEvents(addEv, oldAddDirEv)).to.be.true;

        const oldAddDirEvWithSep: IPathChangeEvent = {
            eventType: PathEventType.AddDir, path: pathutils.join("a", "path", "to") + pathutils.sep};

        expect(PathChangeEventUtils.areRelatedEvents(oldAddDirEvWithSep, addEv)).to.be.true;
        expect(PathChangeEventUtils.areRelatedEvents(addEv, oldAddDirEvWithSep)).to.be.true;
    });
});
