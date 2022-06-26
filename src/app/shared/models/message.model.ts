import { HardwareAddress, NetworkAddress } from "./address.model";

export abstract class Message {
  payload: any;

  constructor(payload: any) {
    this.payload = payload;
  }

  toString(): string {
    return this.payload.toString();
  }
}
export class PhysicalMessage extends Message {

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
}

