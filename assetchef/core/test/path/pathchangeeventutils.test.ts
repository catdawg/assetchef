import { IPathChangeEvent, PathEventType } from "../../src/path/ipathchangeevent";

import { PathChangeEventUtils, PathEventComparisonEnum } from "../../src/path/pathchangeeventutils";
import { PathUtils } from "../../src/path/pathutils";

describe("pathchangeeventutils", () => {

    const addEv: IPathChangeEvent = {eventType: PathEventType.Add, path: PathUtils.join("a", "path", "to", "somefile")};
    const changeEv: IPathChangeEvent = {
        eventType: PathEventType.Change, path: PathUtils.join("a", "path", "to", "somefile")};
    const unlinkEv: IPathChangeEvent = {
        eventType: PathEventType.Unlink, path: PathUtils.join("a", "path", "to", "somefile")};
    const addDirEv: IPathChangeEvent = {
        eventType: PathEventType.AddDir, path: PathUtils.join("a", "path", "to", "somefile")};
    const unlinkDirEv: IPathChangeEvent = {
        eventType: PathEventType.UnlinkDir, path: PathUtils.join("a", "path", "to", "somefile")};

    it("different test", () => {
        const oldEv: IPathChangeEvent = {
            eventType: PathEventType.Change, path: PathUtils.join("a", "path", "to", "somefile")};
        const newEv: IPathChangeEvent = {
            eventType: PathEventType.Change, path: PathUtils.join("a", "path", "to", "anotherfile")};

        expect(PathChangeEventUtils.compareEvents(oldEv, newEv)).toEqual(PathEventComparisonEnum.Different);
    });

    it("same path old ev is add", () => {
        const oldAddEv: IPathChangeEvent = {
            eventType: PathEventType.Add, path: PathUtils.join("a", "path", "to", "somefile")};

        expect(PathChangeEventUtils.compareEvents(oldAddEv, addEv)).toEqual(PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, changeEv)).toEqual(
            PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
    });

    it("same path old ev is change", () => {
        const oldChangeEv: IPathChangeEvent = {
            eventType: PathEventType.Change, path: PathUtils.join("a", "path", "to", "somefile")};

        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, changeEv)).toEqual(
            PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
    });

    it("same path old ev is unlink", () => {
        const oldUnlinkEv: IPathChangeEvent = {
            eventType: PathEventType.Unlink, path: PathUtils.join("a", "path", "to", "somefile")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addEv)).toEqual(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addDirEv)).toEqual(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
    });

    it("same path old ev is adddir", () => {
        const oldAddDirEv: IPathChangeEvent = {
            eventType: PathEventType.AddDir, path: PathUtils.join("a", "path", "to", "somefile")};

        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addDirEv)).toEqual(
            PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.NewMakesOldObsolete);
    });

    it("same path old ev is UnlinkDir", () => {
        const oldUnlinkDirEv: IPathChangeEvent = {
            eventType: PathEventType.UnlinkDir, path: PathUtils.join("a", "path", "to", "somefile")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addEv)).toEqual(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addDirEv)).toEqual(
            PathEventComparisonEnum.NewMakesOldObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
    });

    it("new path directly inside old path", () => {
        const oldAddDirEv: IPathChangeEvent = {
            eventType: PathEventType.AddDir, path: PathUtils.join("a", "path", "to")};

        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addEv)).toEqual(
            PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, changeEv)).toEqual(
            PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addDirEv)).toEqual(
            PathEventComparisonEnum.NewUpdatesOld);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.NewUpdatesOld);

        const oldUnlinkDirEv: IPathChangeEvent = {
            eventType: PathEventType.UnlinkDir, path: PathUtils.join("a", "path", "to")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addEv)).toEqual(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, changeEv)).toEqual(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addDirEv)).toEqual(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.NewObsolete);

        const oldUnlinkEv: IPathChangeEvent = {
            eventType: PathEventType.Unlink, path: PathUtils.join("a", "path", "to")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);

        const oldChangeEv: IPathChangeEvent = {
            eventType: PathEventType.Change, path: PathUtils.join("a", "path", "to")};

        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);

        const oldAddEv: IPathChangeEvent = {
            eventType: PathEventType.Add, path: PathUtils.join("a", "path", "to")};

        expect(PathChangeEventUtils.compareEvents(oldAddEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
    });

    it("old path directly inside new path", () => {
        const oldAddDirEv: IPathChangeEvent = {
            eventType: PathEventType.AddDir, path: PathUtils.join("a", "path", "to", "somefile", "otherfile")};

        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldUnlinkDirEv: IPathChangeEvent = {
            eventType: PathEventType.UnlinkDir, path: PathUtils.join("a", "path", "to", "somefile", "otherfile")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldUnlinkEv: IPathChangeEvent = {
            eventType: PathEventType.Unlink, path: PathUtils.join("a", "path", "to", "somefile", "otherfile")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldChangeEv: IPathChangeEvent = {
            eventType: PathEventType.Change, path: PathUtils.join("a", "path", "to", "somefile", "otherfile")};

        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldAddEv: IPathChangeEvent = {
            eventType: PathEventType.Add, path: PathUtils.join("a", "path", "to", "somefile", "otherfile")};

        expect(PathChangeEventUtils.compareEvents(oldAddEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.NewMakesOldObsolete);
    });

    it("old path inside new path", () => {
        const oldAddDirEv: IPathChangeEvent = {
            eventType: PathEventType.AddDir,
                path: PathUtils.join("a", "path", "to", "somefile", "otherfile", "evenother")};

        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldUnlinkDirEv: IPathChangeEvent = {
            eventType: PathEventType.UnlinkDir,
            path: PathUtils.join("a", "path", "to", "somefile", "otherfile", "evenother")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldUnlinkEv: IPathChangeEvent = {
            eventType: PathEventType.Unlink,
            path: PathUtils.join("a", "path", "to", "somefile", "otherfile", "evenother")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldChangeEv: IPathChangeEvent = {
            eventType: PathEventType.Change,
            path: PathUtils.join("a", "path", "to", "somefile", "otherfile", "evenother")};

        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.NewMakesOldObsolete);

        const oldAddEv: IPathChangeEvent = {
            eventType: PathEventType.Add,
            path: PathUtils.join("a", "path", "to", "somefile", "otherfile", "evenother")};

        expect(PathChangeEventUtils.compareEvents(oldAddEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.NewMakesOldObsolete);
    });

    it("new path inside old path", () => {
        const oldAddDirEv: IPathChangeEvent = {eventType: PathEventType.AddDir, path: PathUtils.join("a", "path")};

        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addEv)).toEqual(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, changeEv)).toEqual(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, addDirEv)).toEqual(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldAddDirEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.NewObsolete);

        const oldUnlinkDirEv: IPathChangeEvent = {
            eventType: PathEventType.UnlinkDir, path: PathUtils.join("a", "path")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addEv)).toEqual(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, changeEv)).toEqual(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, addDirEv)).toEqual(
            PathEventComparisonEnum.NewObsolete);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkDirEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.NewObsolete);

        const oldUnlinkEv: IPathChangeEvent = {eventType: PathEventType.Unlink, path: PathUtils.join("a", "path")};

        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldUnlinkEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);

        const oldChangeEv: IPathChangeEvent = {eventType: PathEventType.Change, path: PathUtils.join("a", "path")};

        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldChangeEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);

        const oldAddEv: IPathChangeEvent = {eventType: PathEventType.Add, path: PathUtils.join("a", "path")};

        expect(PathChangeEventUtils.compareEvents(oldAddEv, addEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, changeEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, addDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
        expect(PathChangeEventUtils.compareEvents(oldAddEv, unlinkDirEv)).toEqual(
            PathEventComparisonEnum.Inconsistent);
    });

    it("are related", () => {
        expect(PathChangeEventUtils.areRelatedEvents(addEv, changeEv)).toBeTrue();

        const oldAddDirEv: IPathChangeEvent = {
            eventType: PathEventType.AddDir, path: PathUtils.join("a", "path", "to")};

        expect(PathChangeEventUtils.areRelatedEvents(oldAddDirEv, addEv)).toBeTrue();
        expect(PathChangeEventUtils.areRelatedEvents(addEv, oldAddDirEv)).toBeTrue();

        const oldAddDirEvWithSep: IPathChangeEvent = {
            eventType: PathEventType.AddDir, path: PathUtils.join("a", "path", "to") + PathUtils.sep};

        expect(PathChangeEventUtils.areRelatedEvents(oldAddDirEvWithSep, addEv)).toBeTrue();
        expect(PathChangeEventUtils.areRelatedEvents(addEv, oldAddDirEvWithSep)).toBeTrue();
    });
});
