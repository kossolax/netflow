import { SchedulerService } from "src/app/services/scheduler.service";
import { PhysicalMessage } from "../message.model";
import { GenericListener, PhysicalListener, PhysicalSender } from "../protocols/protocols.model";
import { HardwareInterface, Interface } from "./datalink.model";
import { NetworkInterface } from "./network.model";

export abstract class AbstractLink implements PhysicalListener, PhysicalSender {
  public guid: string = Math.random().toString(36).substring(2, 9);
  public name: string = "Link";
  public type: string = "cable";

  private listener: GenericListener[] = [];

  protected iface1: HardwareInterface|null;
  protected iface2: HardwareInterface|null;
  protected length: number;
  protected speed: number;

  static SPEED_OF_LIGHT: number = 299792458;

  constructor( iface1: HardwareInterface|NetworkInterface|null = null, iface2: HardwareInterface|NetworkInterface|null = null, length: number=1) {
    this.iface1 = iface1 instanceof(NetworkInterface) ? iface1.getInterface(0) : iface1;
    this.iface2 = iface2 instanceof(NetworkInterface) ? iface2.getInterface(0) : iface2;

    this.length = length;
    this.speed = 0;

    if( this.iface1 != null )
      this.iface1.connectTo(this);
    if( this.iface2 != null )
      this.iface2.connectTo(this);
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
  set Speed(speed: number) {
    if( speed % 10 != 0 )
      throw new Error("Speed must be a multiple of 10");
    this.speed = speed;
  }

  public getPropagationDelay() {
		return (length / (Link.SPEED_OF_LIGHT*2/3)) / SchedulerService.Instance.SpeedOfLight;
	}
  public getTransmissionDelay(bytes: number) {
    let speed = this.speed;
    if( speed === 0 )
      speed = 10;

    return (bytes / (speed*1000*1000)) / SchedulerService.Instance.Transmission;
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

    const destination = this.iface1 === source ? this.iface2 : this.iface1;
    const delay = this.getDelay(message.length);

    this.getListener.map( i => {
      if( i != this && "sendBits" in i)
        (i as PhysicalSender).sendBits(message, source, destination, delay);
    });

    SchedulerService.Instance.once(delay).subscribe(() => {
      this.receiveBits(message, source, destination)
    });
  }

  public receiveBits(message: PhysicalMessage, source: HardwareInterface, destination: HardwareInterface) {

    this.getListener.map( i => {
      if( i != this && "receiveBits" in i)
        (i as PhysicalListener).receiveBits(message, source, destination);
    });

    // send to L2
    destination.receiveBits(message, source, destination);
  }

  public getInterface(i: number): HardwareInterface|null {
    if( i == 0 )
      return this.iface1;
    else if( i == 1 )
      return this.iface2;
    else
      throw new Error(`Invalid index: ${i}`);
  }


  // ---
  addListener(listener: GenericListener): void {
    this.listener.push(listener);
  }
  get getListener(): GenericListener[] {
    return this.listener;
  }
}
export class Link extends AbstractLink {
}
