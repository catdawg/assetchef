
/**
 * simplified version of fs.Stats to be used with the path module.
 */
export interface IFileInfo {
    isFile: () => boolean;
    isDirectory: () => boolean;
    size: number;
    mtimeMs: number;
    birthtimeMs: number;
}
