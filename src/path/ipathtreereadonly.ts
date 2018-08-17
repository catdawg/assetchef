import { PathChangeEvent } from "./pathchangeevent";

type PathChangeCallback = (type: PathChangeEvent, path: string) => void;

/**
 * Interface used to pass around an API that looks into a tree structure like a filesystem.
 * This can be used to abstract an actual filesystem or something that resembles it.
 */
export interface IPathTreeReadonly<TContent>  {
    /**
     * Listen for changes in the structure.
     * @param cb the callback
     */
    addChangeListener(cb: PathChangeCallback): void;
    /**
     * Cancel listening for changes in the structure.
     * @param cb the callback to remove
     */
    removeChangeListener(cb: PathChangeCallback): void;

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
