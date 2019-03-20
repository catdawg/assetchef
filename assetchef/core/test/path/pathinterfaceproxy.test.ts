import { VError } from "verror";

import { IPathChangeEvent, PathEventType } from "../../src/path/ipathchangeevent";

import { PathInterfaceProxy } from "../../src/path/pathinterfaceproxy";
import { PathTree } from "../../src/path/pathtree";

describe("pathinterfaceproxy", () => {

    it("test unproxied and args", () => {
        const proxy = new PathInterfaceProxy<string>();

        expect(() => proxy.setProxiedInterface(null)).toThrow(VError);
        expect(() => proxy.removeProxiedInterface()).toThrow(VError);
        expect(proxy.exists("")).toBeFalse();
        expect(() => proxy.isDir("")).toThrow(VError);
        expect(() => proxy.get("")).toThrow(VError);
        expect(() => [...proxy.list("")]).toThrow(VError);
        expect([...proxy.listAll()]).toBeEmpty();
    });

    it("test interface", () => {
        const proxy = new PathInterfaceProxy<string>();

        const pathtree1 = new PathTree<string>();

        proxy.setProxiedInterface(pathtree1);
        pathtree1.set("something", "content");

        expect(proxy.exists("something")).toBeTrue();
        expect(proxy.get("something")).toEqual("content");
        expect([...proxy.list("")]).toIncludeSameMembers(["something"]);
        expect([...proxy.listAll()]).toIncludeSameMembers(["", "something"]);
        expect(proxy.isDir("something")).toBeFalse();
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
        expect(changed).toBeTrue();
        changed = false;

        proxy.setProxiedInterface(pathtree2);

        expect(changed).toBeTrue(); // set will trigger AddDir for the root.
        changed = false;

        pathtree1.set("something", "content2");
        expect(changed).toBeFalse();

        pathtree2.set("something", "content2");
        expect(changed).toBeTrue();
        changed = false;

        cancelToken.unlisten();

        pathtree2.set("something", "content3");
        expect(changed).toBeFalse();
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

        expect(changed).toBeFalse(); // no root

        proxy.removeProxiedInterface();

        expect(changed).toBeFalse(); // no root

        pathtree1.set("something", "content");

        proxy.setProxiedInterface(pathtree1);

        expect(changed).toBeTrue();
        expect(ev.path).toEqual("");
        expect(ev.eventType).toEqual(PathEventType.AddDir);
        changed = false;

        proxy.setProxiedInterface(pathtree2);

        expect(changed).toBeTrue();
        expect(ev.path).toEqual("");
        expect(ev.eventType).toEqual(PathEventType.UnlinkDir); // no root on 2

        proxy.setProxiedInterface(pathtree1);
        pathtree2.set("a file", "content");
        changed = false;

        proxy.setProxiedInterface(pathtree2);

        expect(changed).toBeTrue();
        expect(ev.path).toEqual("");
        expect(ev.eventType).toEqual(PathEventType.AddDir);
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

        expect(changed).toBeTrue();
        expect(ev.path).toEqual("");
        expect(ev.eventType).toEqual(PathEventType.Add);
        changed = false;

        proxy.setProxiedInterface(pathtree2);

        expect(changed).toBeTrue();
        expect(ev.path).toEqual("");
        expect(ev.eventType).toEqual(PathEventType.Unlink); // no root on 2

        proxy.setProxiedInterface(pathtree1);
        pathtree2.set("", "content");
        changed = false;

        proxy.setProxiedInterface(pathtree2);

        expect(changed).toBeTrue();
        expect(ev.path).toEqual("");
        expect(ev.eventType).toEqual(PathEventType.Add);
    });
});
