import { SchedulerService } from "src/app/services/scheduler.service";
import { HardwareAddress, MacAddress, NetworkAddress } from "../address.model";
import { HardwareInterface } from "../layers/datalink.model";
import { NetworkInterface } from "../layers/network.model";
import { DatalinkMessage, NetworkMessage, Payload } from "../message.model";
import { DatalinkListener } from "./protocols.model";

export class ArpMessage implements Payload {
  type: "request"|"reply";
  request: NetworkAddress;
  response?: HardwareAddress|null;

  constructor(type: "request"|"reply", request: NetworkAddress) {
    this.type = type;
    this.request = request;
  }

  get length(): number {
    return this.request.length * 2 + 1;
  }
  toString(): string {
    return "ARP" + this.type;
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

    if( this.queue.has(addr) )
      this.queue.get(addr)?.push(message);
    else
      this.queue.set(addr, [message]);

    this.sendArpRequest(addr);
  }
  sendArpRequest(addr: NetworkAddress): void {
    const arp = new ArpMessage("request", addr);

    const message: DatalinkMessage = new DatalinkMessage(arp, this.interface.getMacAddress(), MacAddress.generateBroadcast());
    this.interface.getInterface(0).sendTrame(message);
  }

  receiveTrame(message: DatalinkMessage): void {
    if( message.payload instanceof ArpMessage ) {
      const arp = message.payload as ArpMessage;

      if( arp.type == "request" && this.interface.hasNetAddress(arp.request) ) {
        const reply = new ArpMessage("reply", arp.request);
        reply.response = this.interface.getMacAddress();

        const replyMessage: DatalinkMessage = new DatalinkMessage(reply, this.interface.getMacAddress(), message.mac_src);

        this.interface.getInterface(0).sendTrame(replyMessage);
      }
      else if( arp.type == "reply" && arp.response != null ) {
        this.table.set(arp.request, {address: arp.response, lastSeen: SchedulerService.Instance.getDeltaTime()});

        if( this.queue.has(arp.request) ) {
          this.queue.get(arp.request)?.map( i => {
            i.mac_dst = arp.response as HardwareAddress;
            this.interface.sendPacket(i);
          });
          this.queue.delete(arp.request);
        }
      }
    }
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

