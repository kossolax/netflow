export abstract class Address {
  protected address: string;
  protected broadcast: boolean = false;

  constructor(address: string = "") {
    this.address = address;
  }

  equals(other: Address|null): boolean {
    if( other == null )
      return false;

    return this.address === other.address;
  }
  toString(): string {
    return this.address;
  }

  get isBroadcast() {
    return this.broadcast;
  }
  generateBroadcast(): Address {
    throw new Error("Not implemented");
  }

}
export abstract class HardwareAddress extends Address {
}

export class MacAddress extends HardwareAddress {
  constructor(address: string = "") {
    if( address == "" )
      address = MacAddress.generateAddress();

    address = address.toUpperCase();
    super(address);

    if( address == "FF:FF:FF:FF:FF:FF" )
      this.broadcast = true;
  }

  private static generateAddress(): string {
    const mac = new Array(6);
    for (let i = 0; i < 6; i++)
      mac[i] = Math.floor(Math.random() * 256);
    return mac.join(':');
  }

  override generateBroadcast(): MacAddress {
    return MacAddress.generateBroadcast();
  }
  static generateBroadcast(): MacAddress {
    const mac = new MacAddress("FF:FF:FF:FF:FF:FF");
    mac.broadcast = true;
    return mac;
  }
}

export abstract class NetworkAddress extends Address {
}
export class IPAddress extends NetworkAddress {

  constructor(address: string = "") {
    if( address == "" )
      address = IPAddress.generateAddress();

    address = address.toUpperCase();
    super(address);

    if( address == "255.255.255.255" )
      this.broadcast = true;
  }

  private static generateAddress(): string {
    const ip = new Array(4);
    for (let i = 0; i < 4; i++)
      ip[i] = Math.floor(Math.random() * 256);
    return ip.join('.');
  }

  override generateBroadcast(): IPAddress {
    return IPAddress.generateBroadcast();
  }
  static generateBroadcast(): IPAddress {
    const ip = new IPAddress("255.255.255.255");
    ip.broadcast = true;
    return ip;
  }
}
