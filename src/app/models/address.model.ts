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
  abstract get length(): number;

  get isBroadcast() {
    return this.broadcast;
  }
  generateBroadcast(): Address {
    throw new Error("Not implemented");
  }
  abstract IsValid(): boolean;

}
export abstract class HardwareAddress extends Address {
}

export class MacAddress extends HardwareAddress {
  constructor(address: string) {
    address = address.toUpperCase();
    super(address);

    if( address == "FF:FF:FF:FF:FF:FF" )
      this.broadcast = true;

    if( !this.IsValid() )
      throw new Error("Invalid MAC address: " + address);
  }

  IsValid(): boolean {
    const mac = this.address.split(':');
    if( mac.length != 6 )
      return false;

    for( let i = 0; i < 6; i++ ) {
      const value = parseInt(mac[i], 16);
      if( mac[i].length === 0 || value.toString(16).toUpperCase() !== mac[i] || isNaN(value) || value < 0 || value > 255 )
        return false;
    }

    return true;
  }
  get length(): number {
    return 6;
  }

  static generateAddress(): MacAddress {
    const mac = new Array(6);
    for (let i = 0; i < 6; i++)
      mac[i] = Math.floor(Math.random() * 256).toString(16);
    return new MacAddress(mac.join(':'));
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

  constructor(address: string) {
    super(address);

    if( address == "255.255.255.255" )
      this.broadcast = true;

    if( !this.IsValid() )
      throw new Error("Invalid IP address");
  }

  IsValid(): boolean {
    const ip = this.address.split('.');
    if( ip.length != 4 )
      return false;

    for( let i = 0; i < 4; i++ ) {
      const value = parseInt(ip[i], 10);
      if( ip[i].length === 0 || value.toString(10) !== ip[i] || isNaN(value) || value < 0 || value > 255 )
        return false;
    }
    return true;
  }
  get length(): number {
    return 4;
  }

  static generateAddress(): IPAddress {
    const ip = new Array(4);
    for (let i = 0; i < 4; i++)
      ip[i] = Math.floor(Math.random() * 256);
    return new IPAddress(ip.join('.'));
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
