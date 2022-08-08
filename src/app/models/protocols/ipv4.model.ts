import { SchedulerService } from "src/app/services/scheduler.service";
import { IPAddress } from "../address.model";
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
    reserved: false,
    dont_fragment: false,
    more_fragments: false
  };
  public fragment_offset: number = 0;

  public ttl: number = 0;
  public protocol: number = 0;
  public header_checksum: number = 0;



  protected constructor(payload: Payload|string,
    net_src: IPAddress, net_dst: IPAddress|null) {
    super(payload, net_src, net_dst);
  }

  override get length(): number {
    return super.length + 16 + this.payload.length;
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
    sum = Math.imul(31, sum) + (this.identification + (this.flags.reserved ? 1: 0) + (this.flags.dont_fragment ? 1 : 0) + (this.flags.more_fragments ? 1 : 0) + this.fragment_offset);
    sum = Math.imul(31, sum) + (this.ttl + this.protocol); // do not include "checksum" header in the checksum

    return sum;
  }

  public IsFragmented(): boolean {
    if( this.fragment_offset === 0 && this.flags.more_fragments === false )
      return false;
    return true;
  }
  public IsReadyAtEndPoint(iface: NetworkInterface): boolean {
    if( this.IsFragmented() === false && this.net_dst && iface.hasNetAddress(this.net_dst) )
      return true;
    return false;
  }


  static Builder = class {
    protected payload: Payload|string = "";
    protected net_src: IPAddress|null = null;
    protected net_dst: IPAddress|null = null;
    protected ttl: number = 30;
    protected id: number;
    protected protocol: number = 0;
    protected service: number = 0;
    protected max_size: number = 65535;

    constructor() {
      this.id = Math.floor(Math.random() * 65535);
    }

    public setNetSource(addr: IPAddress): this {
      this.net_src = addr;
      return this;
    }
    public setNetDestination(addr: IPAddress): this {
      this.net_dst = addr;
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
      if( size < 1 )
        throw new Error("Minimum size is 1");

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
    public setservice(service: number): this {
      this.service = service;
      return this;
    }

    public build(): IPv4Message[] {
      if( this.net_src === null )
        throw new Error("Source address is not set");
      if( this.net_dst === null )
        throw new Error("Destination address is not set");

      const messages = [];

      let fragment = 0;
      do {

        // payload doesn't support splicing.
        // so we put the payload on the first message, the others are left empty
        let payload: string|Payload = "";
        if( fragment === 0 )
          payload = this.payload;

        const message = new IPv4Message( payload, this.net_src, this.net_dst );

        message.ttl = this.ttl;
        message.identification = this.id;
        message.protocol = this.protocol;
        message.header_checksum = message.checksum();
        message.fragment_offset = fragment;
        message.total_length = Math.min(this.max_size, this.payload.length - fragment);
        message.TOS = this.service;

        if( fragment + this.max_size < this.payload.length )
          message.flags.more_fragments = true;

        messages.push(message);
        fragment += this.max_size;
      } while( fragment < this.payload.length )

      return messages;
    }
  }
}

export class IPv4Protocol implements NetworkListener {

  private queue: Map<string, {message: IPv4Message[], lastReceive: number}>;
  private iface: NetworkInterface;

  constructor(iface: NetworkInterface) {
    this.iface = iface;
    this.queue = new Map();

    iface.addListener(this);
    SchedulerService.Instance.repeat(10).subscribe(() => {
      this.cleanQueue();
    });
  }

  receivePacket(message: NetworkMessage, from: Interface): ActionHandle {
    if( message instanceof IPv4Message ) {

      // this packet was not fragmented
      if( message.IsFragmented() === false ) {
        return ActionHandle.Continue;
      }

      // this packet is fragmented, but we are not the receiver.
      if( message.net_dst && this.iface.hasNetAddress(message.net_dst) === false ) {
        return ActionHandle.Continue;
      }

      // this packet is fragmented, and we are the receiver, we need to buffer it.
      const time = SchedulerService.Instance.getDeltaTime();
      const key = this.generateUniqueKey(message);

      const entry = this.queue.get(key);
      if( !entry ) {
        this.queue.set(key, {message: [message], lastReceive: time});
        return ActionHandle.Stop;
      }
      else {
        entry.message.push(message);
        entry.lastReceive = time;
        this.queue.set(key, entry);

        entry.message.sort( (a, b) => a.fragment_offset - b.fragment_offset );

        let total_recevied_length = entry.message.reduce( (sum, i) => sum + i.total_length, 0 );

        let first_packet = entry.message[0];
        let last_packet = entry.message[entry.message.length - 1];
        let total_size = last_packet.fragment_offset + last_packet.total_length;


        if( last_packet.flags.more_fragments === false && total_recevied_length >= total_size ) {
          this.queue.delete(key);

          const msg = new IPv4Message.Builder()
            .setPayload(first_packet.payload)
            .setNetSource(message.net_src as IPAddress)
            .setNetDestination(message.net_dst as IPAddress)
            .setTTL(message.ttl)
            .setIdentification(message.identification)
            .setProtocol(message.protocol)
            .setMaximumSize(total_recevied_length)
            .build();

          if( msg.length != 1 )
            throw new Error("Invalid message length");

          this.iface.receivePacket(msg[0]);

          return ActionHandle.Stop;
        }


        return ActionHandle.Handled;
      }

      return ActionHandle.Handled;
    }

    return ActionHandle.Continue;
  }

  private cleanQueue() {
    const cleanDelay = SchedulerService.Instance.getDelay(60 * 5);

    this.queue.forEach( (value, key) => {
      const timeSinceLastSeen = SchedulerService.Instance.getDeltaTime() - value.lastReceive;

      if( timeSinceLastSeen > cleanDelay )
        this.queue.delete(key);
    } );
  }

  private generateUniqueKey(message: IPv4Message): string {
    return `${message.net_src.toString()}_${message.identification}`;
  }

}
