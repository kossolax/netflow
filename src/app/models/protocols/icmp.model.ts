import { IPAddress } from "../address.model";
import { Interface } from "../layers/datalink.model";
import { NetworkInterface } from "../layers/network.model";
import { Message, NetworkMessage, Payload } from "../message.model";
import { IPv4Message } from "./ipv4.model";
import { ActionHandle, NetworkListener } from "./protocols.model";

export enum ICMPType {
  EchoReply = 0,
  DestinationUnreachable = 3,
  EchoRequest = 8,
  TimeExceeded = 11,
}

export class ICMPMessage extends Message {
  public type: ICMPType = ICMPType.EchoRequest;
  public code: number = 0;
  public header_checksum: number = 0;

  protected constructor(payload: Payload|string, type: ICMPType, code: number) {
    super(payload);
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

  public checksum(): number {
    let sum = 0;

    sum = Math.imul(31, sum) + (this.type + this.code);

    return sum;
  }


  static Builder = class extends (IPv4Message.Builder) {
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
      let message = new ICMPMessage(this.payload, this.type, this.code);
      message.header_checksum = message.checksum();

      this.setPayload(message);
      this.setProtocol(1);
      this.setservice(0);

      const IP = super.build();

      if( IP.length !== 1 )
        throw new Error("Invalid IP header length");

      return IP;
    }


  };
}

export class ICMPProtocol implements NetworkListener {
  private iface: NetworkInterface;

  constructor(iface: NetworkInterface) {
    this.iface = iface;
    iface.addListener(this);
  }

  receivePacket(message: NetworkMessage, from: Interface): ActionHandle {

    if( message instanceof IPv4Message && message.IsReadyAtEndPoint(this.iface) ) {
      const icmp = message.payload as ICMPMessage;

      if( icmp.type === ICMPType.EchoRequest ) {
        const reply = new ICMPMessage.Builder()
          .setType(ICMPType.EchoReply)
          .setCode(0)
          .setMacSource((from as NetworkInterface).getMacAddress())
          .setNetSource(message.net_dst as IPAddress)
          .setNetDestination(message.net_src as IPAddress)
          .setIdentification(message.identification)
          .build()[0];

        this.iface.sendPacket(reply);

        return ActionHandle.Handled;
      }

    }

    return ActionHandle.Continue;
  }
}
