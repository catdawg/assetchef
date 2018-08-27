// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";
import { IPathChangeEvent, PathEventType } from "../../../src/plugin/ipathchangeevent";
import { areRelatedEvents, compareEvents, PathEventComparisonEnum } from "../../../src/utils/path/pathchangeeventutils";

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

        expect(compareEvents(oldEv, newEv)).to.be.equal(PathEventComparisonEnum.Different);
    });

    it("same path old ev is add", () => {
        const oldAddEv: IPathChangeEvent = {
            eventType: PathEventType.Add, path: pathutils.join("a", "path", "to", "somefile")};

        expect(compareEvents(oldAddEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, changeEv)).to.be.equal(PathEventComparisonEnum.NewUpdatesOld);
        expect(compareEvents(oldAddEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.BothObsolete);
        expect(compareEvents(oldAddEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, unlinkDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
    });

    it("same path old ev is change", () => {
        const oldChangeEv: IPathChangeEvent = {
            eventType: PathEventType.Change, path: pathutils.join("a", "path", "to", "somefile")};

        expect(compareEvents(oldChangeEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, changeEv)).to.be.equal(PathEventComparisonEnum.NewUpdatesOld);
        expect(compareEvents(oldChangeEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(compareEvents(oldChangeEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
    });

    it("same path old ev is unlink", () => {
        const oldUnlinkEv: IPathChangeEvent = {
            eventType: PathEventType.Unlink, path: pathutils.join("a", "path", "to", "somefile")};

        expect(compareEvents(oldUnlinkEv, addEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(compareEvents(oldUnlinkEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
    });

    it("same path old ev is adddir", () => {
        const oldAddDirEv: IPathChangeEvent = {
            eventType: PathEventType.AddDir, path: pathutils.join("a", "path", "to", "somefile")};

        expect(compareEvents(oldAddDirEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddDirEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddDirEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddDirEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.BothObsolete);
    });

    it("same path old ev is UnlinkDir", () => {
        const oldUnlinkDirEv: IPathChangeEvent = {
            eventType: PathEventType.UnlinkDir, path: pathutils.join("a", "path", "to", "somefile")};

        expect(compareEvents(oldUnlinkDirEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(compareEvents(oldUnlinkDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
    });

    it("new path directly inside old path", () => {
        const oldAddDirEv: IPathChangeEvent = {
            eventType: PathEventType.AddDir, path: pathutils.join("a", "path", "to")};

        expect(compareEvents(oldAddDirEv, addEv)).to.be.equal(PathEventComparisonEnum.NewUpdatesOld);
        expect(compareEvents(oldAddDirEv, changeEv)).to.be.equal(PathEventComparisonEnum.NewUpdatesOld);
        expect(compareEvents(oldAddDirEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.NewUpdatesOld);
        expect(compareEvents(oldAddDirEv, addDirEv)).to.be.equal(PathEventComparisonEnum.NewUpdatesOld);
        expect(compareEvents(oldAddDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewUpdatesOld);

        const oldUnlinkDirEv: IPathChangeEvent = {
            eventType: PathEventType.UnlinkDir, path: pathutils.join("a", "path", "to")};

        expect(compareEvents(oldUnlinkDirEv, addEv)).to.be.equal(PathEventComparisonEnum.NewObsolete);
        expect(compareEvents(oldUnlinkDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(compareEvents(oldUnlinkDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(compareEvents(oldUnlinkDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(compareEvents(oldUnlinkDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);

        const oldUnlinkEv: IPathChangeEvent = {
            eventType: PathEventType.Unlink, path: pathutils.join("a", "path", "to")};

        expect(compareEvents(oldUnlinkEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);

        const oldChangeEv: IPathChangeEvent = {
            eventType: PathEventType.Change, path: pathutils.join("a", "path", "to")};

        expect(compareEvents(oldChangeEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);

        const oldAddEv: IPathChangeEvent = {
            eventType: PathEventType.Add, path: pathutils.join("a", "path", "to")};

        expect(compareEvents(oldAddEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, unlinkDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
    });

    it("old path directly inside new path", () => {
        const oldAddDirEv: IPathChangeEvent = {
            eventType: PathEventType.AddDir, path: pathutils.join("a", "path", "to", "somefile", "otherfile")};

        expect(compareEvents(oldAddDirEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddDirEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddDirEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddDirEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldUnlinkDirEv: IPathChangeEvent = {
            eventType: PathEventType.UnlinkDir, path: pathutils.join("a", "path", "to", "somefile", "otherfile")};

        expect(compareEvents(oldUnlinkDirEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldUnlinkEv: IPathChangeEvent = {
            eventType: PathEventType.Unlink, path: pathutils.join("a", "path", "to", "somefile", "otherfile")};

        expect(compareEvents(oldUnlinkEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldChangeEv: IPathChangeEvent = {
            eventType: PathEventType.Change, path: pathutils.join("a", "path", "to", "somefile", "otherfile")};

        expect(compareEvents(oldChangeEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldAddEv: IPathChangeEvent = {
            eventType: PathEventType.Add, path: pathutils.join("a", "path", "to", "somefile", "otherfile")};

        expect(compareEvents(oldAddEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
    });

    it("old path inside new path", () => {
        const oldAddDirEv: IPathChangeEvent = {
            eventType: PathEventType.AddDir,
                path: pathutils.join("a", "path", "to", "somefile", "otherfile", "evenother")};

        expect(compareEvents(oldAddDirEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddDirEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddDirEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddDirEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldUnlinkDirEv: IPathChangeEvent = {
            eventType: PathEventType.UnlinkDir,
            path: pathutils.join("a", "path", "to", "somefile", "otherfile", "evenother")};

        expect(compareEvents(oldUnlinkDirEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldUnlinkEv: IPathChangeEvent = {
            eventType: PathEventType.Unlink,
            path: pathutils.join("a", "path", "to", "somefile", "otherfile", "evenother")};

        expect(compareEvents(oldUnlinkEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldChangeEv: IPathChangeEvent = {
            eventType: PathEventType.Change,
            path: pathutils.join("a", "path", "to", "somefile", "otherfile", "evenother")};

        expect(compareEvents(oldChangeEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldAddEv: IPathChangeEvent = {
            eventType: PathEventType.Add,
            path: pathutils.join("a", "path", "to", "somefile", "otherfile", "evenother")};

        expect(compareEvents(oldAddEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewMakesOldObsolete);
    });

    it("new path inside old path", () => {
        const oldAddDirEv: IPathChangeEvent = {eventType: PathEventType.AddDir, path: pathutils.join("a", "path")};

        expect(compareEvents(oldAddDirEv, addEv)).to.be.equal(PathEventComparisonEnum.NewObsolete);
        expect(compareEvents(oldAddDirEv, changeEv)).to.be.equal(PathEventComparisonEnum.NewObsolete);
        expect(compareEvents(oldAddDirEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.NewObsolete);
        expect(compareEvents(oldAddDirEv, addDirEv)).to.be.equal(PathEventComparisonEnum.NewObsolete);
        expect(compareEvents(oldAddDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);

        const oldUnlinkDirEv: IPathChangeEvent = {
            eventType: PathEventType.UnlinkDir, path: pathutils.join("a", "path")};

        expect(compareEvents(oldUnlinkDirEv, addEv)).to.be.equal(PathEventComparisonEnum.NewObsolete);
        expect(compareEvents(oldUnlinkDirEv, changeEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(compareEvents(oldUnlinkDirEv, unlinkEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(compareEvents(oldUnlinkDirEv, addDirEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);
        expect(compareEvents(oldUnlinkDirEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.NewObsolete);

        const oldUnlinkEv: IPathChangeEvent = {eventType: PathEventType.Unlink, path: pathutils.join("a", "path")};

        expect(compareEvents(oldUnlinkEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldUnlinkEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);

        const oldChangeEv: IPathChangeEvent = {eventType: PathEventType.Change, path: pathutils.join("a", "path")};

        expect(compareEvents(oldChangeEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldChangeEv, unlinkDirEv)).to.be.equal(
            PathEventComparisonEnum.Inconsistent);

        const oldAddEv: IPathChangeEvent = {eventType: PathEventType.Add, path: pathutils.join("a", "path")};

        expect(compareEvents(oldAddEv, addEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, changeEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, unlinkEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, addDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
        expect(compareEvents(oldAddEv, unlinkDirEv)).to.be.equal(PathEventComparisonEnum.Inconsistent);
    });

    it("are related", () => {
        const oldAddDirEv: IPathChangeEvent = {
            eventType: PathEventType.AddDir, path: pathutils.join("a", "path", "to")};

        expect(areRelatedEvents(oldAddDirEv, addEv)).to.be.true;
        expect(areRelatedEvents(addEv, oldAddDirEv)).to.be.true;
        expect(areRelatedEvents(addEv, changeEv)).to.be.true;
    });
});
