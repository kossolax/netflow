import { Observable, Subject } from "rxjs";
import { Address, MacAddress, IPAddress } from "./address.model";
import { EthernetInterface, HardwareInterface, Interface } from "./layers/datalink.model";
import { IPInterface, NetworkInterface } from "./layers/network.model";
import { DatalinkMessage, Message, NetworkMessage } from "./message.model";
import { DatalinkListener, NetworkListener } from "./protocols/protocols.model";

export abstract class GenericNode {
  public guid: string = Math.random().toString(36).substring(2, 9);
  public name: string = "Node";
  public type: string = "unknown";
  public x: number = 0;
  public y: number = 0;

  toString(): string {
    return this.name;
  }
  abstract clone(): GenericNode;
  protected cloneInto(node: GenericNode): void {
    node.guid = Math.random().toString(36).substring(2, 9);
    node.name = this.name;
    node.type = this.type;
    node.x = this.x;
    node.y = this.y;
  }

}
export abstract class Node<T extends Interface> extends GenericNode {
  protected interfaces: { [key: string]: T } = {};

  abstract addInterface(name: string): T;
  getInterface(index: string|number): T {
    let response;
    if( typeof index === "number" )
      response = this.interfaces[Object.keys(this.interfaces)[index]]
    else if( typeof index === "string" )
      response =  this.interfaces[index];
    else
      throw new Error(`Invalid index type: ${typeof index}`);

    if( !response )
      throw new Error(`Interface ${index} not found, available interfaces: ${Object.keys(this.interfaces)}`);

    return response;
  }
  getInterfaces(): string[] {
    return Object.keys(this.interfaces);
  }
  getFirstAvailableInterface(): T {
    for(let key in this.interfaces) {
      console.log(this.name, key, this.interfaces[key].isConnected());
      if( !this.interfaces[key].isConnected() ) {
        return this.interfaces[key];
      }
    }

    throw new Error("No available interfaces");
  }

  protected override cloneInto(node: Node<T>): void {
    super.cloneInto(node);
    for(let key in this.interfaces)
      node.addInterface(key);
  }

  abstract send(message: string, dst: Address): void;
}

export class SwitchHost extends Node<HardwareInterface> implements DatalinkListener {
  public override name = "Switch";
  public override type = "switch";
  public receiveTrame$: Subject<DatalinkMessage> = new Subject<DatalinkMessage>();

  constructor(name: string="", iface: number=0) {
    super();
    if( name != "" )
      this.name = name;

    for(let i=0; i<iface; i++)
      this.addInterface();
  }

  addInterface(name: string = ""): HardwareInterface {
    const mac = new MacAddress();

    if( name == "" )
      name = "GigabitEthernet0/" + Object.keys(this.interfaces).length;

    const iface = new EthernetInterface(this, mac, name);
    iface.addListener(this);
    this.interfaces[name] = iface;

    return iface;
  }

  clone(): SwitchHost {
    const clone = new SwitchHost();
    this.cloneInto(clone);
    return clone;
  }

  send(message: string, dst: MacAddress): void {
    const src = this.getInterface(0).getMacAddress();

    const msg = new DatalinkMessage(
      message,
      src, dst
    );

    for( const name in this.interfaces ) {
      this.interfaces[name].sendTrame(msg);
    }

  }

  // TODO: Make this private.
  receiveTrame(message: DatalinkMessage, from: Interface): void {

    for( const name in this.interfaces ) {
      if( this.interfaces[name] !== from )
        this.interfaces[name].sendTrame(message);
    }

    this.receiveTrame$.next(message);
  }

}
export class RouterHost extends Node<NetworkInterface> implements NetworkListener {
  public override name = "Router";
  public override type = "router";

  public receivePacket$: Subject<NetworkMessage> = new Subject<NetworkMessage>();

  constructor(name: string="", iface: number=0) {
    super();
    if( name != "" )
      this.name = name;

    for(let i=0; i<iface; i++)
      this.addInterface();
  }

  clone(): RouterHost {
    const clone = new RouterHost();
    this.cloneInto(clone);
    return clone;
  }

  addInterface(name: string = ""): NetworkInterface {
    if( name == "" )
      name = "GigabitEthernet0/" + Object.keys(this.interfaces).length;

    const ip = new IPAddress();
    const mac = new MacAddress();

    const eth = new EthernetInterface(this, mac);
    const iface = new IPInterface(this, name, eth);
    iface.addNetAddress(ip);
    iface.addListener(this);

    this.interfaces[name] = iface;

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

    for( const name in this.interfaces ) {
      this.interfaces[name].sendPacket(msg);
    }
  }

  receivePacket(message: NetworkMessage, from: Interface): void {
    this.receivePacket$.next(message);
  }
}
export class ServerHost extends RouterHost {
  public override name = "Server";
  public override type = "server";

  constructor(name: string = "", type: string = "", iface: number=1) {
    super();
    if( name != "" )
      this.name = name;
    if( type != "" )
      this.type = type;

    for(let i=0; i<iface; i++)
      this.addInterface();
  }
}
