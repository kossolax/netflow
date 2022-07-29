import { HardwareAddress, MacAddress } from "../address.model";
import { Link } from "./physical.model";
import { GenericNode } from "../node.model";
import { PhysicalMessage, DatalinkMessage } from "../message.model";
import { DatalinkListener, DatalinkSender, GenericListener, PhysicalListener } from "../protocols/protocols.model";
import { AutoNegotiationProtocol } from "../protocols/autonegotiation.model";

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
  set Speed(speed: number) {
    if( !this.link )
      throw new Error("Link is not connected");

    this.link.Speed = speed;
  }
  get FullDuplex(): boolean {
    return this.link?.FullDuplex || false;
  }
  set FullDuplex(fullDuplex: boolean) {
    if( !this.link )
      throw new Error("Link is not connected");
    this.link.FullDuplex = fullDuplex;
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
export abstract class HardwareInterface extends Interface implements PhysicalListener, DatalinkListener, DatalinkSender {
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
    this.address = addr;
  }


  receiveBits(message: PhysicalMessage, source: HardwareInterface, destination: HardwareInterface): void {
    if( !this.isActive() )
      return; // TODO: Throw  error.
    //      throw new Error("Interface is down");

    this.getListener.map( i => {
      if( i != this && "receiveBits" in i)
        (i as PhysicalListener).receiveBits(message, source, this);
    });

    if( message instanceof DatalinkMessage )
      this.receiveTrame(message);
  }
  receiveTrame(message: DatalinkMessage): void {
    this.getListener.map( i => {
      if( i != this && "receiveTrame" in i)
        (i as DatalinkListener).receiveTrame(message, this);
    });
  }
  sendTrame(message: DatalinkMessage): void {
    if( !this.isActive() )
      throw new Error("Interface is down");

    this.getListener.map( i => {
      if( i != this && "sendTrame" in i ) // prevent loop between L2 and L3
        (i as DatalinkSender).sendTrame(message, this);
    });

    const loopback = this.address.equals(message.mac_dst);
    if( loopback ) {
      this.receiveTrame(message);
      return;
    }

    this.Link?.sendBits(message, this);
  }
  sendBits(message: PhysicalMessage): void {
    this.Link?.sendBits(message, this);
  }
}
export class EthernetInterface extends HardwareInterface {
  private discovery: AutoNegotiationProtocol;

  constructor(node: GenericNode, addr: MacAddress, name: string="") {
    super(node, addr, "eth" + name);

    this.discovery = new AutoNegotiationProtocol(this);
  }

  override connectTo(link: Link): void {
    super.connectTo(link);

    if( link.Speed === 0 )
      this.discovery.negociate(0, 1000, true);
  }

  override get Speed(): number {
    return super.Speed;
  }
  override set Speed(speed: number) {
    super.Speed = speed;

    if( speed === 0 )
      this.discovery.negociate(speed, 1000, true);
  }
}
