import { Observable, Subject } from "rxjs";
import { SchedulerService } from "../services/scheduler.service";
import { Address, MacAddress, IPAddress, NetworkAddress, HardwareAddress } from "./address.model";
import { Dot1QInterface, EthernetInterface, HardwareInterface, Interface } from "./layers/datalink.model";
import { IPInterface, NetworkInterface } from "./layers/network.model";
import { DatalinkMessage, Message, NetworkMessage } from "./message.model";
import { Dot1QMessage } from "./protocols/ethernet.model";
import { ActionHandle, DatalinkListener, NetworkListener } from "./protocols/protocols.model";

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
      if( !this.interfaces[key].isConnected() )
        return this.interfaces[key];
    }

    throw new Error("No available interfaces");
  }

  protected override cloneInto(node: Node<T>): void {
    super.cloneInto(node);
    for(let key in this.interfaces)
      node.addInterface(key);
  }

  abstract send(message: string, dst?: Address): void;
}

export class SwitchHost extends Node<HardwareInterface> implements DatalinkListener {
  public override name = "Switch";
  public override type = "switch";
  public receiveTrame$: Subject<DatalinkMessage> = new Subject<DatalinkMessage>();

  private ARPTable: Map<HardwareAddress, {iface: HardwareInterface, lastSeen: number}[]> = new Map<HardwareAddress, {iface: HardwareInterface, lastSeen: number}[]>();

  constructor(name: string="", iface: number=0) {
    super();
    if( name != "" )
      this.name = name;

    for(let i=0; i<iface; i++)
      this.addInterface();

    SchedulerService.Instance.repeat(10).subscribe(() => {
      this.cleanARPTable();
    });
  }

  addInterface(name: string = ""): HardwareInterface {
    const mac = MacAddress.generateAddress();

    if( name == "" )
      name = "GigabitEthernet0/" + Object.keys(this.interfaces).length;

    const iface = new Dot1QInterface(this, mac, name, 10, 1000, true);
    iface.addListener(this);
    this.interfaces[name] = iface;

    return iface;
  }

  clone(): SwitchHost {
    const clone = new SwitchHost();
    this.cloneInto(clone);
    return clone;
  }

  send(message: string|DatalinkMessage, dst?: HardwareAddress): void {

    if( message instanceof DatalinkMessage ) {
      for( const name in this.interfaces ) {
        this.interfaces[name].sendTrame(message);
      }
    }
    else {
      if( dst === undefined )
        throw new Error("Destination address is undefined");
      const src = this.getInterface(0).getMacAddress();

      const msg = new DatalinkMessage(
        message,
        src, dst
      );

      for( const name in this.interfaces ) {
        this.interfaces[name].sendTrame(msg);
      }
    }

  }

  receiveTrame(message: DatalinkMessage, from: HardwareInterface): ActionHandle {
    const src = message.mac_src as HardwareAddress;
    const dst = message.mac_dst as HardwareAddress;

    let found = false;
    this.ARPTable.get(src)?.map( i => {
      if( i.iface.getMacAddress().equals(from.getMacAddress()) ) {
        found = true;
        i.lastSeen = SchedulerService.Instance.getDeltaTime();
      }
    });

    if( !found ) {
      if( !this.ARPTable.get(src) )
        this.ARPTable.set(src, []);
      this.ARPTable.get(src)?.push({iface: from, lastSeen: SchedulerService.Instance.getDeltaTime()});
    }

    let vlan_id = 0;
    if( message instanceof Dot1QMessage )
      vlan_id = message.vlan_id;
    else
      vlan_id = (from as Dot1QInterface).Vlan[0];

    if( dst.isBroadcast || this.ARPTable.get(dst) === undefined ) {
      for( const name in this.interfaces ) {
        if( this.interfaces[name] !== from ) {
          if( (this.interfaces[name] as Dot1QInterface).Vlan.indexOf(vlan_id) !== -1 )
            this.interfaces[name].sendTrame(message);
        }
      }
    }
    else {
      this.ARPTable.get(dst)?.map( i => {
        if( i.iface !== from )
          if( (i.iface as Dot1QInterface).Vlan.indexOf(vlan_id) !== -1 )
            i.iface.sendTrame(message);
      });
    }

    this.receiveTrame$.next(message);
    return ActionHandle.Continue;
  }

  private cleanARPTable(): void {
    const cleanDelay = SchedulerService.Instance.getDelay(60 * 5);

    for( const key of this.ARPTable.keys() ) {

      let interfaces = this.ARPTable.get(key);
      if( interfaces !== undefined ) {

        let i = 0;
        while( i < interfaces.length ) {
          const timeSinceLastSeen = SchedulerService.Instance.getDeltaTime() - interfaces[i].lastSeen;

          if( timeSinceLastSeen > cleanDelay )
            interfaces.splice(i, 1);
          else {
            i++;
          }
        }

        if( interfaces.length == 0 )
          this.ARPTable.delete(key);
      }
    }
  }

}

export class RouterHost extends Node<NetworkInterface> implements NetworkListener {
  public override name = "Router";
  public override type = "router";
  private routingTable: {network: NetworkAddress, mask: NetworkAddress, gateway: NetworkAddress}[] = [];

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

    const ip = IPAddress.generateAddress();
    const mac = MacAddress.generateAddress();

    const eth = new EthernetInterface(this, mac, name, 10, 1000, true);
    const iface = new IPInterface(this, name, eth);
    iface.addNetAddress(ip);
    iface.addListener(this);

    this.interfaces[name] = iface;

    return iface;
  }

  send(message: string|NetworkMessage, net_dst?: NetworkAddress): void {

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

  receivePacket(message: NetworkMessage, from: NetworkInterface): ActionHandle {

    const dst = message.net_dst as NetworkAddress;

    if( from.hasNetAddress(dst) === false ) {

      const route = this.getNextHop(dst);

      if( route != null ) {
        for( const name in this.interfaces ) {

          const iface_ip = this.interfaces[name].getNetAddress();
          const iface_mask = this.interfaces[name].getNetMask();

          if( iface_ip.InSameNetwork(iface_mask, route) ) {
            this.interfaces[name].sendPacket(message);
          }

        }
      }

    }


    this.receivePacket$.next(message);
    return ActionHandle.Continue;
  }

  addRoute(network: NetworkAddress|string, mask: NetworkAddress|string, gateway: NetworkAddress|string): void {
    if( typeof network === "string" )
      network = new IPAddress(network);
    if( typeof mask === "string" )
      mask = new IPAddress(mask, true);
    if( typeof gateway === "string" )
      gateway = new IPAddress(gateway);

    for( let route of this.routingTable ) {
      if( route.network.equals(network) && route.mask.equals(mask) && route.gateway.equals(gateway) )
        throw new Error("Route already exists");
    }
    this.routingTable.push({network: network, mask: mask, gateway: gateway});
  }
  deleteRoute(network: NetworkAddress, mask: NetworkAddress, gateway: NetworkAddress): void {
    for( let i = 0; i < this.routingTable.length; i++ ) {
      if( this.routingTable[i].network.equals(network) && this.routingTable[i].mask.equals(mask) && this.routingTable[i].gateway.equals(gateway) ) {
        this.routingTable.splice(i, 1);
        return;
      }
    }
    throw new Error("Route not found");
  }
  getNextHop(address: NetworkAddress|null): NetworkAddress|null {
    if( address === null )
      throw new Error("No address specified");

    let bestRoute = null;
    let bestCidr = 0;

    for( let route of this.routingTable ) {
      if( route.network.InSameNetwork(route.mask, address) ) {

        if( bestRoute === null ) {
          bestRoute = route.gateway;
          bestCidr = route.mask.CIDR;
        }

        if( route.mask.CIDR > bestCidr ) {
          bestRoute = route.gateway;
          bestCidr = route.mask.CIDR;
        }
      }
    }

    return bestRoute;
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
