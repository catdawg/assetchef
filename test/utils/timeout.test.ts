// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import { timeout } from "utils/timeout";

describe("timeout", () => {

    it("test delay", async () => {
        const timeBefore = Date.now();
        await timeout(1000);
        const timeAfter = Date.now();

        expect(timeAfter - timeBefore).to.be.approximately(1000, 100);
    });
});
