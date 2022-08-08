import { map, Observable, race, Subject, tap } from "rxjs";
import { SchedulerService } from "src/app/services/scheduler.service";
import { IPAddress } from "../address.model";
import { Interface } from "../layers/datalink.model";
import { NetworkInterface } from "../layers/network.model";
import { NetworkMessage, Payload } from "../message.model";
import { IPv4Message } from "./ipv4.model";
import { ActionHandle, NetworkListener } from "./protocols.model";

export enum ICMPType {
  EchoReply = 0,
  DestinationUnreachable = 3,
  EchoRequest = 8,
  TimeExceeded = 11,
}

export class ICMPMessage extends IPv4Message {
  public type: ICMPType = ICMPType.EchoRequest;
  public code: number = 0;

  protected constructor(payload: Payload|string,
    src: IPAddress, dst: IPAddress,
    type: ICMPType, code: number) {
    super(payload, src, dst);
    this.type = type;
    this.code = code;
  }

  override get length(): number {
    return 4;
  }

  override toString(): string {
    switch(this.type) {
      case ICMPType.EchoReply:
        return "ICMP\nReply";
      case ICMPType.EchoRequest:
        return "ICMP\nRequest";
    }
    return "ICMP";
  }

  public override checksum(): number {
    let sum = 0;

    sum = Math.imul(31, sum) + (this.type + this.code);

    return sum;
  }


  static override Builder = class extends (IPv4Message.Builder) {
    public type: ICMPType = ICMPType.EchoReply;
    public code: number = 0;

    public setType(type: ICMPType): this {
      this.type = type;
      this.code = 0;
      return this;
    }
    public setCode(code: number): this {
      let validCode = [];

      switch(this.type) {
        case ICMPType.EchoReply:
          validCode = [0];
          break;
        case ICMPType.EchoRequest:
          validCode = [0];
          break;
        case ICMPType.DestinationUnreachable:
          validCode = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
          break;
        case ICMPType.TimeExceeded:
          validCode = [0, 1];
          break;
        default:
          throw new Error("Invalid ICMP type");
      }

      if(validCode.indexOf(code) == -1)
        throw new Error("Invalid ICMP code for the given type");

      this.code = code;
      return this;
    }

    public override build(): IPv4Message[] {
      if( this.net_src === null )
        throw new Error("No source address specified");
      if( this.net_dst === null )
        throw new Error("No destination address specified");

      let message = new ICMPMessage(this.payload, this.net_src, this.net_dst, this.type, this.code);
      message.header_checksum = message.checksum();
      message.protocol = 1;
      message.TOS = 0;

      return [message];
    }


  };
}

export class ICMPProtocol implements NetworkListener {
  private iface: NetworkInterface;

  private queue: Map<number, Subject<IPv4Message>>;

  constructor(iface: NetworkInterface) {
    this.iface = iface;
    iface.addListener(this);

    this.queue = new Map<number, Subject<IPv4Message>>();
  }

  public sendIcmpRequest(destination: IPAddress, timeout: number=20): Observable<IPv4Message|null> {
    const request = new ICMPMessage.Builder()
      .setType(ICMPType.EchoRequest)
      .setCode(0)
      .setNetSource(this.iface.getNetAddress() as IPAddress)
      .setNetDestination(destination)
      .build()[0];

    const subject = new Subject<IPv4Message>();

    this.queue.set(request.identification, subject);
    this.iface.sendPacket(request);

    let timeout$ = SchedulerService.Instance.once(timeout).pipe(map(() => null));
    return race(subject, timeout$).pipe(
      tap(() => this.queue.delete(request.identification))
    )
  }

  receivePacket(message: NetworkMessage, from: Interface): ActionHandle {

    if( message instanceof ICMPMessage && message.IsReadyAtEndPoint(this.iface) ) {

      if( message.type === ICMPType.EchoRequest ) {
        const reply = new ICMPMessage.Builder()
          .setType(ICMPType.EchoReply)
          .setCode(0)
          .setNetSource(message.net_dst as IPAddress)
          .setNetDestination(message.net_src as IPAddress)
          .setIdentification(message.identification)
          .build()[0];

        this.iface.sendPacket(reply);

        return ActionHandle.Handled;
      }

      if( message.type === ICMPType.EchoReply ) {
        if( this.queue.has(message.identification) ) {
          this.queue.get(message.identification)?.next(message);
          return ActionHandle.Handled;
        }
      }

    }

    return ActionHandle.Continue;
  }
}
