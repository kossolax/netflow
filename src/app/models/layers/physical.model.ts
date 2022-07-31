import { concatMap, map, Observable, of, Subject, switchMap, tap, timer } from "rxjs";
import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { PhysicalMessage } from "../message.model";
import { GenericListener, PhysicalListener, PhysicalSender } from "../protocols/protocols.model";
import { HardwareInterface, Interface } from "./datalink.model";
import { NetworkInterface } from "./network.model";

export abstract class AbstractLink implements PhysicalListener, PhysicalSender {
  public guid: string = Math.random().toString(36).substring(2, 9);
  public name: string = "Link";
  public type: string = "cable";

  private listener: GenericListener[] = [];
  private queue: Subject<Observable<number>> = new Subject();

  protected iface1: HardwareInterface|null;
  protected iface2: HardwareInterface|null;
  protected length: number;

  static SPEED_OF_LIGHT: number = 299792458;

  constructor( iface1: HardwareInterface|NetworkInterface|null = null, iface2: HardwareInterface|NetworkInterface|null = null, length: number=1) {
    this.iface1 = iface1 instanceof(NetworkInterface) ? iface1.getInterface(0) : iface1;
    this.iface2 = iface2 instanceof(NetworkInterface) ? iface2.getInterface(0) : iface2;

    this.length = length;

    if( this.iface1 != null )
      this.iface1.connectTo(this);
    if( this.iface2 != null )
      this.iface2.connectTo(this);

    this.queue.pipe(concatMap( (action) => action )).subscribe();
  }
  toString(): string {
    return `${this.iface1} <->  ${this.iface2}`;
  }
  clone(): AbstractLink {
    const node = structuredClone(this);
    node.guid = Math.random().toString(36).substring(2, 9);
    return node;
  }

  public getPropagationDelay() {
		return (length / (Link.SPEED_OF_LIGHT*2/3));
	}
  public getTransmissionDelay(bytes: number, speed: number) {
    if( SchedulerService.Instance.Speed === SchedulerState.SLOWER )
      speed = 1 + Math.log2(speed);

    return (bytes / (speed*1000*1000)) / SchedulerService.Instance.Transmission;
  }
  public getDelay(bytes: number, speed: number) {
    if( SchedulerService.Instance.Speed === SchedulerState.PAUSED )
      return 99999999999999;
    return this.getPropagationDelay() + this.getTransmissionDelay(bytes, speed);
  }

  public isConnectedTo(iface: Interface) {
    return (this.iface1 === iface || this.iface2 === iface);
  }

  public sendBits(message: PhysicalMessage, source: HardwareInterface) {
    if( this.iface1 == null || this.iface2 == null )
      throw new Error("Link is not connected");

    const destination = this.iface1 === source ? this.iface2 : this.iface1;
    this.queue.next(this.enqueue(message, source, destination));
  }

  private enqueue(message: PhysicalMessage, source: HardwareInterface, destination: HardwareInterface): Observable<number> {
    return of(0).pipe(
      map( _ => { // pre
        const propagationDelay = this.getDelay(message.length, source.Speed);

        this.getListener.map( i => {
          if( i != this && "sendBits" in i)
            (i as PhysicalSender).sendBits(message, source, destination, propagationDelay);
        });

        return propagationDelay;
      }),

      switchMap( delay => SchedulerService.Instance.once(delay) ),

      tap( _ => { // post
        this.receiveBits(message, source, destination)
      })
    );
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
