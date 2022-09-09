import { RouterHost, SwitchHost } from "../node.model";
import { Terminal } from "./terminal.model";

describe('Terminal config test', () => {
  let terminalRouter: Terminal;
  let terminalSwitch: Terminal;

  beforeEach(async () => {
    terminalRouter = new Terminal(new RouterHost("R", 4));
    terminalSwitch = new Terminal(new SwitchHost("S", 4));
  });

  it( 'hostname', () => {

    terminalRouter.exec("enable", []);
    terminalRouter.exec("configure", ["terminal"]);

    const hostname = Math.random().toString(36).substring(7);
    terminalRouter.exec("hostname", [hostname]);

    expect(terminalRouter.Node.name).toBe(hostname);
    expect(terminalRouter.Prompt).toBe(hostname + "(config)#");

    terminalRouter.exec("exit", []);
    expect(terminalRouter.Prompt).toBe(hostname + "$");
  });

  it( 'ip route', () => {
    const host = terminalRouter.Node as RouterHost

    terminalRouter.exec("enable", []);
    terminalRouter.exec("configure", ["terminal"]);

    expect(host.RoutingTable.length).toBe(0);
    terminalRouter.exec("ip", ["route", "192.168.0.0", "255.255.255.0", "192.168.20.1"]);
    terminalRouter.exec("ip", ["route", "0.0.0.0", "0.0.0.0", "192.168.30.1"]);
    expect(host.RoutingTable.length).toBe(2);
    terminalRouter.exec("no", ["ip", "route", "0.0.0.0", "0.0.0.0", "192.168.30.1"]);
    expect(host.RoutingTable.length).toBe(1);
    expect(host.RoutingTable[0].network.toString()).toBe("192.168.0.0");
    terminalRouter.exec("ip", ["route", "0.0.0.0", "0.0.0.0", "192.168.30.1"]);
    terminalRouter.exec("no", ["ip", "route", "192.168.0.0", "255.255.255.0", "192.168.20.1"]);
    expect(host.RoutingTable.length).toBe(1);
    expect(host.RoutingTable[0].network.toString()).toBe("0.0.0.0");


    terminalSwitch.exec("enable", []);
    terminalSwitch.exec("configure", ["terminal"]);
    expect(terminalSwitch.autocomplete("ip", [])).toEqual([]);
  });
});
