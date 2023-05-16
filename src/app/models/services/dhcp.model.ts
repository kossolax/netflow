import { map, Observable, race, Subject, Subscription, take, tap } from "rxjs";
import { SchedulerService } from "src/app/services/scheduler.service";
import { HardwareAddress, IPAddress, MacAddress, NetworkAddress } from "../address.model";
import { HardwareInterface, Interface } from "../layers/datalink.model";
import { NetworkInterface } from "../layers/network.model";
import { NetworkMessage, Payload } from "../message.model";
import { GenericNode, NetworkHost, SwitchHost } from "../node.model";
import { IPv4Message } from "../protocols/ipv4.model";
import { ActionHandle, NetworkListener } from "../protocols/protocols.model";

// https://www.rfc-editor.org/rfc/rfc2131
export class NetworkServices<T extends NetworkHost|SwitchHost > {
  protected enabled: boolean = false;
  get Enable(): boolean {
    return this.enabled;
  }
  set Enable(enable: boolean) {
    if( enable ) {
      this.host.getInterfaces().map((i) => {
        const iface = this.host.getInterface(i);

        if( this.ifaces.indexOf(iface) < 0 ) {
          this.ifaces.push(iface);
          iface.addListener(this);
          if( iface instanceof NetworkInterface)
            iface.getInterface(0).addListener(this);
        }
      });
    }
    else {
      this.ifaces.map((i) => {
        i.removeListener(this);
      });
      this.ifaces = [];
    }
    this.enabled = enable;
  }

  protected host: T;
  protected ifaces: Interface[];

  constructor(host: T) {
    this.host = host;
    this.ifaces = [];
  }

}
export class DhcpPool {
  public name;
  public IPReserved: Map<string, Subscription> = new Map();

  constructor(name: string = 'poolName', gateway: IPAddress|null = null, netmask: IPAddress|null = null, start: IPAddress|null = null, end: IPAddress|null = null) {
    this.name = name;

    if( gateway )
      this.gatewayAddress = gateway;

    if( netmask )
      this.netmaskAddress = netmask;

    if( start )
      this.startAddress = start;

    if( end )
      this.endAddress = end;
  }

  private gateway: IPAddress = new IPAddress("0.0.0.0");
  set gatewayAddress(value: IPAddress) {
    this.IPReserved.delete(this.gateway.toString());
    this.gateway = value;
    this.IPReserved.set(this.gateway.toString(), Subscription.EMPTY);
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

  public getFirstAvailableIP(): IPAddress|null {
    let ip = this.startAddress;

    while( this.IPReserved.has(ip.toString()) ) {
      ip = ip.add(1);
      if( ip.equals(this.endAddress) )
        return null;
    }
    return ip;
  }
  public reserveIP(ip: IPAddress, howLong: number=20): void {

    this.IPReserved.get(ip.toString())?.unsubscribe();

    let timeout$ = SchedulerService.Instance.once(howLong).subscribe(() => {
      this.IPReserved.delete(ip.toString());
    });

    this.IPReserved.set(ip.toString(), timeout$);
  }
  public releaseIP(ip: IPAddress): void {
    this.IPReserved.get(ip.toString())?.unsubscribe();
    this.IPReserved.delete(ip.toString());
  }

}
enum DhcpType {
  Unknown = 0,
  Discover = 1,
  Offer = 2,
  Request = 3,
  Decline = 4,
  Ack = 5,
  Nak = 6,
  Release = 7,
  Inform = 8,
}
enum DhcpOpCode {
  Request = 1,
  Reply = 2,
}
class DhcpMessage extends IPv4Message {
  public op: DhcpOpCode = DhcpOpCode.Request;
  public readonly htype: 1 = 1; // type of hardware address. 1 = MAC Address
  public readonly hlen: number = 6;  // mac address length in bytes
  public hops: number = 0;
  public xid: number = 0;
  public secs: number = 0;
  public dhcp_flags: {
    broadcast: boolean
  } = { broadcast: false };

  public ciaddr!: NetworkAddress;
  public yiaddr!: NetworkAddress;
  public siaddr!: NetworkAddress;
  public giaddr!: NetworkAddress;

  public chaddr!: HardwareAddress;
  public sname: string = "";

  public options: {
    type: DhcpType,
    subnetMask: IPAddress|null,
    router: IPAddress|null,
    leaseTime: number|null,
    dhcpServer: IPAddress|null,
    dnsServers: IPAddress[]|null,
  } = {
    type: DhcpType.Unknown,
    subnetMask: null,
    router: null,
    leaseTime: null,
    dhcpServer: null,
    dnsServers: null,
  };

  protected constructor(payload: Payload|string,
    src: IPAddress, dst: IPAddress) {
    super(payload, src, dst);
  }

  public override toString(): string {
    return "DHCP";
  }

  public static override Builder = class extends (IPv4Message.Builder) {
    private type: DhcpType = DhcpType.Unknown;
    public setType(type: DhcpType): this {
      this.type = type;

      switch(type) {
        case DhcpType.Discover:
        case DhcpType.Request:
        case DhcpType.Decline:
        case DhcpType.Release:
        case DhcpType.Inform:
          this.op = DhcpOpCode.Request;
          break;
        case DhcpType.Offer:
        case DhcpType.Ack:
        case DhcpType.Nak:
          this.op = DhcpOpCode.Reply;
          break;
      }
      return this;
    }

    private op: DhcpOpCode = DhcpOpCode.Request;
    private hops: number = 0;
    private xid: number = 0;
    public setTransactionId(value: number): this {
      this.xid = value;
      return this;
    }

    private flags: { broadcast: boolean } = { broadcast: false };

    private ciaddr: NetworkAddress = new IPAddress("0.0.0.0");
    public setClientAddress(value: NetworkAddress): this {
      this.ciaddr = value;
      return this;
    }
    private yiaddr: NetworkAddress = new IPAddress("0.0.0.0");
    public setYourAddress(value: NetworkAddress): this {
      this.yiaddr = value;
      return this;
    }
    private siaddr: NetworkAddress = new IPAddress("0.0.0.0");
    public setServerAddress(value: NetworkAddress): this {
      this.siaddr = value;
      return this;
    }
    private giaddr: NetworkAddress = new IPAddress("0.0.0.0");
    public setGatewayAddress(value: NetworkAddress): this {
      this.giaddr = value;
      return this;
    }

    private chaddr: HardwareAddress|null = null;
    public setClientHardwareAddress(value: HardwareAddress): this {
      this.chaddr = value;
      return this;
    }
    private sname: string = "";
    public setServerName(value: string): this {
      this.sname = value;
      return this;
    }

    public override build(): IPv4Message[] {
      if( this.net_src === null )
        throw new Error("No source address specified");
      if( this.net_dst === null )
        throw new Error("No destination address specified");
      if( this.chaddr === null )
        throw new Error("No client hardware address specified");

      switch( this.type ) {
        case DhcpType.Ack:
        case DhcpType.Nak:
        case DhcpType.Offer:
          if( this.yiaddr.equals(new IPAddress("0.0.0.0")) )
            throw new Error("No yiaddr specified");
          if( this.siaddr.equals(new IPAddress("0.0.0.0")) )
            throw new Error("No siaddr specified");
          break;

        case DhcpType.Request:
          if( this.ciaddr.equals(new IPAddress("0.0.0.0")) )
            throw new Error("No ciaddr specified");
          if( this.siaddr.equals(new IPAddress("0.0.0.0")) )
            throw new Error("No siaddr specified");
          break;

        case DhcpType.Release:
          if( this.ciaddr.equals(new IPAddress("0.0.0.0")) )
            throw new Error("No ciaddr specified");
          break;
      }

      let message = new DhcpMessage("", this.net_src, this.net_dst);
      message.header_checksum = message.checksum();
      message.protocol = 1;
      message.TOS = 0;

      message.op = this.op;
      message.hops = this.hops;
      message.xid = this.xid === 0 ? Math.floor(Math.random() * 0xFFFFFFFF) : this.xid;
      message.secs = 0;
      message.dhcp_flags = this.flags;
      message.ciaddr = this.ciaddr;
      message.yiaddr = this.yiaddr;
      message.siaddr = this.siaddr;
      message.giaddr = this.giaddr;
      message.options.type = this.type;

      return [message];
    }
  }
}

export class DhcpClient implements NetworkListener {
  private iface: NetworkInterface;
  private queue: Map<number, Subject<IPAddress>>;
  private successFull: boolean = false;

  constructor(iface: NetworkInterface) {
    this.iface = iface;
    this.iface.addListener(this);
    this.queue = new Map<number, Subject<IPAddress>>();
  }
  public destroy(): void {
    this.release();
    this.iface.removeListener(this);
  }

  public negociate(timeout: number=20, repeat: boolean=false): Observable<IPAddress|null> {
    const request = new DhcpMessage.Builder()
      .setType(DhcpType.Discover)
      .setNetSource(new IPAddress("0.0.0.0"))
      .setNetDestination(IPAddress.generateBroadcast())
      .setClientHardwareAddress(this.iface.getMacAddress())
      .build()[0] as DhcpMessage;

    const subject: Subject<IPAddress> = new Subject();
    this.queue.set(request.xid, subject);

    this.iface.sendPacket(request);
    let timeout$ = SchedulerService.Instance.once(timeout).pipe(map(() => null));
    return race(subject, timeout$).pipe(
      tap(() => this.queue.delete(request.xid))
    );

  }
  public release(): void {
    if( this.successFull ) {
      this.successFull = false;

      const request = new DhcpMessage.Builder()
        .setType(DhcpType.Release)
        .setNetSource(this.iface.getNetAddress() as IPAddress)
        .setClientAddress(this.iface.getNetAddress() as IPAddress)
        .setNetDestination(IPAddress.generateBroadcast())
        .setClientHardwareAddress(this.iface.getMacAddress())
        .build()[0] as DhcpMessage;

      this.iface.sendPacket(request);
      this.iface.setNetAddress(new IPAddress("0.0.0.0"));
    }
  }


  public receivePacket(message: NetworkMessage, from: Interface): ActionHandle {
    if( message instanceof DhcpMessage && message.op === DhcpOpCode.Reply ) {

      const iface = from as NetworkInterface;

      // Offer:
      if( message.options.type === DhcpType.Offer ) {
        const request = new DhcpMessage.Builder()
          .setType(DhcpType.Request)
          .setNetSource(new IPAddress("0.0.0.0"))
          .setNetDestination(IPAddress.generateBroadcast())
          .setClientHardwareAddress(message.chaddr)
          .setTransactionId(message.xid)
          .setClientAddress(message.yiaddr)
          .setServerAddress(message.siaddr)
          .build()[0] as DhcpMessage;

        iface.sendPacket(request);
        return ActionHandle.Stop;
      }

      // Ack:
      if( message.options.type === DhcpType.Ack ) {
        iface.setNetAddress(message.yiaddr);
        this.successFull = true;
        const subject = this.queue.get(message.xid);
        if( subject !== undefined )
          subject.next(message.yiaddr as IPAddress);

        return ActionHandle.Stop;
      }


    }
    return ActionHandle.Continue;
  }
}

export class DhcpServer extends NetworkServices<NetworkHost> implements NetworkListener {
  public pools: DhcpPool[] = [];
  public forwarder: IPAddress|null = null;

  constructor(host: NetworkHost) {
    super(host);
  }


  public receivePacket(message: NetworkMessage, from: Interface): ActionHandle {

    if( message instanceof DhcpMessage ) {

      if( message.op === DhcpOpCode.Request ) {

        const iface = from as NetworkInterface;
        const selfIP = iface.getNetAddress() as IPAddress;
        const loolupIP = message.giaddr.equals(new IPAddress("0.0.0.0")) ? selfIP : message.giaddr as IPAddress;
        const dstIP = message.giaddr.equals(new IPAddress("0.0.0.0")) ? IPAddress.generateBroadcast() : message.giaddr as IPAddress;

        const pool = this.pools.find((p) => p.gatewayAddress.InSameNetwork(p.netmaskAddress, loolupIP as IPAddress));

        if( pool ) {

          if( message.options.type === DhcpType.Discover ) {
            const ipAvailable = pool.getFirstAvailableIP();

            if( ipAvailable ) {
              pool.reserveIP(ipAvailable, 20);

              const request = new DhcpMessage.Builder()
                .setType(DhcpType.Offer)
                .setNetSource(selfIP)
                .setNetDestination( dstIP )
                .setClientHardwareAddress(message.chaddr)
                .setTransactionId(message.xid)
                .setYourAddress(ipAvailable)
                .setServerAddress(selfIP)
                .setGatewayAddress(message.giaddr)
                .build()[0] as DhcpMessage;

              iface.sendPacket(request);
              return ActionHandle.Stop;
            }
          }

          if( message.options.type === DhcpType.Request ) {
            pool.reserveIP(message.ciaddr as IPAddress, 24 * 60 * 60);

            const request = new DhcpMessage.Builder()
              .setType(DhcpType.Ack)
              .setNetSource(selfIP)
              .setNetDestination(dstIP)
              .setClientHardwareAddress(message.chaddr)
              .setTransactionId(message.xid)
              .setYourAddress(message.ciaddr)
              .setServerAddress(selfIP)
              .setGatewayAddress(message.giaddr)

              .build()[0] as DhcpMessage;

            iface.sendPacket(request);
            return ActionHandle.Stop;
          }

          if( message.options.type === DhcpType.Release ) {
            pool.releaseIP(message.ciaddr as IPAddress);
            return ActionHandle.Stop;
          }

        }

        if( message.net_dst?.isBroadcast && this.forwarder ) {
          const src_iface = this.host.getInterfaces().find( i => {
            const iface = this.host.getInterface(i);
            return iface.getNetAddress().InSameNetwork(iface.getNetMask(), this.forwarder as NetworkAddress);
          });

          if( src_iface ) {

            const request = new DhcpMessage.Builder()
              .setType(message.options.type)
              .setNetSource(this.host.getInterface(src_iface).getNetAddress() as IPAddress)
              .setNetDestination(this.forwarder)
              .setClientHardwareAddress(message.chaddr)
              .setTransactionId(message.xid)
              .setYourAddress(message.yiaddr)
              .setServerAddress(message.siaddr)
              .setClientAddress(message.ciaddr)
              .setGatewayAddress(iface.getNetAddress() as IPAddress)
              .build()[0] as DhcpMessage;

            this.host.send(request);

          }
          return ActionHandle.Stop;
        }

      }

      // Handle response from forwarder:
      if( message.op === DhcpOpCode.Reply && message.net_dst?.isBroadcast == false ) {
        const iface = this.ifaces.find( i => (i as NetworkInterface).hasNetAddress(message.giaddr) ) as NetworkInterface|undefined;

        if( iface ) {
          const request = new DhcpMessage.Builder()
            .setType(message.options.type)
            .setNetSource(message.giaddr as IPAddress)
            .setNetDestination(IPAddress.generateBroadcast())
            .setClientHardwareAddress(message.chaddr)
            .setTransactionId(message.xid)
            .setYourAddress(message.yiaddr)
            .setServerAddress(message.siaddr)
            .setClientAddress(message.ciaddr)
            .setGatewayAddress(new IPAddress("0.0.0.0"))
            .build()[0] as DhcpMessage;

          iface.sendPacket(request);
          return ActionHandle.Stop;
        }
      }

      return ActionHandle.Continue;
    }

    return ActionHandle.Continue;
  }

}
