import * as pathutils from "path";

import { IPathChangeEvent, PathEventType } from "./ipathchangeevent";

import { PathRelationship, PathUtils } from "./pathutils";

/**
 * The possible results for comparing events
 * @readonly
 * @enum {string}
 * @typedef {string} PathEventComparisonEnum
 */
export enum PathEventComparisonEnum {
    Different = "Different",
    NewMakesOldObsolete = "NewMakesOldObsolete",
    NewUpdatesOld = "NewUpdatesOld",
    NewObsolete = "NewObsolete",
    Inconsistent = "Inconsistent",
}

export abstract class PathChangeEventUtils {
    /**
     * The first event is compared against the second to determine their relationship.
     * @param {IPathChangeEvent} oldEv the old event
     * @param {IPathChangeEvent} newEv the new event
     * @returns {PathEventComparisonEnum} the comparison
     */
    public static compareEvents(oldEv: IPathChangeEvent, newEv: IPathChangeEvent): PathEventComparisonEnum {
        const relation = PathUtils.getPathRelationship(oldEv.path, newEv.path);

        switch (relation) {
            case PathRelationship.Equal: {
                if (oldEv.eventType === PathEventType.Add) {
                    if (newEv.eventType === PathEventType.Change || newEv.eventType === PathEventType.Add) {
                        return PathEventComparisonEnum.NewUpdatesOld;
                    }

                    if (newEv.eventType === PathEventType.Unlink) {
                        // could be BothObsolete, but if a file gets removed, added and removed
                        // in one go, nothing will be left, which means the unlink never gets processed.
                        return PathEventComparisonEnum.NewMakesOldObsolete;
                    }

                    return PathEventComparisonEnum.Inconsistent;
                }

                if (oldEv.eventType === PathEventType.Unlink) {
                    if (
                        newEv.eventType === PathEventType.Add ||
                        newEv.eventType === PathEventType.AddDir) {
                        // we don't process the unlink, and just process an add instead.
                        return PathEventComparisonEnum.NewMakesOldObsolete;
                    }

                    return PathEventComparisonEnum.Inconsistent;
                }

                if (oldEv.eventType === PathEventType.Change) {

                    if (newEv.eventType === PathEventType.Change) {
                        return PathEventComparisonEnum.NewUpdatesOld;
                    }

                    if (newEv.eventType === PathEventType.Unlink) {
                        return PathEventComparisonEnum.NewMakesOldObsolete;
                    }

                    return PathEventComparisonEnum.Inconsistent;
                }

                if (oldEv.eventType === PathEventType.UnlinkDir) {

                    if (
                        newEv.eventType === PathEventType.Add ||
                        newEv.eventType === PathEventType.AddDir) {
                        // we don't process the unlinkDir, and just process an addDir instead.
                        return PathEventComparisonEnum.NewMakesOldObsolete;
                    }

                    return PathEventComparisonEnum.Inconsistent;
                }

                /* istanbul ignore else */
                if (oldEv.eventType === PathEventType.AddDir) {

                    if (newEv.eventType === PathEventType.AddDir) {
                        // sometimes events are doubled
                        return PathEventComparisonEnum.NewUpdatesOld;
                    }

                    if (newEv.eventType === PathEventType.UnlinkDir) {
                        // could be BothObsolete, but if a folder gets removed, added and removed,
                        // in one go, nothing will be left, which means the unlink never gets processed.
                        return PathEventComparisonEnum.NewMakesOldObsolete;
                    }

                    return PathEventComparisonEnum.Inconsistent;
                }
            }

            case PathRelationship.Path1DirectlyInsidePath2:  // old inside new
            case PathRelationship.Path1InsidePath2: { // old inside new
                if (newEv.eventType === PathEventType.UnlinkDir) {
                    return PathEventComparisonEnum.NewMakesOldObsolete; // old was in a folder that deleted
                }

                return PathEventComparisonEnum.Inconsistent;
            }

            case PathRelationship.Path2DirectlyInsidePath1: { // new inside old
                if (oldEv.eventType === PathEventType.AddDir) {
                    // new is inside a folder that was added
                    // so if are currently processing it, we should retry
                    return PathEventComparisonEnum.NewUpdatesOld;
                }

                if (oldEv.eventType === PathEventType.UnlinkDir) {
                    return PathEventComparisonEnum.NewObsolete; // new is inside a folder that was deleted
                }

                return PathEventComparisonEnum.Inconsistent;
            }

            case PathRelationship.Path2InsidePath1: { // new inside old
                if (oldEv.eventType === PathEventType.UnlinkDir) {
                    return PathEventComparisonEnum.NewObsolete; // new is inside a folder that was deleted
                }

                if (oldEv.eventType === PathEventType.AddDir) {
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
    public static areRelatedEvents(oldEv: IPathChangeEvent, newEv: IPathChangeEvent): boolean {
        if (oldEv.path === newEv.path) {
            return true;
        }
        const newEvPathAsDir =
            newEv.path.length > 0 && newEv.path[newEv.path.length - 1] !== pathutils.sep
            ?
            newEv.path + pathutils.sep
            :
            oldEv.path;

        if (oldEv.path.startsWith(newEvPathAsDir)) {
            return true;
        }

        const oldEvPathAsDir =
            oldEv.path.length > 0 && oldEv.path[oldEv.path.length - 1] !== pathutils.sep
            ?
            oldEv.path + pathutils.sep
            :
            oldEv.path;

        return  newEv.path.startsWith(oldEvPathAsDir);
    }
}
