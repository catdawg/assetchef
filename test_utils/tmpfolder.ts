import { Chance } from "chance";
import * as fse from "fs-extra";
import * as pathutils from "path";
import * as tmp from "tmp";

export class TmpFolder {
    public static async generate(): Promise<string> {
        const dirOverride = process.env.ASSETCHEF_TEST_DIR;

        if (dirOverride != null) {
            const newPath = pathutils.join(dirOverride + new Chance().word());
            await fse.mkdir(newPath);
            return newPath;
        } else {
            return tmp.dirSync().name;
        }
    }
}
