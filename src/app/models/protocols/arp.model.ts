import { SchedulerService } from "src/app/services/scheduler.service";
import { HardwareAddress, MacAddress, NetworkAddress } from "../address.model";
import { HardwareInterface } from "../layers/datalink.model";
import { NetworkInterface } from "../layers/network.model";
import { DatalinkMessage, NetworkMessage, Payload } from "../message.model";
import { ActionHandle, DatalinkListener } from "./protocols.model";

export class ArpMessage implements Payload {
  type: "request"|"reply";
  request: NetworkAddress;
  response?: HardwareAddress|null;

  private constructor(type: "request"|"reply", request: NetworkAddress) {
    this.type = type;
    this.request = request;
  }

  get length(): number {
    return this.request.length * 2 + 1;
  }
  toString(): string {
    return "ARP" + this.type;
  }

  static Builder = class {
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


    build(): ArpMessage {
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
  private table: Map<NetworkAddress, {address: HardwareAddress, lastSeen: number}>;
  private queue: Map<NetworkAddress, NetworkMessage[]>;
  private interface: NetworkInterface;

  constructor(netface: NetworkInterface, hardface: HardwareInterface) {
    this.table = new Map<NetworkAddress, {address: HardwareAddress, lastSeen: number}>();
    this.queue = new Map<NetworkAddress, NetworkMessage[]>();
    this.interface = netface;
    hardface.addListener(this);

    SchedulerService.Instance.repeat(10).subscribe(() => {
      this.cleanARPTable();
    });
  }

  getMapping(addr: NetworkAddress): HardwareAddress|undefined {
    return this.table.get(addr)?.address;
  }

  enqueueRequest(message: NetworkMessage): void {
    const addr = message.net_dst as NetworkAddress;

    if( this.queue.has(addr) ) {
      this.queue.get(addr)?.push(message);
    }
    else {
      this.queue.set(addr, [message]);
      this.sendArpRequest(addr);
    }
  }
  sendArpRequest(addr: NetworkAddress): void {
    const arp = new ArpMessage.Builder()
      .SetNetworkAddress(addr)
      .build();

    const message: DatalinkMessage = new DatalinkMessage(arp, this.interface.getMacAddress(), MacAddress.generateBroadcast());
    this.interface.getInterface(0).sendTrame(message);
  }

  receiveTrame(message: DatalinkMessage): ActionHandle {
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
        this.table.set(arp.request, {address: arp.response, lastSeen: SchedulerService.Instance.getDeltaTime()});

        if( this.queue.has(arp.request) ) {
          this.queue.get(arp.request)?.map( i => {

            const message = new DatalinkMessage(i, this.interface.getMacAddress(), arp.response!);
            this.interface.sendTrame(message);
          });
          this.queue.delete(arp.request);
        }
      }

      return ActionHandle.Handled;
    }

    return ActionHandle.Continue;
  }

  private cleanARPTable() {
    const cleanDelay = SchedulerService.Instance.getDelay(60 * 5);

    this.table.forEach( (value, key) => {
      const timeSinceLastSeen = SchedulerService.Instance.getDeltaTime() - value.lastSeen;

      if( timeSinceLastSeen > cleanDelay )
        this.table.delete(key);
    } );
  }

}

