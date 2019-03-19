import { IFSWatch } from "../watch/ifswatch";
import { IFileInfo } from "./ifileinfo";

/**
 * Interface used to pass around an API that looks into a tree structure accessed with a path
 * resembling a filesystem. This is the Async methods version.
 */
export interface IPathTreeAsyncReadonly<TContent>  {

    /**
     * In case there's an error, wait this long before retrying.
     * E.g. if a get fails, wait this long for a remove event from fswatch, or handle the error.
     * E.g. wait this long for a request.
     */
    delayMs: number;

    /**
     * Returns the paths under the specified path. If there is a problem, it will throw.
     * @param path the 'folder' where the files are
     * @returns the list of paths under path
     * @throws any error the underlying system has, e.g. if the path doesn't exist
     */
    list(path: string): Promise<string[]>;

    /**
     * Returns information about a given path, will throw if it doesn't exist.
     * @param path the path
     * @returns the info, resembling fs.Stats
     * @throws any error the underlying system has, e.g. if the path doesn't exist
     */
    getInfo(path: string): Promise<IFileInfo>;

    /**
     * Get the content of a path.
     * @param path the path
     * @returns the data in the path
     * @throws any error the underlying system has, e.g. if the path doesn't exist
     */
    get(path: string): Promise<TContent>;
}
