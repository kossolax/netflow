import { HardwareAddress, NetworkAddress } from "../address.model";
import { DatalinkMessage, NetworkMessage } from "../message.model";
import { GenericNode } from "../node.model";
import { ArpProtocol } from "../protocols/arp.model";
import { IPv4Protocol } from "../protocols/ip.model";
import { ActionHandle, DatalinkListener, handleChain, NetworkListener, NetworkSender } from "../protocols/protocols.model";
import { HardwareInterface, Interface } from "./datalink.model";


export abstract class NetworkInterface extends Interface implements DatalinkListener, NetworkListener, NetworkSender {
  private addresses: {addr: NetworkAddress, mask: NetworkAddress}[] = [];
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

    return this.addresses.filter( i => i.addr.equals(ip) ).length > 0;
  }
  addNetAddress(ip: NetworkAddress): void {
    if( this.hasNetAddress(ip) )
      throw new Error("IP address already added");

    this.addresses.push({
      addr: ip,
      mask: ip.generateMask()
    });
  }
  getNetAddress(index: number=0): NetworkAddress {
    return this.addresses[index].addr;
  }
  getNetMask(index: number=0): NetworkAddress {
    return this.addresses[index].mask;
  }
  setNetAddress(addr: NetworkAddress, index: number=0) {
    if( addr.IsMask )
      throw new Error("Invalid netmask");

    this.addresses[index].addr = addr;
    this.addresses[index].mask = addr.generateMask();
  }
  setNetMask(addr: NetworkAddress, index: number=0) {
    if( !addr.IsMask )
      throw new Error("Invalid netmask");
    this.addresses[index].mask = addr;
  }

  getMacAddress(): HardwareAddress {
    return this.datalink.getMacAddress();
  }
  setMacAddress(addr: HardwareAddress) {
    return this.datalink.setMacAddress(addr);
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
  override isConnected(): boolean {
    return this.datalink.isConnected();
  }
  override get Speed(): number {
    return this.datalink.Speed;
  }
  override set Speed(speed: number) {
    this.datalink.Speed = speed;
  }

  receiveTrame(message: DatalinkMessage): ActionHandle {
    const mac_dst = message.mac_dst as HardwareAddress;

    if( mac_dst.equals(this.datalink.getMacAddress()) && mac_dst.isBroadcast == false ) {
      this.receivePacket(message as NetworkMessage);
      return ActionHandle.Handled;
    }

    return ActionHandle.Continue;
  }

  receivePacket(message: NetworkMessage): ActionHandle {
    let action = handleChain("receivePacket", this.getListener, message, this);

    if( action !== ActionHandle.Continue )
      return action;

    //throw new Error("IP forwarding is not implemented on NetworkInterface");
    return ActionHandle.Continue;
  }

  sendPacket(message: NetworkMessage) {
    if( !this.isActive() )
      throw new Error("Interface is down");


    let action = handleChain("sendPacket", this.getListener, message, this);
    if( action !== ActionHandle.Continue )
      return;

    const loopback = this.addresses.filter( i => i.addr.equals(message.net_dst) );
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

  private protocols: IPv4Protocol;

  constructor(node: GenericNode, name: string, datalink: HardwareInterface) {
    super(node, "ethip", datalink);
    this.protocols = new IPv4Protocol(this);
  }
}

