import { IPAddress } from "../address.model";
import { RouterHost, SwitchHost } from "../node.model";
import { Terminal } from "./terminal.model";

describe('Terminal interface test', () => {
  let terminalRouter: Terminal;
  let terminalSwitch: Terminal;

  beforeEach(async () => {
    terminalRouter = new Terminal(new RouterHost("R", 4));
    terminalSwitch = new Terminal(new SwitchHost("S", 4));
  });


  it( 'ip addr', () => {
    const host = terminalRouter.Node as RouterHost;
    const A = IPAddress.generateAddress();
    const B = IPAddress.generateAddress();

    host.getInterface(0).setNetAddress(A);

    terminalRouter.exec("enable", []);
    terminalRouter.exec("configure", ["terminal"]);
    terminalRouter.exec("interface", ["gig", "0/0"]);

    terminalRouter.exec("ip", ["address", B.toString(), B.generateMask().toString()]);

    expect(host.getInterface(0).getNetAddress().toString()).toBe(B.toString());
    expect(host.getInterface(0).getNetMask().toString()).toBe(B.generateMask().toString());

    // should not exist on switch
    terminalSwitch.exec("enable", []);
    terminalSwitch.exec("configure", ["terminal"]);
    terminalSwitch.exec("interface", ["gig", "0/0"]);
    expect(terminalSwitch.autocomplete("ip", [])).toEqual([]);
  });

});
