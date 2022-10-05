import { HardwareAddress, IPAddress, MacAddress, NetworkAddress } from "./address.model";

describe('address test', () => {

  beforeEach(async () => {

  });

  it( 'equals', () => {
    const mac_1 = MacAddress.generateAddress();
    const mac_2 = MacAddress.generateAddress();
    const mac_3 = new MacAddress("40:41:42:43:44:45");
    const mac_4 = new MacAddress("40:41:42:43:44:45");

    const ipv4_1 = IPAddress.generateAddress();
    const ipv4_2 = IPAddress.generateAddress();
    const ipv4_3 = new IPAddress("10.1.2.3");
    const ipv4_4 = new IPAddress("10.1.2.3");

    expect(mac_1.equals(mac_2)).toBe(false);
    expect(mac_1.equals(mac_3)).toBe(false);
    expect(mac_1.equals(null)).toBe(false);
    expect(mac_3.equals(mac_3)).toBe(true);
    expect(mac_3.equals(mac_4)).toBe(true);

    expect(ipv4_1.equals(ipv4_2)).toBe(false);
    expect(ipv4_1.equals(ipv4_3)).toBe(false);
    expect(ipv4_1.equals(null)).toBe(false);
    expect(ipv4_3.equals(ipv4_3)).toBe(true);
    expect(ipv4_3.equals(ipv4_4)).toBe(true);
  });
  it( 'invalid MAC', () => {
    expect(() => new MacAddress('FF:FF:FF:FF:FF:FF:')).toThrow();
    expect(() => new MacAddress(':FF:FF:FF:FF:FF:FF')).toThrow();
    expect(() => new MacAddress('FF:FF::FF:FF:FF:FF')).toThrow();
    expect(() => new MacAddress('FF:FF:FF:FF:FF:042')).toThrow();
    expect(() => new MacAddress('FF:FF:FF:FF:FF:128')).toThrow();
    expect(() => new MacAddress('FF:FF:FF:FF:FF:-1')).toThrow();

    expect(() => new MacAddress('40:41:42:43:44:45')).not.toThrow();
  });
  it( 'invalid IPv4', () => {
    expect(() => new IPAddress('255.255.255.255.')).toThrow();
    expect(() => new IPAddress('.255.255.255.255')).toThrow();
    expect(() => new IPAddress('255.255..255.255')).toThrow();
    expect(() => new IPAddress('255.255.255.042')).toThrow();
    expect(() => new IPAddress('255.255.255.256')).toThrow();
    expect(() => new IPAddress('255.255.255.-1')).toThrow();

    expect(() => new IPAddress('255.0.255.0', true)).toThrow();

    expect(() => new IPAddress('192.168.0.1')).not.toThrow();
    expect(() => new IPAddress('255.255.0.0', true)).not.toThrow();
  });

  it( 'broadcast', () => {
    expect(IPAddress.generateBroadcast().equals(new IPAddress("255.255.255.255"))).toBe(true);
    expect(MacAddress.generateBroadcast().equals(new MacAddress("FF:FF:FF:FF:FF:FF"))).toBe(true);

    expect(IPAddress.generateBroadcast().isBroadcast).toBe(true);
    expect(MacAddress.generateBroadcast().isBroadcast).toBe(true);

    expect(IPAddress.generateAddress().isBroadcast).toBe(false);
    expect(MacAddress.generateAddress().isBroadcast).toBe(false);
  });

  it( 'IPv4 mask', () => {
    const ipv4_1 = new IPAddress("10.0.0.1");
    const ipv4_2 = new IPAddress("172.16.0.1");
    const ipv4_3 = new IPAddress("192.168.0.1");

    expect(ipv4_1.generateMask().equals(new IPAddress("255.0.0.0", true))).toBe(true);
    expect(ipv4_2.generateMask().equals(new IPAddress("255.255.0.0", true))).toBe(true);
    expect(ipv4_3.generateMask().equals(new IPAddress("255.255.255.0", true)) ).toBe(true);
  });

  it( 'IPv4 network', () => {
    const ipv4_1 = new IPAddress("10.0.0.1");
    const ipv4_2 = new IPAddress("172.16.0.1");
    const ipv4_3 = new IPAddress("192.168.0.1");

    expect(ipv4_1.InSameNetwork(ipv4_1.generateMask(), new IPAddress("10.0.0.1"))).toBe(true);
    expect(ipv4_1.InSameNetwork(ipv4_1.generateMask(), new IPAddress("10.250.42.24"))).toBe(true);
    expect(ipv4_1.InSameNetwork(ipv4_1.generateMask(), new IPAddress("11.0.0.1"))).toBe(false);
    expect(ipv4_1.InSameNetwork(ipv4_1.generateMask(), new IPAddress("9.0.0.1"))).toBe(false);

    expect(ipv4_2.InSameNetwork(ipv4_2.generateMask(), new IPAddress("172.16.0.1"))).toBe(true);
    expect(ipv4_2.InSameNetwork(ipv4_2.generateMask(), new IPAddress("172.16.42.24"))).toBe(true);
    expect(ipv4_2.InSameNetwork(ipv4_2.generateMask(), new IPAddress("172.17.0.0"))).toBe(false);
    expect(ipv4_2.InSameNetwork(ipv4_2.generateMask(), new IPAddress("172.15.0.0"))).toBe(false);

    expect(ipv4_3.InSameNetwork(ipv4_3.generateMask(), new IPAddress("192.168.0.1"))).toBe(true);
    expect(ipv4_3.InSameNetwork(ipv4_3.generateMask(), new IPAddress("192.168.0.42"))).toBe(true);
    expect(ipv4_3.InSameNetwork(ipv4_3.generateMask(), new IPAddress("192.168.1.1"))).toBe(false);
    expect(ipv4_3.InSameNetwork(ipv4_3.generateMask(), new IPAddress("192.168.255.1"))).toBe(false);

    expect(ipv4_3.InSameNetwork(new IPAddress("255.0.0.0", true), new IPAddress("192.42.255.1"))).toBe(true);
    expect(ipv4_3.InSameNetwork(new IPAddress("255.255.0.0", true), new IPAddress("192.42.255.1"))).toBe(false);
    expect(ipv4_3.InSameNetwork(new IPAddress("255.255.0.0", true), new IPAddress("192.168.42.1"))).toBe(true);
    expect(ipv4_3.InSameNetwork(new IPAddress("0.0.0.0", true), new IPAddress("42.42.42.42"))).toBe(true);

  });

  it( 'IPv4 math', () => {
    const ipv4_1 = new IPAddress("10.0.0.1");
    const ipv4_2 = new IPAddress("172.16.0.1");
    const ipv4_3 = new IPAddress("192.168.0.1");

    expect(ipv4_1.getNetworkIP(ipv4_1.generateMask()).equals(new IPAddress("10.0.0.0"))).toBe(true);
    expect(ipv4_1.getNetworkIP(ipv4_1.generateMask()).add(2).equals(new IPAddress("10.0.0.2"))).toBe(true);
    expect(ipv4_1.getNetworkIP(ipv4_1.generateMask()).add(256).equals(new IPAddress("10.0.1.0"))).toBe(true);
    expect(ipv4_1.getNetworkIP(ipv4_1.generateMask()).add(256*256).equals(new IPAddress("10.1.0.0"))).toBe(true);

    expect(ipv4_1.getBroadcastIP(ipv4_1.generateMask()).equals(new IPAddress("10.255.255.255"))).toBe(true);
    expect(ipv4_1.getBroadcastIP(ipv4_1.generateMask()).subtract(1).equals(new IPAddress("10.255.255.254"))).toBe(true);
    expect(ipv4_1.getBroadcastIP(ipv4_1.generateMask()).subtract(256).equals(new IPAddress("10.255.254.255"))).toBe(true);
    expect(ipv4_1.getBroadcastIP(ipv4_1.generateMask()).subtract(256*256).equals(new IPAddress("10.254.255.255"))).toBe(true);

    expect(ipv4_1.getBroadcastIP(ipv4_1.generateMask()).subtract(256*256).add(256*256+1).equals(new IPAddress("11.0.0.0"))).toBe(true);

    expect(ipv4_2.getNetworkIP(ipv4_2.generateMask()).equals(new IPAddress("172.16.0.0"))).toBe(true);
    expect(ipv4_2.getBroadcastIP(ipv4_2.generateMask()).equals(new IPAddress("172.16.255.255"))).toBe(true);

    expect(ipv4_3.getNetworkIP(ipv4_3.generateMask()).equals(new IPAddress("192.168.0.0"))).toBe(true);
    expect(ipv4_3.getBroadcastIP(ipv4_3.generateMask()).equals(new IPAddress("192.168.0.255"))).toBe(true);

  });


});
