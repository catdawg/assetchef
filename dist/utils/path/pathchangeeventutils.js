"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const pathutils = __importStar(require("path"));
const ipathchangeevent_1 = require("../../plugin/ipathchangeevent");
const pathutils_1 = require("./pathutils");
/**
 * The possible results for comparing events
 * @readonly
 * @enum {string}
 * @typedef {string} PathEventComparisonEnum
 */
var PathEventComparisonEnum;
(function (PathEventComparisonEnum) {
    PathEventComparisonEnum["Different"] = "Different";
    PathEventComparisonEnum["NewMakesOldObsolete"] = "NewMakesOldObsolete";
    PathEventComparisonEnum["NewUpdatesOld"] = "NewUpdatesOld";
    PathEventComparisonEnum["NewObsolete"] = "NewObsolete";
    PathEventComparisonEnum["Inconsistent"] = "Inconsistent";
})(PathEventComparisonEnum = exports.PathEventComparisonEnum || (exports.PathEventComparisonEnum = {}));
class PathChangeEventUtils {
    /**
     * The first event is compared against the second to determine their relationship.
     * @param {IPathChangeEvent} oldEv the old event
     * @param {IPathChangeEvent} newEv the new event
     * @returns {PathEventComparisonEnum} the comparison
     */
    static compareEvents(oldEv, newEv) {
        const relation = pathutils_1.PathUtils.getPathRelationship(oldEv.path, newEv.path);
        switch (relation) {
            case pathutils_1.PathRelationship.Equal: {
                if (oldEv.eventType === ipathchangeevent_1.PathEventType.Add) {
                    if (newEv.eventType === ipathchangeevent_1.PathEventType.Change) {
                        return PathEventComparisonEnum.NewUpdatesOld;
                    }
                    if (newEv.eventType === ipathchangeevent_1.PathEventType.Unlink) {
                        // could be BothObsolete, but if a file gets removed, added and removed
                        // in one go, nothing will be left, which means the unlink never gets processed.
                        return PathEventComparisonEnum.NewMakesOldObsolete;
                    }
                    return PathEventComparisonEnum.Inconsistent;
                }
                if (oldEv.eventType === ipathchangeevent_1.PathEventType.Unlink) {
                    if (newEv.eventType === ipathchangeevent_1.PathEventType.Add) {
                        // we don't process the unlink, and just process an add instead.
                        return PathEventComparisonEnum.NewMakesOldObsolete;
                    }
                    return PathEventComparisonEnum.Inconsistent;
                }
                if (oldEv.eventType === ipathchangeevent_1.PathEventType.Change) {
                    if (newEv.eventType === ipathchangeevent_1.PathEventType.Change) {
                        return PathEventComparisonEnum.NewUpdatesOld;
                    }
                    if (newEv.eventType === ipathchangeevent_1.PathEventType.Unlink) {
                        return PathEventComparisonEnum.NewMakesOldObsolete;
                    }
                    return PathEventComparisonEnum.Inconsistent;
                }
                if (oldEv.eventType === ipathchangeevent_1.PathEventType.UnlinkDir) {
                    if (newEv.eventType === ipathchangeevent_1.PathEventType.AddDir) {
                        // we don't process the unlinkDir, and just process an addDir instead.
                        return PathEventComparisonEnum.NewMakesOldObsolete;
                    }
                    return PathEventComparisonEnum.Inconsistent;
                }
                /* istanbul ignore else */
                if (oldEv.eventType === ipathchangeevent_1.PathEventType.AddDir) {
                    if (newEv.eventType === ipathchangeevent_1.PathEventType.UnlinkDir) {
                        // could be BothObsolete, but if a folder gets removed, added and removed,
                        // in one go, nothing will be left, which means the unlink never gets processed.
                        return PathEventComparisonEnum.NewMakesOldObsolete;
                    }
                    return PathEventComparisonEnum.Inconsistent;
                }
            }
            case pathutils_1.PathRelationship.Path1DirectlyInsidePath2: // old inside new
            case pathutils_1.PathRelationship.Path1InsidePath2: { // old inside new
                if (newEv.eventType === ipathchangeevent_1.PathEventType.UnlinkDir) {
                    return PathEventComparisonEnum.NewMakesOldObsolete; // old was in a folder that deleted
                }
                return PathEventComparisonEnum.Inconsistent;
            }
            case pathutils_1.PathRelationship.Path2DirectlyInsidePath1: { // new inside old
                if (oldEv.eventType === ipathchangeevent_1.PathEventType.AddDir) {
                    // new is inside a folder that was added
                    // so if are currently processing it, we should retry
                    return PathEventComparisonEnum.NewUpdatesOld;
                }
                if (oldEv.eventType === ipathchangeevent_1.PathEventType.UnlinkDir) {
                    return PathEventComparisonEnum.NewObsolete; // new is inside a folder that was deleted
                }
                return PathEventComparisonEnum.Inconsistent;
            }
            case pathutils_1.PathRelationship.Path2InsidePath1: { // new inside old
                if (oldEv.eventType === ipathchangeevent_1.PathEventType.UnlinkDir) {
                    return PathEventComparisonEnum.NewObsolete; // new is inside a folder that was deleted
                }
                if (oldEv.eventType === ipathchangeevent_1.PathEventType.AddDir) {
                    return PathEventComparisonEnum.NewObsolete; // new is inside a folder that was added
                }
                return PathEventComparisonEnum.Inconsistent;
            }
        }
        return PathEventComparisonEnum.Different;
    }
    /**
     * Checks if the events paths' are the same or if one contains the other.
     * @param oldEv old event
     * @param newEv new event
     */
    static areRelatedEvents(oldEv, newEv) {
        if (oldEv.path === newEv.path) {
            return true;
        }
        const newEvPathAsDir = newEv.path.length > 0 && newEv.path[newEv.path.length - 1] !== pathutils.sep
            ?
                newEv.path + pathutils.sep
            :
                oldEv.path;
        if (oldEv.path.startsWith(newEvPathAsDir)) {
            return true;
        }
        const oldEvPathAsDir = oldEv.path.length > 0 && oldEv.path[oldEv.path.length - 1] !== pathutils.sep
            ?
                oldEv.path + pathutils.sep
            :
                oldEv.path;
        return newEv.path.startsWith(oldEvPathAsDir);
    }
}
exports.PathChangeEventUtils = PathChangeEventUtils;
//# sourceMappingURL=pathchangeeventutils.js.map