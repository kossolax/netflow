import { HardwareAddress, MacAddress } from "../address.model";
import { Link } from "./physical.model";
import { GenericNode } from "../node.model";
import { PhysicalMessage, DatalinkMessage, NetworkMessage } from "../message.model";
import { ActionHandle, DatalinkListener, DatalinkSender, GenericListener, handleChain, PhysicalListener } from "../protocols/protocols.model";
import { AutoNegotiationProtocol } from "../protocols/autonegotiation.model";
import { Dot1QMessage, Dot1QProtocol, EthernetMessage, EthernetProtocol, VlanMode } from "../protocols/ethernet.model";

export abstract class Interface {
  protected host: GenericNode;

  private listener: GenericListener[] = [];

  private link: Link | null = null;
  private name: string;
  private status: boolean;

  protected speed: number = 100;
  protected fullDuplex: boolean = false;

  constructor(host: GenericNode, name: string) {
    this.host = host;
    this.name = name;
    this.status = false;
  }
  public toString(): string {
    return `${this.host.name}(${this.name})`;
  }
  // ---
  public up(): void {
    this.status = true;
  }
  public down(): void {
    this.status = false;
  }
  public isActive() : boolean {
    return this.status;
  }
  get Speed(): number {
    return this.speed;
  }
  set Speed(speed: number) {
    this.speed = speed;
  }
  get FullDuplex(): boolean {
    return this.fullDuplex;
  }
  set FullDuplex(fullDuplex: boolean) {
    this.fullDuplex = fullDuplex;
  }
  // ---
  get isConnected(): boolean {
    return this.link != null;
  }
  public isConnectedTo(link: Link): boolean {
    return this.link == link;
  }
  public connectTo(link: Link): void {
    if( link.isConnectedTo(this) == false )
      throw new Error("Cannot be connected to this port");

    if( this.isConnected ) {
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
  public addListener(listener: GenericListener): void {
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

  public hasMacAddress(address: HardwareAddress): boolean {
    if( address.isBroadcast)
      return true;
    return this.address.equals(address);
  }
  public getMacAddress(): HardwareAddress {
    return this.address;
  }
  public setMacAddress(addr: HardwareAddress): void {
    this.address = addr;
  }


  public receiveBits(message: PhysicalMessage, source: HardwareInterface, destination: HardwareInterface): ActionHandle {
    if( !this.isActive() )
      return ActionHandle.Stop;

    let action = handleChain("receiveBits", this.getListener, message, source, this);
    if( action !== ActionHandle.Continue )
      return action;


    if( message.payload instanceof DatalinkMessage )
      this.receiveTrame(message.payload as DatalinkMessage);

    return ActionHandle.Continue;
  }
  public receiveTrame(message: DatalinkMessage): ActionHandle {

    let action = handleChain("receiveTrame", this.getListener, message, this);
    if( action !== ActionHandle.Continue )
      return action;

    return ActionHandle.Continue;
  }

  public sendTrame(message: DatalinkMessage): void {
    if( !this.isActive() )
      throw new Error("Interface is down");

    let action = handleChain("sendTrame", this.getListener, message, this);
    if( action !== ActionHandle.Continue )
      return;

    const loopback = this.address.equals(message.mac_dst);
    if( loopback ) {
      this.receiveTrame(message);
      return;
    }

    this.sendBits(new PhysicalMessage(message));
  }

  public sendBits(message: PhysicalMessage): void {
    if( !this.isActive() )
      throw new Error("Interface is down");
    this.Link?.sendBits(message, this);
  }
}
export class EthernetInterface extends HardwareInterface {
  protected minSpeed: number;
  protected maxSpeed: number;
  protected fullDuplexCapable: boolean;
  protected discovery: AutoNegotiationProtocol|null = null;
  protected ethernet: EthernetProtocol;

  constructor(node: GenericNode, addr: MacAddress, name: string="", minSpeed: number=10, maxSpeed: number=1000, fullDuplexCapable: boolean=true, autonegotiate: boolean=true) {
    super(node, addr, "eth" + name);
    this.minSpeed = minSpeed;
    this.maxSpeed = maxSpeed;
    this.Speed = maxSpeed;
    this.fullDuplexCapable = fullDuplexCapable;

    if( autonegotiate )
      this.discovery = new AutoNegotiationProtocol(this);
    this.ethernet = new EthernetProtocol(this);
  }

  public reconfigure(minSpeed: number, maxSpeed: number, fullDuplexCapable: boolean): void {
    this.minSpeed = minSpeed;
    this.maxSpeed = maxSpeed;
    this.fullDuplexCapable = fullDuplexCapable;

    this.discovery?.negociate(this.minSpeed, this.maxSpeed, this.fullDuplexCapable);
  }

  public override connectTo(link: Link): void {
    super.connectTo(link);

    if( this.isActive() )
      this.discovery?.negociate(this.minSpeed, this.maxSpeed, this.fullDuplexCapable);
  }
  public override up(): void {
    super.up();

    if( this.isConnected )
      this.discovery?.negociate(this.minSpeed, this.maxSpeed, this.fullDuplexCapable);
  }

  override get FullDuplex(): boolean {
    return super.FullDuplex;
  }
  override set FullDuplex(fullDuplex: boolean) {
    if( fullDuplex && !this.fullDuplexCapable )
      throw new Error("This interface does not support full duplex");
    this.fullDuplex = fullDuplex;
  }

  override get Speed(): number {
    return super.Speed;
  }
  override set Speed(speed: number) {

    if( speed === 0 ) {
      if( !this.discovery )
        throw new Error("This interface does not support speed 0");

      super.Speed = this.minSpeed;
      this.discovery.negociate(this.minSpeed, this.maxSpeed, this.fullDuplexCapable);
      return;
    }

    if( speed < this.minSpeed || speed > this.maxSpeed )
      throw new Error(`Speed must be between ${this.minSpeed} and ${this.maxSpeed}`);

    if( speed % 10 != 0 && speed != 1 )
      throw new Error("Speed must be a multiple of 10 or 1");

    super.Speed = speed;
  }


  public override sendTrame(message: DatalinkMessage): void {

    if( message instanceof EthernetMessage ) {
      super.sendTrame(message);
    }
    else {
      const trame = new EthernetMessage.Builder()
        .setMacSource(message.mac_src as MacAddress)
        .setMacDestination(message.mac_dst as MacAddress)
        .setPayload(message.payload)
        .build();

      super.sendTrame(trame);
    }
  }

  public override receiveTrame(message: DatalinkMessage): ActionHandle {
    return super.receiveTrame(message);
  }

}

export class Dot1QInterface extends EthernetInterface {
  protected vlan: number[];
  protected vlanMode: VlanMode;
  protected natif: number = 0;

  protected dot1q: Dot1QProtocol;

  constructor(node: GenericNode, addr: MacAddress, name: string="", minSpeed: number=10, maxSpeed: number=1000, fullDuplexCapable: boolean=true, autonegotiate: boolean=true) {
    super(node, addr, name, minSpeed, maxSpeed, fullDuplexCapable, autonegotiate);

    this.vlan = [ this.natif ];
    this.vlanMode = VlanMode.Access;
    this.dot1q = new Dot1QProtocol(this);
  }

  public addVlan(vlan_id: number): void {
    if( this.VlanMode === VlanMode.Access ) {
      this.vlan = [vlan_id];
    }
    else {
      if( this.vlan.indexOf(vlan_id) === -1 )
        this.vlan.push(vlan_id);
    }
  }
  public removeVlan(vlan_id: number): void {
    if( this.VlanMode === VlanMode.Access ) {
      this.vlan = [ this.natif ];
    }
    else {
      const index = this.vlan.indexOf(vlan_id);
      if( index !== -1 )
        this.vlan.splice(index, 1);
    }
  }

  get Vlan(): number[] {
    return this.vlan;
  }
  get VlanMode(): VlanMode {
    return this.vlanMode;
  }
  set VlanMode(vlanMode: VlanMode) {
    if( vlanMode === VlanMode.Access ) {
      if( this.vlan.length === 0 )
        this.vlan = [ this.natif ];
      if( this.vlan.length > 1 )
        this.vlan = [this.vlan[0]];
    }
    this.vlanMode = vlanMode;
  }
  get NativeVlan(): number {
    return this.natif;
  }
  set NativeVlan(natif: number) {
    this.natif = natif;
  }

  public override sendTrame(message: DatalinkMessage): void {
    if( message instanceof Dot1QMessage && this.vlan.indexOf(message.vlan_id) === -1 )
      throw new Error("Vlan mismatch");


    if( this.vlanMode === VlanMode.Trunk ) {
      let trame: Dot1QMessage;

      if( message instanceof Dot1QMessage ) {
        trame = message;
      }
      else {
        trame = new Dot1QMessage.Builder()
          .setVlan(this.vlan[0])
          .setMacSource(message.mac_src as MacAddress)
          .setMacDestination(message.mac_dst as MacAddress)
          .setPayload(message.payload)
          .build();
      }

      super.sendTrame(trame);
    }
    else {
      let trame: DatalinkMessage;

      if( message instanceof Dot1QMessage ) {
        trame = new EthernetMessage.Builder()
          .setMacSource(message.mac_src as MacAddress)
          .setMacDestination(message.mac_dst as MacAddress)
          .setPayload(message.payload)
          .build();
      }
      else {
        trame = message;
      }

      super.sendTrame(trame);
    }

  }
}
