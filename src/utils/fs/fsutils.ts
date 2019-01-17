import * as fs from "fs";

export enum StatsComparisonResult {
    NoChange = "NoChange",
    Changed = "Changed",
    NewFile = "NowFile",
    NewDir = "NewDir",
    FileDeleted = "FileDeleted",
    DirDeleted = "DirDeleted",
    WasFileNowDir = "WasFileNowDir",
    WasDirNowFile = "WasDirNowFile",
}

export abstract class FSUtils {
    /**
     * Compares the stats passed as parameter.
     * @param oldStats the stats before
     * @param newStats the stats after
     * @return the result of the comparison
     */
    public static compareStats(oldStats: fs.Stats, newStats: fs.Stats): StatsComparisonResult {

        if (oldStats == null) {
            if (newStats == null) {
                return StatsComparisonResult.NoChange;
            }
            if (newStats.isDirectory()) {
                return StatsComparisonResult.NewDir;
            }
            return StatsComparisonResult.NewFile;
        }

        if (newStats == null) {
            if (oldStats.isDirectory()) {
                return StatsComparisonResult.DirDeleted;
            }
            return StatsComparisonResult.FileDeleted;
        }

        if (newStats.isDirectory() !== oldStats.isDirectory()) {
            if (newStats.isDirectory()) {
                return StatsComparisonResult.WasFileNowDir;
            }
            return StatsComparisonResult.WasDirNowFile;
        }

        if (newStats.mtimeMs !== oldStats.mtimeMs) {
            return StatsComparisonResult.Changed;
        }

        return StatsComparisonResult.NoChange;
    }
}
