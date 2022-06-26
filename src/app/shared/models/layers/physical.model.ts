import { timer, take, tap } from "rxjs";
import { DatalinkMessage, PhysicalMessage } from "../message.model";
import { HardwareInterface, Interface } from "./datalink.model";
import { NetworkInterface } from "./network.model";

export abstract class AbstractLink {
  protected iface1: HardwareInterface;
  protected iface2: HardwareInterface;
  protected length: number;

  static SPEED_OF_LIGHT: number = 299792458;

  constructor( iface1: HardwareInterface|NetworkInterface, iface2: HardwareInterface|NetworkInterface, length: number) {
    this.iface1 = iface1 instanceof(NetworkInterface) ? iface1.getInterface(0) : iface1;
    this.iface2 = iface2 instanceof(NetworkInterface) ? iface2.getInterface(0) : iface2;
    this.length = length;

    this.iface1.connectTo(this);
    this.iface2.connectTo(this);
  }
  toString(): string {
    return `${this.iface1} <->  ${this.iface2}`;
  }

  public getPropagationDelay() {
		return length / (Link.SPEED_OF_LIGHT*2/3);
	}
  public isConnectedTo(iface: Interface) {
    return (this.iface1 === iface || this.iface2 === iface);
  }

  public sendBits(message: PhysicalMessage, source: HardwareInterface) {
    let destination = this.iface1 === source ? this.iface2 : this.iface1;

    timer(this.getPropagationDelay() / 1000).pipe(
      take(1),
      tap( () => destination.receiveBits(message) )
    ).subscribe();
  }
}
export class Link extends AbstractLink {
}
