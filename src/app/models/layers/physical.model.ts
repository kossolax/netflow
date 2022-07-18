import { timer, take, tap } from "rxjs";
import { DatalinkMessage, PhysicalMessage } from "../message.model";
import { HardwareInterface, Interface } from "./datalink.model";
import { NetworkInterface } from "./network.model";

export abstract class AbstractLink {
  public guid: string = Math.random().toString(36).substring(2, 9);
  public name: string = "Link";
  public type: string = "cable";

  protected iface1: HardwareInterface|null;
  protected iface2: HardwareInterface|null;
  protected length: number;
  protected speed: number;

  static SPEED_OF_LIGHT: number = 299792458;

  constructor( iface1: HardwareInterface|NetworkInterface|null = null, iface2: HardwareInterface|NetworkInterface|null = null, length: number=1) {
    this.iface1 = iface1 instanceof(NetworkInterface) ? iface1.getInterface(0) : iface1;
    this.iface2 = iface2 instanceof(NetworkInterface) ? iface2.getInterface(0) : iface2;

    this.length = length;

    if( this.iface1 != null )
      this.iface1.connectTo(this);
    if( this.iface2 != null )
      this.iface2.connectTo(this);

    const mbps = 100;
    this.speed = mbps * 1000 * 1000;
  }
  toString(): string {
    return `${this.iface1} <->  ${this.iface2}`;
  }
  clone(): AbstractLink {
    const node = structuredClone(this);
    node.guid = Math.random().toString(36).substring(2, 9);
    return node;
  }
  get Speed(): number {
    return this.speed;
  }

  public getPropagationDelay() {
		return length / (Link.SPEED_OF_LIGHT*2/3);
	}
  public getTransmissionDelay(bytes: number) {
    return bytes / this.speed;
  }
  public getDelay(bytes: number) {
    return this.getPropagationDelay() + this.getTransmissionDelay(bytes);
  }

  public isConnectedTo(iface: Interface) {
    return (this.iface1 === iface || this.iface2 === iface);
  }

  public sendBits(message: PhysicalMessage, source: HardwareInterface) {
    if( this.iface1 == null || this.iface2 == null )
      throw new Error("Link is not connected");

    let destination = this.iface1 === source ? this.iface2 : this.iface1;

    timer(this.getDelay(message.length) * 1000).pipe(
      take(1),
      tap( () => destination.receiveBits(message) )
    ).subscribe();
  }
  public getInterface(i: number): HardwareInterface|null {
    if( i == 0 )
      return this.iface1;
    else if( i == 1 )
      return this.iface2;
    else
      throw new Error(`Invalid index: ${i}`);
  }
}
export class Link extends AbstractLink {
}
