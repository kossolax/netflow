import { Subject } from "rxjs";
import { IPAddress, NetworkAddress } from "../address.model";
import { ActionHandle, NetworkListener } from "../protocols/protocols.model";
import { DhcpServer } from "../services/dhcp.model";
import { NetworkHost } from "./generic.model";
import { NetworkMessage } from "../message.model";
import { NetworkInterface } from "../layers/network.model";

export class RouterHost extends NetworkHost implements NetworkListener {
  public override name = "Router";
  public override type = "router";
  private routingTable: {network: NetworkAddress, mask: NetworkAddress, gateway: NetworkAddress}[] = [];
  get RoutingTable(): {network: NetworkAddress, mask: NetworkAddress, gateway: NetworkAddress}[] {
    return this.routingTable;
  }

  public services: {dhcp: DhcpServer};

  public receivePacket$: Subject<NetworkMessage> = new Subject<NetworkMessage>();


  constructor(name: string="", iface: number=0) {
    super();
    if( name != "" )
      this.name = name;

    for(let i=0; i<iface; i++)
      this.addInterface();

    this.services = {
      "dhcp": new DhcpServer(this),
    };
  }

  public clone(): RouterHost {
    const clone = new RouterHost();
    this.cloneInto(clone);
    return clone;
  }


  public send(message: string|NetworkMessage, net_dst?: NetworkAddress): void {

    if( message instanceof NetworkMessage ) {
      for( const name in this.interfaces ) {
        if( this.interfaces[name].hasNetAddress(message.net_src as NetworkAddress) )
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
        if( this.interfaces[name].hasNetAddress(msg.net_src as NetworkAddress) )
          this.interfaces[name].sendPacket(msg);
      }
    }
  }

  public receivePacket(message: NetworkMessage, from: NetworkInterface): ActionHandle {

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

  public addRoute(network: NetworkAddress|string, mask: NetworkAddress|string, gateway: NetworkAddress|string): void {
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
  public deleteRoute(network: NetworkAddress|string, mask: NetworkAddress|string, gateway: NetworkAddress|string): void {
    if( typeof network === "string" )
      network = new IPAddress(network);
    if( typeof mask === "string" )
      mask = new IPAddress(mask, true);
    if( typeof gateway === "string" )
      gateway = new IPAddress(gateway);

    for( let i = 0; i < this.routingTable.length; i++ ) {
      if( this.routingTable[i].network.equals(network) && this.routingTable[i].mask.equals(mask) && this.routingTable[i].gateway.equals(gateway) ) {
        this.routingTable.splice(i, 1);
        return;
      }
    }
    throw new Error("Route not found");
  }
  public getNextHop(address: NetworkAddress): NetworkAddress|null {
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

    for(let name in this.interfaces) {
      if( this.interfaces[name].getNetAddress().InSameNetwork(this.interfaces[name].getNetMask(), address) ) {
        if( bestRoute === null ) {
          bestRoute = address;
          bestCidr = this.interfaces[name].getNetMask().CIDR;
        }

        if( this.interfaces[name].getNetMask().CIDR > bestCidr ) {
          bestRoute = address;
          bestCidr = this.interfaces[name].getNetMask().CIDR;
        }
      }
    }

    return bestRoute;
  }
}
