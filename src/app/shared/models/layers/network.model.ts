import { HardwareAddress, NetworkAddress } from "../address.model";
import { DatalinkMessage, NetworkMessage } from "../message.model";
import { GenericNode } from "../node.model";
import { ArpProtocol } from "../protocols/arp.model";
import { DatalinkListener, NetworkListener } from "../protocols/protocols.model";
import { HardwareInterface, Interface } from "./datalink.model";


export abstract class NetworkInterface extends Interface implements DatalinkListener, NetworkListener {
  private addresses: NetworkAddress[] = [];
  private datalink: HardwareInterface;
  private discovery: ArpProtocol;

  constructor(node: GenericNode, name: string, datalink: HardwareInterface) {
    super(node, name);
    this.datalink = datalink;
    this.datalink.addListener(this);
    this.discovery = new ArpProtocol(this, datalink);
  }

  hasNetAddress(ip: NetworkAddress): boolean {
    if( ip.isBroadcast )
      return true;

    return this.addresses.filter( i => i.equals(ip) ).length > 0;
  }
  addNetAddress(ip: NetworkAddress): void {
    if( this.hasNetAddress(ip) )
      throw new Error("IP address already added");
    this.addresses.push(ip);
  }
  getNetAddress(): NetworkAddress {
    return this.addresses[0];
  }
  getMacAddress(): HardwareAddress {
    return this.datalink.getMacAddress();
  }
  getInterface(index: number): HardwareInterface {
    return this.datalink;
  }
  override up(): void {
    super.up();
    this.datalink.up();
  }
  override down(): void {
    super.down();
    this.datalink.down();
  }

  receiveTrame(message: DatalinkMessage): void {
    if( message.mac_dst?.equals(this.datalink.getMacAddress()) && message.mac_dst?.isBroadcast == false ) {
      this.receivePacket(message as NetworkMessage);
      return;
    }
  }

  receivePacket(message: NetworkMessage) {
    if( !this.isActive() )
      return; // TODO: Throw error
//      throw new Error("Interface is down");

    this.getListener.map( i => {
      if( i != this && "receivePacket" in i)
        (i as NetworkListener).receivePacket(message, this);
    });

    //throw new Error("IP forwarding is not implemented on NetworkInterface");
  }

  sendTrame(message: DatalinkMessage) {
    this.datalink.sendTrame(message);
  }
  sendPacket(message: NetworkMessage) {
    if( !this.isActive() )
      throw new Error("Interface is down");


    const loopback = this.addresses.filter( i => i.equals(message.net_dst) );
    if( loopback.length > 0 ) {
      message.mac_dst = this.getMacAddress();
      this.receivePacket(message);
      return;
    }

    if( message.mac_dst === null && message.net_dst !== null ) {
      message.mac_dst = this.discovery.getMapping(message.net_dst) || null;

      if( message.mac_dst === null ) {
        this.discovery.enqueueRequest(message);
        return;
      }
    }

    this.datalink.sendTrame(message);
  }

}


export class IPInterface extends NetworkInterface {
  constructor(node: GenericNode, name: string, datalink: HardwareInterface) {
    super(node, "ethip", datalink);
  }
}

