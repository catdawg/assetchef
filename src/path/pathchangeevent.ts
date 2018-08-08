import {getPathRelationship, PathRelationship} from "./pathextra";

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
    BothObsolete = "BothObsolete",
    Inconsistent = "Inconsistent",
}

/**
 * The possible directory and file changes
 * @readonly
 * @enum {string}
 * @typedef {string} PathEventType
 */
export enum PathEventType {
    Add = "add",
    AddDir = "addDir",
    Unlink = "unlink",
    UnlinkDir = "unlinkDir",
    Change = "change",
}

/**
 * A directory change event. This a simple class that aggregates a path and an event,
 * and provides a comparison between events to determine if they are equal, different,
 * or if one makes the other redundant
 */
export class PathChangeEvent {
    /**
     * The first event is compared against the second to determine their relationship.
     * @param {PathChangeEvent} oldEv the old event
     * @param {PathChangeEvent} newEv the new event
     * @returns {PathEventComparisonEnum} the comparison
     */
    public static compareEvents(oldEv: PathChangeEvent, newEv: PathChangeEvent): PathEventComparisonEnum {
        const relation = getPathRelationship(oldEv.path, newEv.path);

        switch (relation) {
            case PathRelationship.Equal: {
                if (oldEv.eventType === PathEventType.Add) {
                    if (newEv.eventType === PathEventType.Change) {
                        return PathEventComparisonEnum.NewUpdatesOld;
                    }

                    if (newEv.eventType === PathEventType.Unlink) {
                        // since we hadn't processed add, we just ignore both
                        return PathEventComparisonEnum.BothObsolete;
                    }

                    return PathEventComparisonEnum.Inconsistent;
                }

                if (oldEv.eventType === PathEventType.Unlink) {
                    if (newEv.eventType === PathEventType.Add) {
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

                    if (newEv.eventType === PathEventType.AddDir) {
                        // we don't process the unlinkDir, and just process an addDir instead.
                        return PathEventComparisonEnum.NewMakesOldObsolete;
                    }

                    return PathEventComparisonEnum.Inconsistent;
                }

                /* istanbul ignore else */
                if (oldEv.eventType === PathEventType.AddDir) {

                    if (newEv.eventType === PathEventType.UnlinkDir) {
                        return PathEventComparisonEnum.BothObsolete;
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
    public static areRelatedEvents(oldEv: PathChangeEvent, newEv: PathChangeEvent): boolean {
        return oldEv.path === newEv.path || oldEv.path.startsWith(newEv.path) || newEv.path.startsWith(oldEv.path);
    }

    public readonly eventType: PathEventType;
    public readonly path: string;

    /**
     * Constructor of the Event class
     * @param {PathEventType} eventType The type of event.
     * @param {string} path The path for the event
     */
    constructor(eventType: PathEventType, path: string) {
        this.eventType = eventType;
        this.path = path;
    }
}
