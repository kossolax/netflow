import { Observable, Subject } from "rxjs";
import { SchedulerService } from "../services/scheduler.service";
import { Address, MacAddress, IPAddress, NetworkAddress, HardwareAddress } from "./address.model";
import { Dot1QInterface, EthernetInterface, HardwareInterface, Interface } from "./layers/datalink.model";
import { IPInterface, NetworkInterface } from "./layers/network.model";
import { DatalinkMessage, Message, NetworkMessage } from "./message.model";
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

  // TODO: Make this private.
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

    if( dst.isBroadcast || this.ARPTable.get(dst) === undefined ) {
      for( const name in this.interfaces ) {
        if( this.interfaces[name] !== from )
          this.interfaces[name].sendTrame(message);
      }
    }
    else {
      this.ARPTable.get(dst)?.map( i => {
        if( i.iface !== from )
          i.iface.sendTrame(message);
      });

    }

    this.receiveTrame$.next(message);
    return ActionHandle.Continue;
  }

  cleanARPTable(): void {
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

  receivePacket(message: NetworkMessage, from: Interface): ActionHandle {
    this.receivePacket$.next(message);
    return ActionHandle.Continue;
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
