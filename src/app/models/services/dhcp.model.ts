import { IPAddress } from "../address.model";

export class NetworkServices {
  public enabled: boolean = false;
}
export class DhcpPool {
  public name;

  constructor(name: string = 'poolName') {
    this.name = name;
  }

  private gateway: IPAddress = new IPAddress("0.0.0.0");
  set gatewayAddress(value: IPAddress) {
    this.gateway = value;
    this.netmaskAddress = value.generateMask();
    this.startAddress = value.getNetworkIP(this.netmask).add(1);
    this.endAddress = value.getBroadcastIP(this.netmask).subtract(1);
  }
  get gatewayAddress(): IPAddress {
    return this.gateway;
  }

  private netmask: IPAddress = new IPAddress("0.0.0.0", true);
  set netmaskAddress(value: IPAddress) {
    this.netmask = value;
  }
  get netmaskAddress(): IPAddress {
    return this.netmask;
  }

  private start: IPAddress = new IPAddress("0.0.0.0");
  set startAddress(value: IPAddress) {
    if( !this.gateway.InSameNetwork(this.netmask, value) )
      throw new Error("Start address must be in the same network as the gateway");
    this.start = value;
  }
  get startAddress(): IPAddress {
    return this.start;
  }

  private end: IPAddress = new IPAddress("0.0.0.0");
  set endAddress(value: IPAddress) {
    if( !this.gateway.InSameNetwork(this.netmask, value) )
      throw new Error("End address must be in the same network as the gateway");
    this.end = value;
  }
  get endAddress(): IPAddress {
    return this.end;
  }

  public otherServices: Record<string, IPAddress> = {
    "dns": new IPAddress("0.0.0.0"),
    "tftp": new IPAddress("0.0.0.0"),
    "wlc": new IPAddress("0.0.0.0"),
  };


  public toString(): string {
    return this.name;
  }

}

export class DhcpService extends NetworkServices {
  public pools: DhcpPool[] = [new DhcpPool()];
}
