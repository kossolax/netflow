import { Action } from "rxjs/internal/scheduler/Action";
import { HardwareAddress, IPAddress } from "../address.model";
import { Interface } from "../layers/datalink.model";
import { NetworkInterface } from "../layers/network.model";
import { NetworkMessage, Payload } from "../message.model";
import { ActionHandle, NetworkListener } from "./protocols.model";

export class IPv4Message extends NetworkMessage {

  public version: number = 4;
  public header_length: number = 5;
  public TOS: number = 0;
  public total_length: number = 0;

  public identification: number = 0;
  public flags = {
    reserved: 0,
    dont_fragment: 0,
    more_fragments: 0
  };
  public fragment_offset: number = 0;

  public ttl: number = 0;
  public protocol: number = 0;
  public header_checksum: number = 0;

  private constructor(payload: Payload|string,
    mac_src: HardwareAddress, mac_dst: HardwareAddress|null,
    net_src: IPAddress, net_dst: IPAddress|null) {
    super(payload, mac_src, mac_dst, net_src, net_dst);
  }

  override get length(): number {
    return super.length + 16;
  }

  override toString(): string {
    return "IPv4";
  }

  public checksum(): number {
    let sum = 0;

    //let data = this.payload.toString();
    //for(let i = 0; i < data.length; i++)
    //    sum = Math.imul(31, sum) + data.charCodeAt(i) | 0;

    sum = Math.imul(31, sum) + (this.version + this.header_length + this.TOS + this.total_length);
    sum = Math.imul(31, sum) + (this.identification + this.flags.reserved + this.flags.dont_fragment + this.flags.more_fragments + this.fragment_offset);
    sum = Math.imul(31, sum) + (this.ttl + this.protocol); // do not include "checksum" header in the checksum

    return sum;
  }


  static Builder = class {
    public payload: Payload|string = "";
    public net_src: IPAddress|null = null;
    public mac_src: HardwareAddress|null = null;
    public net_dst: IPAddress|null = null;
    public mac_dst: HardwareAddress|null = null;
    public ttl: number = 30;
    public id: number = 0;
    public protocol: number = 0;
    public max_size: number = 65535;

    public setNetSource(addr: IPAddress): this {
      this.net_src = addr;
      return this;
    }
    public setMacSource(addr: HardwareAddress): this {
      this.mac_src = addr;
      return this;
    }
    public setNetDestination(addr: IPAddress): this {
      this.net_dst = addr;
      return this;
    }
    public setMacDestination(addr: HardwareAddress): this {
      this.mac_dst = addr;
      return this;
    }
    public setPayload(payload: Payload|string): this {
      this.payload = payload;
      return this;
    }
    public setTTL(ttl: number): this {
      if( ttl > 255 )
        throw new Error("TTL is too big");
      if( ttl < 0 )
        throw new Error("TTL is too small");
      this.ttl = ttl;
      return this;
    }
    public setMaximumSize(size: number): this {
      if( size > 65535 )
        throw new Error("Maximum size is 65535");
      this.max_size = size;
      return this;
    }
    public setIdentification(id: number): this {
      this.id = id;
      return this;
    }
    public setProtocol(id: number): this {
      this.protocol = id;
      return this;
    }

    build(): IPv4Message[] {
      if( this.mac_src === null )
        throw new Error("MAC source address is not set");
      if( this.net_src === null )
        throw new Error("Source address is not set");
      if( this.net_src === null )
        throw new Error("Destination address is not set");
      if( this.payload.length >= this.max_size )
        throw new Error("Fragmentation is not supported, yet.");

      const message = new IPv4Message(this.payload, this.mac_src, this.mac_dst, this.net_src, this.net_dst);
      message.ttl = this.ttl;
      message.identification = this.id;
      message.protocol = this.protocol;
      message.header_checksum = message.checksum();

      return [message];
    }
  }
}

export class IPv4Protocol implements NetworkListener {

  private iface: NetworkInterface;

  constructor(iface: NetworkInterface) {
    this.iface = iface;

    iface.addListener(this);
  }

  receivePacket(message: NetworkMessage, from: Interface): ActionHandle {
    console.log(message);

    if( message instanceof IPv4Message ) {
      console.log("IPv4: " + message.payload);

      return ActionHandle.Handled;
    }

    return ActionHandle.Continue;
  }

}
