import * as pathutils from "path";

import { PathTree } from "../src/utils/path/pathtree";

interface IPremadePathTree<TContent> {
    [key: string]: Buffer | IPremadePathTreeBranch<Buffer>;
}
interface IPremadePathTreeBranch<TContent> extends IPremadePathTree<TContent> {}

export class PathTreeSetup {
    public static create(obj: IPremadePathTree<Buffer> | Buffer): PathTree<Buffer> {

        const pathTree = new PathTree<Buffer>();

        const process = (path: string, branch: IPremadePathTree<Buffer> | Buffer) => {

            if (Buffer.isBuffer(branch)) {
                pathTree.set(path, branch);
                return;
            }

            pathTree.mkdir(path);

            for (const property in branch) {
                const newPath = pathutils.join(path, property);

                /* istanbul ignore else */
                if (branch.hasOwnProperty(property)) {
                    const sub = branch[property];

                    process(newPath, sub);
                }
            }
        };

        if (obj != null) {
            process("", obj);
        }
        return pathTree;
    }
}
