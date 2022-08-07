import { HardwareAddress, IPAddress, MacAddress } from "../address.model";
import { HardwareInterface, Interface } from "../layers/datalink.model";
import { DatalinkMessage, NetworkMessage, Payload } from "../message.model";
import { ActionHandle, DatalinkListener, NetworkListener } from "./protocols.model";

export class EthernetMessage extends DatalinkMessage {

  public vlan: number = 0;
  public header_checksum: number = 0;

  protected constructor(payload: Payload|string,
    mac_src: HardwareAddress, mac_dst: HardwareAddress|null) {
    super(payload, mac_src, mac_dst);
  }

  override get length(): number {
    return super.length + 16 + this.payload.length;
  }

  override toString(): string {
    return "ETH";
  }

  public checksum(): number {
    let sum = 0;

    sum = Math.imul(31, sum) + (this.vlan);

    return sum;
  }
  public IsReadyAtEndPoint(iface: HardwareInterface): boolean {
    if( this.mac_dst && iface.hasMacAddress(this.mac_dst) )
      return true;
    return false;
  }


  static Builder = class {
    public payload: Payload|string = "";
    public mac_src: MacAddress|null = null;
    public mac_dst: MacAddress|null = null;
    public vlan: number = 0;

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
    public setVlan(vlan: number): this {
      this.vlan = vlan;
      return this;
    }
    public setPayload(payload: Payload|string): this {
      this.payload = payload;
      return this;
    }

    build(): EthernetMessage {
      if( this.mac_src === null )
        throw new Error("MAC source address is not set");
      if( this.mac_dst === null )
        throw new Error("MAC destination address is not set");

      const message = new EthernetMessage(this.payload, this.mac_src, this.mac_dst);
      message.vlan = this.vlan;
      message.header_checksum = message.checksum();

      return message;
    }
  }
}

export class EthernetProtocol implements DatalinkListener {

  private iface: HardwareInterface;

  constructor(iface: HardwareInterface) {
    this.iface = iface;
    iface.addListener(this);
  }
  receiveTrame(message: DatalinkMessage, from: Interface): ActionHandle {

    if( message instanceof EthernetMessage ) {

      if( message.IsReadyAtEndPoint(this.iface) ) {
        const msg = new DatalinkMessage(message.payload, message.mac_src, message.mac_dst);
        this.iface.receiveTrame(msg);
        return ActionHandle.Stop;
      }

      return ActionHandle.Continue;
    }

    return ActionHandle.Continue;
  }

}
