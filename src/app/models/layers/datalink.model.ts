import { HardwareAddress, MacAddress } from "../address.model";
import { Link } from "./physical.model";
import { GenericNode } from "../node.model";
import { PhysicalMessage, DatalinkMessage } from "../message.model";
import { DatalinkListener, GenericListener, PhysicalListener } from "../protocols/protocols.model";

export abstract class Interface {
  protected host: GenericNode;

  private listener: GenericListener[] = [];

  private link: Link | null = null;
  private name: string;
  private status: boolean;

  constructor(host: GenericNode, name: string) {
    this.host = host;
    this.name = name;
    this.status = false;
  }
  toString(): string {
    return `${this.host.name}(${this.name})`;
  }
  // ---
  up(): void {
    this.status = true;
  }
  down(): void {
    this.status = false;
  }
  isActive() : boolean {
    return this.status;
  }
  get Speed(): number {
    return this.link?.Speed || 0;
  }
  // ---
  isConnected(): boolean {
    return this.link != null;
  }
  isConnectedTo(link: Link): boolean {
    return this.link == link;
  }
  connectTo(link: Link): void {
    if( link.isConnectedTo(this) == false )
      throw new Error("Cannot be connected to this port");

    if( this.isConnected() ) {
      if( this.isConnectedTo(link) )
        throw new Error("Already connected to this link");
      else
        throw new Error(`${link} is already connected to ${this.link}`);
    }

    this.link = link;
  }
  protected get Link(): Link | null {
    return this.link;
  }
  get Host(): GenericNode {
    return this.host;
  }
  // ---
  addListener(listener: GenericListener): void {
    this.listener.push(listener);
  }
  get getListener(): GenericListener[] {
    return this.listener;
  }
}
export abstract class HardwareInterface extends Interface implements PhysicalListener, DatalinkListener {
  private address: HardwareAddress;

  constructor(host: GenericNode, address: HardwareAddress, name: string) {
    super(host, name);
    this.address = address;
  }

  hasMacAddress(address: HardwareAddress): boolean {
    if( address.isBroadcast)
      return true;
    return this.address.equals(address);
  }
  getMacAddress(): HardwareAddress {
    return this.address;
  }
  setMacAddress(addr: HardwareAddress) {
    return this.address;
  }


  receiveBits(message: PhysicalMessage): void {
    if( !this.isActive() )
      return; // TODO: Throw  error.
    //      throw new Error("Interface is down");

    this.getListener.map( i => {
      if( i != this && "receiveBits" in i)
        (i as PhysicalListener).receiveBits(message, this);
    });

    this.receiveTrame(message as DatalinkMessage);
  }
  receiveTrame(message: DatalinkMessage): void {
    if( !this.isActive() )
      return; // TODO: Throw  error.
//      throw new Error("Interface is down");

    this.getListener.map( i => {
      if( i != this && "receiveTrame" in i)
        (i as DatalinkListener).receiveTrame(message, this);
    });
  }
  sendTrame(message: DatalinkMessage): void {
    if( !this.isActive() )
      throw new Error("Interface is down");

    const loopback = this.address.equals(message.mac_dst);
    if( loopback ) {
      this.receiveTrame(message);
      return;
    }

    this.Link?.sendBits(message, this);
  }
}
export class EthernetInterface extends HardwareInterface {
  constructor(node: GenericNode, addr: MacAddress, name: string="") {
    super(node, addr, "eth" + name);
  }
}
