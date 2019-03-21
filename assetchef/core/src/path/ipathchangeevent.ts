/**
 * The possible directory and file changes
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
 * A path change event. This a simple interface that aggregates a path and an event,
 */
export interface IPathChangeEvent {
    readonly eventType: PathEventType;
    readonly path: string;
}
