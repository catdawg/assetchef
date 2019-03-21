/**
 * Interface used to pass around an API that writes into a tree structure accessed with a path
 * resembling a filesystem.
 */
export interface IPathTreeWrite<TContent>  {

    /**
     * Sets the content into the path, creating branches on the way.
     * If a leaf is on the path, an error is thrown
     * @param path the path to set
     * @param content the content
     * @throws {verror.VError} if path is null or path contains a leaf on the way.
     */
    set(path: string, content: TContent): void;

    /**
     * Creates the folder recursively.
     * If something already exists in that path, an error is thrown
     * @param path the path to create
     * @throws {verror.VError} if path is null or something is already there
     */
    createFolder(path: string): void;

    /**
     * Remove the path.
     * @param path the path.
     * @throws {verror.VError} if path is null or doesn't exist.
     */
    remove(path: string): void;
}
