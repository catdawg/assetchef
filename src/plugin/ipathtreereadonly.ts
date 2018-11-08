import { IPathChangeEvent } from "./ipathchangeevent";

/**
 * Interface used to pass around an API that looks into a tree structure like a filesystem.
 * This can be used to abstract an actual filesystem or something that resembles it.
 */
export interface IPathTreeReadonly<TContent>  {
    /**
     * Listen for changes in the structure.
     * @param cb the callback
     * @returns a token to unlisten, keep it around and call unlisten when you're done
     */
    listenChanges(cb: (ev: IPathChangeEvent) => void): {unlisten: () => void};

    /**
     * Iterator for the paths inside a specified path. If the path doesn't exist, the behaviour is unspecified.
     * @param path the 'folder' where the files are
     */
    list(path: string): IterableIterator<string>;

    /**
     * List all files in the tree.
     */
    listAll(): IterableIterator<string>;

    /**
     * Check if a path is a directory. If the path doesn't exists the behaviour is unspecified.
     * @param path the path
     */
    isDir(path: string): boolean;

    /**
     * Check if a path exists
     * @param path the path
     */
    exists(path: string): boolean;

    /**
     * Get the content of a path, if it doesn't exist the behaviour is unspecified.
     * @param path the path
     */
    get(path: string): TContent;
}
