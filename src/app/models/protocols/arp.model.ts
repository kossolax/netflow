import { SchedulerService } from "src/app/services/scheduler.service";
import { HardwareAddress, MacAddress, NetworkAddress } from "../address.model";
import { HardwareInterface } from "../layers/datalink.model";
import { NetworkInterface } from "../layers/network.model";
import { DatalinkMessage, NetworkMessage, Payload } from "../message.model";
import { ActionHandle, DatalinkListener } from "./protocols.model";

export class ArpMessage implements Payload {
  public type: "request"|"reply";
  public request: NetworkAddress;
  public response?: HardwareAddress|null;

  private constructor(type: "request"|"reply", request: NetworkAddress) {
    this.type = type;
    this.request = request;
  }

  get length(): number {
    return this.request.length * 2 + 1;
  }
  public toString(): string {
    return "ARP" + this.type;
  }

  public static Builder = class {
    private type: "request"|"reply" = "request";
    private net: NetworkAddress|null = null;
    private mac: HardwareAddress|null = null;

    public SetNetworkAddress(net: NetworkAddress): this {
      this.type = "request";
      this.net = net;
      return this;
    }
    public SetHardwareAddress(net: HardwareAddress): this {
      this.type = "reply";
      this.mac = net;
      return this;
    }


    public build(): ArpMessage {
      if( this.net === null )
        throw new Error("No request data specified");

      const message = new ArpMessage(this.type, this.net);

      if( this.type === "reply" )
        message.response = this.mac;
      return message;
    }
  }
}

export class ArpProtocol implements DatalinkListener {
  private table: Map<string, {address: HardwareAddress, lastSeen: number}> = new Map<string, {address: HardwareAddress, lastSeen: number}>()
  private queue: Map<string, NetworkMessage[]> = new Map<string, NetworkMessage[]>();
  private interface: NetworkInterface;

  constructor(netface: NetworkInterface, hardface: HardwareInterface) {
    this.interface = netface;
    hardface.addListener(this);

    SchedulerService.Instance.repeat(10).subscribe(() => {
      this.cleanARPTable();
    });
  }

  public getMapping(addr: NetworkAddress): HardwareAddress|undefined {
    return this.table.get(addr.toString())?.address;
  }

  public enqueueRequest(message: NetworkMessage, nextHop: NetworkAddress): void {
    //const addr = message.net_dst as NetworkAddress;

    if( nextHop.isBroadcast ) {
      this.sendTrame(message, MacAddress.generateBroadcast());
    }
    else if( this.table.has(nextHop.toString()) ) {
      this.sendTrame(message, this.table.get(nextHop.toString())?.address!);
    }
    else if( this.queue.has(nextHop.toString()) ) {
      this.queue.get(nextHop.toString())?.push(message);
    }
    else {
      this.queue.set(nextHop.toString(), [message]);
      this.sendArpRequest(nextHop);
    }
  }
  private sendArpRequest(addr: NetworkAddress): void {
    const arp = new ArpMessage.Builder()
      .SetNetworkAddress(addr)
      .build();

    const message: DatalinkMessage = new DatalinkMessage(arp, this.interface.getMacAddress(), MacAddress.generateBroadcast());
    this.interface.getInterface(0).sendTrame(message);
  }

  public receiveTrame(message: DatalinkMessage): ActionHandle {
    if( message.payload instanceof ArpMessage ) {
      const arp = message.payload as ArpMessage;

      if( arp.type == "request" && this.interface.hasNetAddress(arp.request) ) {
        const reply = new ArpMessage.Builder()
          .SetNetworkAddress(arp.request)
          .SetHardwareAddress(this.interface.getMacAddress())
          .build();

        const replyMessage: DatalinkMessage = new DatalinkMessage(reply, this.interface.getMacAddress(), message.mac_src);

        this.interface.getInterface(0).sendTrame(replyMessage);
      }
      else if( arp.type == "reply" && arp.response != null ) {
        this.table.set(arp.request.toString(), {address: arp.response, lastSeen: SchedulerService.Instance.getDeltaTime()});

        if( this.queue.has(arp.request.toString()) ) {
          this.queue.get(arp.request.toString())?.map( i => {
            this.sendTrame(i, arp.response!);
          });
          this.queue.delete(arp.request.toString());
        }
      }

      return ActionHandle.Handled;
    }

    return ActionHandle.Continue;
  }

  private sendTrame(message: NetworkMessage, mac: HardwareAddress): void {
    const trame = new DatalinkMessage(message, this.interface.getMacAddress(), mac!);
    this.interface.sendTrame(trame);
  }

  private cleanARPTable(): void {
    const cleanDelay = SchedulerService.Instance.getDelay(60 * 5);

    this.table.forEach( (value, key) => {
      const timeSinceLastSeen = SchedulerService.Instance.getDeltaTime() - value.lastSeen;

      if( timeSinceLastSeen > cleanDelay )
        this.table.delete(key);
    } );
  }

}

