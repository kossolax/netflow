import { HardwareAddress, NetworkAddress } from "./address.model";

export abstract class Message {
  payload: any;

  constructor(payload: any) {
    this.payload = payload;
  }

  toString(): string {
    return this.payload.toString();
  }
  get length(): number {
    return this.payload.length;
  }
}
export class PhysicalMessage extends Message {
  override get length(): number {
    return super.length;
  }
}
export class DatalinkMessage extends PhysicalMessage {
  mac_src: HardwareAddress;
  mac_dst: HardwareAddress|null;

  constructor(payload: any,
    mac_src: HardwareAddress, mac_dst: HardwareAddress|null) {
    super(payload);
    this.mac_src = mac_src;
    this.mac_dst = mac_dst;
  }

  override get length(): number {
    return super.length + this.mac_src.length * 2;
  }

}
export class NetworkMessage extends DatalinkMessage {
  net_src: NetworkAddress;
  net_dst: NetworkAddress|null;

  constructor(payload: any,
    mac_src: HardwareAddress, mac_dst: HardwareAddress|null,
    net_src: NetworkAddress, net_dst: NetworkAddress|null) {
    super(payload, mac_src, mac_dst);
    this.net_src = net_src;
    this.net_dst = net_dst;
  }

  override get length(): number {
    return super.length + this.net_src.length * 2;
  }
}
