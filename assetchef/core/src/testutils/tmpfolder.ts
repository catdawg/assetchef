import { Chance } from "chance";
import * as fse from "fs-extra";
import * as tmp from "tmp";

import { PathUtils } from "../path/pathutils";

export class TmpFolder {
    public static generate(): string {
        const dirOverride = process.env.ASSETCHEF_TEST_DIR;

        if (dirOverride != null) {
            const newPath = PathUtils.join(dirOverride + new Chance().word());
            try {
                fse.mkdirSync(newPath);
              } catch (err) {
                    if (err.code !== "EEXIST") {
                        throw err;
                    }
              }
            return newPath;
        } else {
            return tmp.dirSync().name;
        }
    }
}
