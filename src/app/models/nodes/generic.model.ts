import { Address, IPAddress, MacAddress, NetworkAddress } from "../address.model";
import { EthernetInterface, Interface } from "../layers/datalink.model";
import { IPInterface, NetworkInterface } from "../layers/network.model";
import { NetworkMessage } from "../message.model";
import { GenericEventListener, handleChain } from "../protocols/protocols.model";

export abstract class GenericNode {
  public guid: string = Math.random().toString(36).substring(2, 9);
  public name: string = "Node";
  public type: string = "unknown";
  public x: number = 0;
  public y: number = 0;

  public toString(): string {
    return this.name;
  }
  public abstract clone(): GenericNode;
  protected cloneInto(node: GenericNode): void {
    node.guid = Math.random().toString(36).substring(2, 9);
    node.name = this.name;
    node.type = this.type;
    node.x = this.x;
    node.y = this.y;
  }



  // ---
  private listener: GenericEventListener[] = [];
  public addListener(listener: GenericEventListener): void {
    this.removeListener(listener);
    this.listener.push(listener);
  }
  public removeListener(listener: GenericEventListener): void {
    this.listener = this.listener.filter( (l) => l != listener );
  }
  get getListener(): GenericEventListener[] {
    return this.listener;
  }

}
export abstract class Node<T extends Interface> extends GenericNode {
  protected interfaces: Record<string, T> = {};

  public abstract addInterface(name: string): T;
  public getInterface(index: string|number): T {
    let response;
    if( typeof index === "number" )
      response = this.interfaces[Object.keys(this.interfaces)[index]]
    else if( typeof index === "string" )
      response =  this.interfaces[index];

    if( !response )
      throw new Error(`Interface ${index} not found, available interfaces: ${Object.keys(this.interfaces)}`);

    return response;
  }
  public getInterfaces(): string[] {
    return Object.keys(this.interfaces);
  }
  public getFirstAvailableInterface(): T {
    for(let key in this.interfaces) {
      if( !this.interfaces[key].isConnected )
        return this.interfaces[key];
    }

    throw new Error("No available interfaces");
  }

  protected override cloneInto(node: Node<T>): void {
    super.cloneInto(node);
    for(let key in this.interfaces)
      node.addInterface(key);
  }

  public abstract send(message: string, dst?: Address): void;
}

export abstract class NetworkHost extends Node<NetworkInterface> {

  public addInterface(name: string = ""): NetworkInterface {
    if( name == "" )
      name = "gig0/" + Object.keys(this.interfaces).length;

    const ip = IPAddress.generateAddress();
    const mac = MacAddress.generateAddress();

    const eth = new EthernetInterface(this, mac, name, 10, 1000, true);
    const iface = new IPInterface(this, name, eth);
    iface.addNetAddress(ip);
    iface.addListener(this);
    handleChain("on", this.getListener, "OnInterfaceAdded", iface);

    this.interfaces[name] = iface;

    return iface;
  }

  public abstract override send(message: string|NetworkMessage, net_dst?: NetworkAddress): void;
  public abstract getNextHop(address: NetworkAddress): NetworkAddress|null;
}

export abstract class L4Host extends NetworkHost {
  public override name = "Server";
  public override type = "server";

  public gateway: NetworkAddress|null = null;

  constructor(name: string = "", type: string="server", iface: number=0) {
    super();
    if( name != "" )
      this.name = name;
    if( type != "" )
      this.type = type;

    for(let i=0; i<iface; i++)
      this.addInterface();
  }


  public send(message: string|NetworkMessage, net_dst?: NetworkAddress): void {

    if( message instanceof NetworkMessage ) {
      for( const name in this.interfaces ) {
        this.interfaces[name].sendPacket(message);
      }
    }
    else {

      if( net_dst === undefined )
        throw new Error("No destination specified");

      const net_src = this.getInterface(0).getNetAddress();

      const msg = new NetworkMessage(
        message,
        net_src, net_dst
      );

      for( const name in this.interfaces ) {
        this.interfaces[name].sendPacket(msg);
      }
    }
  }

  public getNextHop(address: NetworkAddress): NetworkAddress|null {


    for(let name in this.interfaces) {
      if( this.interfaces[name].getNetAddress().InSameNetwork(this.interfaces[name].getNetMask(), address) )
        return address;
    }

    return this.gateway;
  }
}
