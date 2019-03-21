import { IFSWatch } from "../watch/ifswatch";
import { IFileInfo } from "./ifileinfo";

/**
 * Interface used to pass around an API that writes into a tree structure accessed with a path
 * resembling a filesystem. This is the Async methods version.
 */
export interface IPathTreeAsyncWrite<TContent>  {

    /**
     * In case there's an error, wait this long before retrying.
     * E.g. if a remove fails, wait this long for a remove event from fswatch, or handle the error.
     * E.g. wait this long for a request.
     */
    delayMs: number;

    /**
     * Removes the path. If anything is under it, it will also be removed.
     * @param path the path to remove
     * @throws any error the underlying system has, e.g. if the path doesn't exist, or permissions issue
     */
    remove(path: string): Promise<void>;

    /**
     * Sets the content into the path, if the containing folder doesn't exist, this will fail
     * If a leaf is on the path, an error is thrown
     * @param path the path to set
     * @param content the content
     * @throws any error the underlying system has, e.g. if the path doesn't exist, or permissions issue
     */
    set(path: string, content: TContent): Promise<void>;

    /**
     * Creates the folder recursively.
     * If something already exists in that path, an error is thrown
     * @param path the path to create
     * @throws any error the underlying system has, e.g. if there is already the path, or if there's a permissions issue
     */
    createFolder(path: string): Promise<void>;
}
