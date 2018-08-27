"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
    PathEventComparisonEnum["BothObsolete"] = "BothObsolete";
    PathEventComparisonEnum["Inconsistent"] = "Inconsistent";
})(PathEventComparisonEnum = exports.PathEventComparisonEnum || (exports.PathEventComparisonEnum = {}));
/**
 * The first event is compared against the second to determine their relationship.
 * @param {IPathChangeEvent} oldEv the old event
 * @param {IPathChangeEvent} newEv the new event
 * @returns {PathEventComparisonEnum} the comparison
 */
function compareEvents(oldEv, newEv) {
    const relation = pathutils_1.getPathRelationship(oldEv.path, newEv.path);
    switch (relation) {
        case pathutils_1.PathRelationship.Equal: {
            if (oldEv.eventType === ipathchangeevent_1.PathEventType.Add) {
                if (newEv.eventType === ipathchangeevent_1.PathEventType.Change) {
                    return PathEventComparisonEnum.NewUpdatesOld;
                }
                if (newEv.eventType === ipathchangeevent_1.PathEventType.Unlink) {
                    // since we hadn't processed add, we just ignore both
                    return PathEventComparisonEnum.BothObsolete;
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
                    return PathEventComparisonEnum.BothObsolete;
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
exports.compareEvents = compareEvents;
/**
 * Checks if the events paths' are the same or if one contains the other.
 * @param oldEv old event
 * @param newEv new event
 */
function areRelatedEvents(oldEv, newEv) {
    return oldEv.path === newEv.path || oldEv.path.startsWith(newEv.path) || newEv.path.startsWith(oldEv.path);
}
exports.areRelatedEvents = areRelatedEvents;
//# sourceMappingURL=pathchangeeventutils.js.map