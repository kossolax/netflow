import { IPAddress } from "../address.model";
import { RouterHost } from "../nodes/router.model";
import { Terminal } from "./terminal.model";

describe('Terminal basic test', () => {
  let router: RouterHost;
  let terminalRouter: Terminal;

  beforeEach(async () => {
    router = new RouterHost("R", 4);
    terminalRouter = new Terminal(router);
  });

  it( 'auto-complete', () => {
    expect(terminalRouter.autocomplete("").length).toBeGreaterThan(0);
    expect(terminalRouter.autocomplete("plop").length).toBe(0);

    expect(terminalRouter.autocomplete("ena").length).toEqual(1);
    expect(terminalRouter.autocomplete("ena")[0]).toBe("enable");

    expect(terminalRouter.autocomplete("enable").length).toEqual(1);
    expect(terminalRouter.autocomplete("enable")[0]).toBe("enable");


    expect(terminalRouter.exec("enable")).toBeTrue();
    expect(terminalRouter.autocomplete("no").length).toBe(0);

    expect(terminalRouter.autocomplete("").length).toBeGreaterThan(0);
    expect(terminalRouter.autocomplete("plop").length).toBe(0);
    expect(terminalRouter.autocomplete("conf").length).toBeGreaterThan(0);
    expect(terminalRouter.autocomplete("conf ").length).toBeGreaterThan(0);
    expect(terminalRouter.autocomplete("conf plop").length).toBe(0);
    expect(terminalRouter.autocomplete("conf term").length).toBeGreaterThan(0);
    expect(terminalRouter.autocomplete("configure plop").length).toBe(0);
    expect(terminalRouter.autocomplete("configure term").length).toBeGreaterThan(0);
  });

  it('history', () => {
    expect(terminalRouter.historyBack()).toBeUndefined();
    expect(terminalRouter.historyForward()).toBeUndefined();
    expect(terminalRouter.exec("enable")).toBeTrue();
    expect(terminalRouter.exec("conf t")).toBeTrue();
    expect(terminalRouter.exec("int gig 0/0")).toBeTrue();
    expect(terminalRouter.historyBack()).toBe("conf t");
    expect(terminalRouter.historyBack()).toBe("enable");
    expect(terminalRouter.historyForward()).toBe("conf t");
    expect(terminalRouter.historyForward()).toBe("int gig 0/0");
  });

  it( 'basic command', () => {
    expect(terminalRouter.exec("enable")).toBeTrue();
    expect(terminalRouter.Prompt).toBe(terminalRouter.Node.name + "#");
    expect(terminalRouter.exec("exit")).toBeTrue();
    expect(terminalRouter.Prompt).toBe(terminalRouter.Node.name + "$");
    expect(terminalRouter.exec("enable")).toBeTrue();
    expect(terminalRouter.Prompt).toBe(terminalRouter.Node.name + "#");
    expect(terminalRouter.exec("end")).toBeTrue();
    expect(terminalRouter.Prompt).toBe(terminalRouter.Node.name + "$");

    expect(terminalRouter.exec("plop")).toBeFalse();
  });

  it('lock', () => {
    router.getInterface(0).setNetAddress(IPAddress.generateAddress());
    router.getInterface(0).up();

    expect(terminalRouter.exec("ping 10.0.0.1")).toBeTrue();
    expect(terminalRouter.Locked).toBeTrue();
    expect(terminalRouter.exec("enable")).toBeFalse();
  });

});
