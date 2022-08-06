import { Subject, zip } from "rxjs";
import { HardwareInterface, Interface } from "../layers/datalink.model";
import { NetworkInterface } from "../layers/network.model";
import { Link } from "../layers/physical.model";
import { DatalinkMessage, NetworkMessage, PhysicalMessage, Message } from "../message.model";

export enum ActionHandle {
  Continue, // Continue with the original action
  Handled,  // Handle the action at the end (don't call it)
  Stop      // Immediately stop the hook chain and handle the original
}

export abstract class GenericListener {
  toString(): string {
    return this.constructor.name.toString();
  }
}
export interface Listener<T> extends GenericListener {

}
export interface PhysicalListener extends Listener<PhysicalMessage> {
  receiveBits(message: PhysicalMessage, from: Interface, to: Interface): ActionHandle;
}
export interface PhysicalSender extends Listener<Link> {
  sendBits(message: PhysicalMessage, from: Interface, to: Interface, delay: number): void;
}

export interface DatalinkListener extends Listener<HardwareInterface> {
  receiveTrame(message: DatalinkMessage, from: Interface): ActionHandle;
}
export interface DatalinkSender extends Listener<HardwareInterface> {
  sendTrame(message: DatalinkMessage, from: Interface): void;
}

export interface NetworkListener extends Listener<NetworkInterface> {
  receivePacket(message: NetworkMessage, from: Interface): ActionHandle;
}
export interface NetworkSender extends Listener<NetworkInterface> {
  sendPacket(message: NetworkMessage, from: Interface): void;
}

export class SimpleListener implements PhysicalListener, DatalinkListener, NetworkListener {
  receiveBits$: Subject<PhysicalMessage> = new Subject<PhysicalMessage>();
  receiveTrame$: Subject<DatalinkMessage> = new Subject<DatalinkMessage>();
  receivePacket$: Subject<NetworkMessage> = new Subject<NetworkMessage>();

  receiveBits(message: PhysicalMessage, from: Interface, to: Interface): ActionHandle {
    this.receiveBits$.next(message);
    return ActionHandle.Continue;
  }
  receiveTrame(message: DatalinkMessage, from: Interface): ActionHandle {
    this.receiveTrame$.next(message);
    return ActionHandle.Continue;
  }
  receivePacket(message: NetworkMessage, from: Interface): ActionHandle {
    this.receivePacket$.next(message);
    return ActionHandle.Continue;
  }
}

declare interface Pair<P extends Message, Q extends Interface> {
  message: P;
  source: Q;
  destination: Q;
  delay: number;
}

export class LinkLayerSpy implements PhysicalSender, PhysicalListener {
  receiveBits$: Subject<Pair<PhysicalMessage, Interface>> = new Subject<Pair<PhysicalMessage, Interface>>();
  sendBits$: Subject<Pair<PhysicalMessage, Interface>> = new Subject<Pair<PhysicalMessage, Interface>>();

  receiveBits(message: PhysicalMessage, from: Interface, to: Interface): ActionHandle {
    this.receiveBits$.next({message: message, source: from, destination: to, delay: 0});
    return ActionHandle.Continue;

  }
  sendBits(message: PhysicalMessage, from: Interface, to: Interface, delay:number = 0): void {
    this.sendBits$.next({message: message, source: from, destination: to, delay: delay});
  }
}
