import { Subject } from "rxjs";
import { HardwareInterface, Interface } from "../layers/datalink.model";
import { NetworkInterface } from "../layers/network.model";
import { Link } from "../layers/physical.model";
import { DatalinkMessage, NetworkMessage, PhysicalMessage } from "../message.model";

export abstract class GenericListener {
  toString(): string {
    return this.constructor.name.toString();
  }
}
export interface Listener<T> extends GenericListener {

}
export interface PhysicalListener extends Listener<Link> {
  //receiveBits$: Subject<PhysicalMessage> = new Subject<PhysicalMessage>();
  receiveBits(message: PhysicalMessage, from: Interface): void;
}
export interface DatalinkListener extends Listener<HardwareInterface> {
  //receiveTrame$: Subject<DatalinkMessage> = new Subject<DatalinkMessage>();
  receiveTrame(message: DatalinkMessage, from: Interface): void;
}
export interface NetworkListener extends Listener<NetworkInterface> {
  //receivePacket$: Subject<NetworkMessage> = new Subject<NetworkMessage>();
  receivePacket(message: NetworkMessage, from: Interface): void;
}

export class SimpleListener implements PhysicalListener, DatalinkListener, NetworkListener {
  receiveBits$: Subject<PhysicalMessage> = new Subject<PhysicalMessage>();
  receiveTrame$: Subject<DatalinkMessage> = new Subject<DatalinkMessage>();
  receivePacket$: Subject<NetworkMessage> = new Subject<NetworkMessage>();

  receiveBits(message: PhysicalMessage, from: Interface): void {
    this.receiveBits$.next(message);
  }
  receiveTrame(message: DatalinkMessage, from: Interface): void {
    this.receiveTrame$.next(message);
  }
  receivePacket(message: NetworkMessage, from: Interface): void {
    this.receivePacket$.next(message);
  }
}
