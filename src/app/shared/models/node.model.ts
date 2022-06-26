import { Observable, Subject } from "rxjs";
import { Address, MacAddress, IPAddress } from "./address.model";
import { EthernetInterface, HardwareInterface, Interface } from "./layers/datalink.model";
import { IPInterface, NetworkInterface } from "./layers/network.model";
import { DatalinkMessage, Message, NetworkMessage } from "./message.model";
import { DatalinkListener, NetworkListener } from "./protocols/protocols.model";

export abstract class GenericNode {
  public name: string = "Node";
  toString(): string {
    return this.name;
  }
}
export abstract class Node<T> extends GenericNode {
  protected interfaces: T[] = [];

  abstract addInterface(iface: T): T;

  getInterface(index: number): T {
    return this.interfaces[index];
  }

  abstract send(message: string, dst: Address): void;
}

export class Host extends Node<HardwareInterface> implements DatalinkListener {
  public receiveTrame$: Subject<DatalinkMessage> = new Subject<DatalinkMessage>();

  addInterface(): HardwareInterface {
    const mac = new MacAddress();

    const iface = new EthernetInterface(this, mac, this.interfaces.length.toString());
    iface.addListener(this);
    this.interfaces.push(iface);

    return iface;
  }

  send(message: string, dst: MacAddress): void {
    const src = this.getInterface(0).getMacAddress();

    const msg = new DatalinkMessage(
      message,
      src, dst
    );

    this.interfaces.map( i => i.sendTrame(msg) );
  }

  receiveTrame(message: DatalinkMessage, from: Interface): void {
    this.interfaces.map( i => {
      if( i != from )
        i.sendTrame(message as DatalinkMessage);
    });

    this.receiveTrame$.next(message);
  }

}
export class IPHost extends Node<NetworkInterface> implements NetworkListener {
  public receivePacket$: Subject<NetworkMessage> = new Subject<NetworkMessage>();

  addInterface(): NetworkInterface {
    const ip = new IPAddress();
    const mac = new MacAddress();

    const eth = new EthernetInterface(this, mac);
    const iface = new IPInterface(this, this.interfaces.length.toString(), eth);
    iface.addNetAddress(ip);
    iface.addListener(this);

    this.interfaces.push(iface);

    return iface;
  }

  send(message: string, net_dst: IPAddress): void {
    const mac_src = this.getInterface(0).getMacAddress();
    const net_src = this.getInterface(0).getNetAddress();

    const msg = new NetworkMessage(
      message,
      mac_src, null,
      net_src, net_dst
    );

    this.interfaces.map( i => i.sendPacket(msg));
  }

  receivePacket(message: NetworkMessage, from: Interface): void {
    this.receivePacket$.next(message);
  }
}
