import { HardwareAddress, MacAddress } from "../address.model";
import { Dot1QInterface, EthernetInterface, HardwareInterface, Interface } from "../layers/datalink.model";
import { DatalinkMessage, Message, Payload } from "../message.model";
import { ActionHandle, DatalinkListener } from "./protocols.model";

export class EthernetMessage extends DatalinkMessage  {
  public header_checksum: number = 0;

  protected constructor(payload: Payload|string,
    mac_src: HardwareAddress, mac_dst: HardwareAddress|null) {
    super(payload, mac_src, mac_dst);
  }

  override get length(): number {
    return super.length + 16 + this.payload.length;
  }

  public override toString(): string {
    return `Ethernet\n${this.payload.toString()}`;
  }

  public checksum(): number {
    let sum = 0;
    return sum;
  }
  public IsReadyAtEndPoint(iface: HardwareInterface): boolean {
    if( this.mac_dst && iface.hasMacAddress(this.mac_dst) )
      return true;
    return false;
  }


  public static Builder = class {
    public payload: Payload|string = "";
    public mac_src: MacAddress|null = null;
    public mac_dst: MacAddress|null = null;

    constructor() {
    }

    public setMacSource(addr: MacAddress): this {
      this.mac_src = addr;
      return this;
    }
    public setMacDestination(addr: MacAddress): this {
      this.mac_dst = addr;
      return this;
    }
    public setPayload(payload: Payload|string): this {
      this.payload = payload;
      return this;
    }

    public build(): EthernetMessage {
      if( this.mac_src === null )
        throw new Error("MAC source address is not set");
      if( this.mac_dst === null )
        throw new Error("MAC destination address is not set");

      const message = new EthernetMessage(this.payload, this.mac_src, this.mac_dst);
      message.header_checksum = message.checksum();

      return message;
    }
  }
}
export class Dot1QMessage extends EthernetMessage {
  public vlan_id: number = 0;

  protected constructor(payload: Payload|string,
    mac_src: HardwareAddress, mac_dst: HardwareAddress|null) {
    super(payload, mac_src, mac_dst);
  }

  public override toString(): string {
    return `Dot1Q\n${this.payload.toString()}`;
  }

  public static override Builder = class extends (EthernetMessage.Builder) {
    public vlan_id: number = 0;

    public setVlan(vlan_id: number): this {
      this.vlan_id = vlan_id;
      return this;
    }

    public override build(): Dot1QMessage {
      if( this.mac_src === null )
        throw new Error("MAC source address is not set");
      if( this.mac_dst === null )
        throw new Error("MAC destination address is not set");

      const message = new Dot1QMessage(this.payload, this.mac_src, this.mac_dst);
      message.vlan_id = this.vlan_id;
      message.header_checksum = message.checksum();

      return message;
    }
  }
}
export enum VlanMode {
  Access = 0,
  Trunk = 1,
}
export class EthernetProtocol implements DatalinkListener {
  protected iface: EthernetInterface;

  constructor(iface: EthernetInterface) {
    this.iface = iface;
    iface.addListener(this);
  }
  public receiveTrame(message: DatalinkMessage, from: Interface): ActionHandle {

    if( message instanceof EthernetMessage ) {

      if( message instanceof Dot1QMessage )
        return ActionHandle.Continue;

      return ActionHandle.Continue;
    }

    return ActionHandle.Continue;
  }

}

export class Dot1QProtocol extends EthernetProtocol {
  public override receiveTrame(message: DatalinkMessage, from: Interface): ActionHandle {

    if( message instanceof Dot1QMessage ) {
      if( (this.iface as Dot1QInterface).Vlan.indexOf(message.vlan_id) === -1 )
        return ActionHandle.Stop;
    }

    return ActionHandle.Continue;
  }
}
