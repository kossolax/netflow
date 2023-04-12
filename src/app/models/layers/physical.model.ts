import { concatMap, map, Observable, of, Subject, switchMap, tap, timer } from "rxjs";
import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { PhysicalMessage } from "../message.model";
import { ArpMessage } from "../protocols/arp.model";
import { ActionHandle, GenericListener, handleChain, PhysicalListener, PhysicalSender } from "../protocols/protocols.model";
import { HardwareInterface, Interface } from "./datalink.model";
import { NetworkInterface } from "./network.model";

export abstract class AbstractLink implements PhysicalListener, PhysicalSender {
  public guid: string = Math.random().toString(36).substring(2, 9);
  public name: string = "Link";
  public type: string = "cable";

  private listener: GenericListener[] = [];

  protected iface1: HardwareInterface|null;
  protected queue1: Subject<Observable<number>> = new Subject();

  protected iface2: HardwareInterface|null;
  protected queue2: Subject<Observable<number>> = new Subject();

  protected length: number;

  public static readonly SPEED_OF_LIGHT: number = 299792458;

  constructor( iface1: HardwareInterface|NetworkInterface|null = null, iface2: HardwareInterface|NetworkInterface|null = null, length: number=1) {
    this.iface1 = iface1 instanceof(NetworkInterface) ? iface1.getInterface(0) : iface1;
    this.iface2 = iface2 instanceof(NetworkInterface) ? iface2.getInterface(0) : iface2;

    this.length = length;

    this.queue1.pipe(
      concatMap( (action) => action )
    ).subscribe();

    this.queue2.pipe(
      concatMap( (action) => action )
    ).subscribe();

    if( this.iface1 != null )
      this.iface1.connectTo(this);
    if( this.iface2 != null )
      this.iface2.connectTo(this);
  }
  public toString(): string {
    return `${this.iface1} <->  ${this.iface2}`;
  }
  public clone(): AbstractLink {
    const node = structuredClone(this);
    node.guid = Math.random().toString(36).substring(2, 9);
    return node;
  }

  public getPropagationDelay(): number {
		return (length / (Link.SPEED_OF_LIGHT*2/3));
	}
  public getTransmissionDelay(bytes: number, speed: number): number {
    if( SchedulerService.Instance.Speed === SchedulerState.SLOWER ) {
      return Math.max(0.1, (Math.log2(bytes) / Math.log10(speed)) / 10);
    }

    return (bytes / (speed*1000*1000)) / SchedulerService.Instance.Transmission;
  }
  private getDelay(bytes: number, speed: number): number {
    if( SchedulerService.Instance.Speed === SchedulerState.PAUSED )
      return 99999999999999;
    return this.getPropagationDelay() + this.getTransmissionDelay(bytes, speed);
  }

  public isConnectedTo(iface: Interface): boolean {
    return (this.iface1 === iface || this.iface2 === iface);
  }

  public sendBits(message: PhysicalMessage, source: HardwareInterface): void {
    if( this.iface1 == null || this.iface2 == null )
      throw new Error("Link is not connected");

    const destination = this.iface1 === source ? this.iface2 : this.iface1;

    if( this.iface1 === source || this.iface1.FullDuplex === false )
      this.queue1.next(this.enqueue(message, source, destination));
    else
      this.queue2.next(this.enqueue(message, source, destination));

  }

  private enqueue(message: PhysicalMessage, source: HardwareInterface, destination: HardwareInterface): Observable<0> {
    return of(0).pipe(

      map( _ => { // pre
        const propagationDelay = this.getDelay(message.length, source.Speed);

        handleChain("sendBits", this.getListener, message, source, destination, propagationDelay);

        return propagationDelay;
      }),

      switchMap( delay => SchedulerService.Instance.once(delay) ),

      tap( _ => { // post
        this.receiveBits(message, source, destination)
      })

    );
  }

  public receiveBits(message: PhysicalMessage, source: HardwareInterface, destination: HardwareInterface): ActionHandle {
    handleChain("receiveBits", this.getListener, message, source, destination);

    // send to L2
    destination.receiveBits(message, source, destination);
    return ActionHandle.Continue;
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
  public addListener(listener: GenericListener): void {
    this.listener.push(listener);
  }
  public removeListener(listener: GenericListener): void {
    this.listener = this.listener.filter( l => l !== listener );
  }
  get getListener(): GenericListener[] {
    return this.listener;
  }
}

export class Link extends AbstractLink {

  public override sendBits(message: PhysicalMessage, source: HardwareInterface): void {
    super.sendBits(message, source);
  }
}
