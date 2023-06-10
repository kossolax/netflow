import { IPAddress } from "../address.model";
import { Dot1QInterface } from "../layers/datalink.model";
import { RouterHost } from "../nodes/router.model";
import { SwitchHost } from "../nodes/switch.model";
import { VlanMode } from "../protocols/ethernet.model";
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

    terminalRouter.exec("enable");
    terminalRouter.exec("configure terminal");

    expect(terminalRouter.exec("interface")).toBeFalse();
    expect(terminalRouter.exec("interface gig")).toBeFalse();
    expect(terminalRouter.exec("interface gig 9/9")).toBeFalse();
    expect(terminalRouter.exec("interface gig 0/0")).toBeTrue();

    expect(terminalRouter.exec("ip")).toBeFalse();
    expect(terminalRouter.exec("ip address")).toBeFalse();
    expect(terminalRouter.exec("ip address " + B.toString())).toBeFalse();
    expect(terminalRouter.exec("ip address " + B.toString() + " " + B.generateMask().toString())).toBeTrue();

    expect(host.getInterface(0).getNetAddress().toString()).toBe(B.toString());
    expect(host.getInterface(0).getNetMask().toString()).toBe(B.generateMask().toString());

    // should not exist on switch
    terminalSwitch.exec("enable");
    terminalSwitch.exec("configure terminal");
    terminalSwitch.exec("interface gig 0/0");
    expect(terminalSwitch.autocomplete("ip")).toEqual([]);
  });

  it( 'switchport', () => {
    const host = terminalSwitch.Node as SwitchHost;
    host.knownVlan[10] = 'VLAN10';
    host.knownVlan[20] = 'VLAN20';

    const iface = (host.getInterface(0) as Dot1QInterface);

    terminalSwitch.exec("enable");
    terminalSwitch.exec("configure terminal");
    terminalSwitch.exec("interface gig 0/0");

    expect(iface.Vlan).toEqual([iface.NativeVlan]);
    expect(iface.VlanMode).toBe(VlanMode.Access);

    expect(terminalSwitch.exec("switchport")).toBeFalse();
    expect(terminalSwitch.exec("switchport mode")).toBeFalse();
    expect(terminalSwitch.exec("switchport mode toto")).toBeFalse();
    expect(terminalSwitch.exec("switchport mode trunk")).toBeTrue();
    expect(iface.VlanMode).toBe(VlanMode.Trunk);

    expect(terminalSwitch.exec("switchport mode access")).toBeTrue();

    expect(terminalSwitch.exec("switchport access")).toBeFalse();
    expect(terminalSwitch.exec("switchport access vlan")).toBeFalse();
    expect(terminalSwitch.exec("switchport access vlan 10")).toBeTrue();
    expect(iface.Vlan).toEqual([10]);
    expect(iface.VlanMode).toBe(VlanMode.Access);
    terminalSwitch.exec("switchport access vlan 20");
    expect(iface.Vlan).toEqual([20]);


    terminalSwitch.exec("switchport mode trunk");
    terminalSwitch.exec("switchport trunk allowed vlan remove 20");
    terminalSwitch.exec("switchport trunk allowed vlan add 10");
    expect(iface.Vlan).toEqual([10]);
    terminalSwitch.exec("switchport trunk allowed vlan add 20");
    expect(iface.Vlan).toEqual([10, 20]);
    terminalSwitch.exec("switchport trunk allowed vlan remove 10");
    expect(iface.Vlan).toEqual([20]);
    terminalSwitch.exec("switchport trunk allowed vlan remove 20");
    expect(iface.Vlan).toEqual([]);
    terminalSwitch.exec("switchport trunk allowed vlan all");
    expect(iface.Vlan).toEqual([10, 20]);
    terminalSwitch.exec("switchport trunk allowed vlan 10");
    expect(iface.Vlan).toEqual([10]);
    terminalSwitch.exec("switchport trunk allowed vlan except 10");
    expect(iface.Vlan).toEqual([20]);
    terminalSwitch.exec("switchport trunk allowed vlan all");
    expect(iface.Vlan).toEqual([10, 20]);


    terminalSwitch.exec("switchport trunk native vlan 42");
    terminalSwitch.exec("switchport trunk allowed vlan remove 10");
    terminalSwitch.exec("switchport trunk allowed vlan remove 20");
    expect(iface.Vlan).toEqual([]);
    terminalSwitch.exec("switchport mode access");
    expect(iface.Vlan).toEqual([42]);


    // should not exist on router
    terminalRouter.exec("enable");
    terminalRouter.exec("configure terminal");
    terminalRouter.exec("interface gig 0/0");
    expect(terminalRouter.autocomplete("switchport")).toEqual([]);
  });

});
