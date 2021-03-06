import { IPathChangeEvent } from "../path/ipathchangeevent";

/**
 * Delegate of a filesystem watch listener
 */
export interface IFSWatchListener {
    onEvent: (ev: IPathChangeEvent) => void;
    onReset: () => void;
}

/**
 * Token to cancel listening to a watch.
 */
export interface ICancelWatch {
    unlisten: () => void;
}

/**
 * Interface for a filesystem watcher.
 */
export interface IFSWatch {
    addListener(listener: IFSWatchListener): ICancelWatch;
}
