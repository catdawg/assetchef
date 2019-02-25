// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import { VError } from "verror";

import { IPathChangeEvent, PathEventType } from "../../src/path/ipathchangeevent";

import { PathInterfaceProxy } from "../../src/path/pathinterfaceproxy";
import { PathTree } from "../../src/path/pathtree";

describe("pathinterfaceproxy", () => {

    it("test unproxied and args", () => {
        const proxy = new PathInterfaceProxy<string>();

        expect(() => proxy.setProxiedInterface(null)).to.be.throw(VError);
        expect(() => proxy.removeProxiedInterface()).to.be.throw(VError);
        expect(proxy.exists("")).to.be.false;
        expect(() => proxy.isDir("")).to.be.throw(VError);
        expect(() => proxy.get("")).to.be.throw(VError);
        expect(() => [...proxy.list("")]).to.be.throw(VError);
        expect([...proxy.listAll()]).to.be.empty;
    });

    it("test interface", () => {
        const proxy = new PathInterfaceProxy<string>();

        const pathtree1 = new PathTree<string>();

        proxy.setProxiedInterface(pathtree1);
        pathtree1.set("something", "content");

        expect(proxy.exists("something")).to.be.true;
        expect(proxy.get("something")).to.be.equal("content");
        expect([...proxy.list("")]).to.have.same.deep.members(["something"]);
        expect([...proxy.listAll()]).to.have.same.deep.members(["", "something"]);
        expect(proxy.isDir("something")).to.be.false;
    });

    it("test listen changes", () => {
        const pathtree1 = new PathTree<string>();
        const pathtree2 = new PathTree<string>();

        const proxy = new PathInterfaceProxy<string>();

        proxy.setProxiedInterface(pathtree1);

        let changed = false;
        const cancelToken = proxy.listenChanges((ev) => {
            changed = true;
        }) ;

        pathtree1.set("something", "content");
        expect(changed).to.be.true;
        changed = false;

        proxy.setProxiedInterface(pathtree2);

        expect(changed).to.be.true; // set will trigger AddDir for the root.
        changed = false;

        pathtree1.set("something", "content2");
        expect(changed).to.be.false;

        pathtree2.set("something", "content2");
        expect(changed).to.be.true;
        changed = false;

        cancelToken.unlisten();

        pathtree2.set("something", "content3");
        expect(changed).to.be.false;
    });

    it("test setProxiedInterface and removeProxiedInterface events with root as Dir", () => {
        const pathtree1 = new PathTree<string>();
        const pathtree2 = new PathTree<string>();

        const proxy = new PathInterfaceProxy<string>();

        let changed = false;
        let ev: IPathChangeEvent = null;
        const cancelToken = proxy.listenChanges((_ev) => {
            changed = true;
            ev = _ev;
        }) ;

        proxy.setProxiedInterface(pathtree1);

        expect(changed).to.be.false; // no root

        proxy.removeProxiedInterface();

        expect(changed).to.be.false; // no root

        pathtree1.set("something", "content");

        proxy.setProxiedInterface(pathtree1);

        expect(changed).to.be.true;
        expect(ev.path).to.equal("");
        expect(ev.eventType).to.equal(PathEventType.AddDir);
        changed = false;

        proxy.setProxiedInterface(pathtree2);

        expect(changed).to.be.true;
        expect(ev.path).to.equal("");
        expect(ev.eventType).to.equal(PathEventType.UnlinkDir); // no root on 2

        proxy.setProxiedInterface(pathtree1);
        pathtree2.set("a file", "content");
        changed = false;

        proxy.setProxiedInterface(pathtree2);

        expect(changed).to.be.true;
        expect(ev.path).to.equal("");
        expect(ev.eventType).to.equal(PathEventType.AddDir);
    });

    it("test setProxiedInterface and removeProxiedInterface events with root as file", () => {
        const pathtree1 = new PathTree<string>();
        const pathtree2 = new PathTree<string>();

        const proxy = new PathInterfaceProxy<string>();

        let changed = false;
        let ev: IPathChangeEvent = null;
        const cancelToken = proxy.listenChanges((_ev) => {
            changed = true;
            ev = _ev;
        }) ;

        pathtree1.set("", "content");

        proxy.setProxiedInterface(pathtree1);

        expect(changed).to.be.true;
        expect(ev.path).to.equal("");
        expect(ev.eventType).to.equal(PathEventType.Add);
        changed = false;

        proxy.setProxiedInterface(pathtree2);

        expect(changed).to.be.true;
        expect(ev.path).to.equal("");
        expect(ev.eventType).to.equal(PathEventType.Unlink); // no root on 2

        proxy.setProxiedInterface(pathtree1);
        pathtree2.set("", "content");
        changed = false;

        proxy.setProxiedInterface(pathtree2);

        expect(changed).to.be.true;
        expect(ev.path).to.equal("");
        expect(ev.eventType).to.equal(PathEventType.Add);
    });
});
