import { Subject, zip } from "rxjs";
import { EthernetInterface, HardwareInterface, Interface } from "../layers/datalink.model";
import { NetworkInterface } from "../layers/network.model";
import { AbstractLink, Link } from "../layers/physical.model";
import { DatalinkMessage, NetworkMessage, PhysicalMessage, Message } from "../message.model";
import { HardwareAddress, IPAddress, MacAddress } from "../address.model";
import { GenericNode } from "../nodes/generic.model";

export enum ActionHandle {
  Continue, // Continue with the original action
  Handled,  // Handle the action at the end (don't call it)
  Stop,      // Immediately stop the hook chain and handle the original
}

export type EventString = "OnInterfaceAdded"|"OnInterfaceUp"|"OnInterfaceDown"|"OnInterfaceChange";

export function handleChain(
  handler: "receiveBits"|"sendBits"|"receiveTrame"|"sendTrame"|"receivePacket"|"sendPacket"|"on",
  listeners: GenericListener[],
  message: Message|EventString,
  sender: Interface|GenericNode,
  receiver?: Interface,
  delay: number=0
  ): ActionHandle {

  let ret = ActionHandle.Continue;
  let action = ActionHandle.Continue;

  for(let i of listeners) {
    if( i === sender )
      continue;

    if( handler in i && handler != "on" ) {
      switch( handler ) {
        case "receiveTrame": {
          ret = (i as DatalinkListener).receiveTrame(message as DatalinkMessage, sender as Interface);
          if( ret > action ) action = ret;
          break;
        }
        case "sendTrame": {
          if( i instanceof HardwareInterface )
            (i as DatalinkSender).sendTrame(message as DatalinkMessage, sender as Interface);
          break;
        }


        case "receivePacket": {
          ret = (i as NetworkListener).receivePacket(message as NetworkMessage, sender as Interface);
          if( ret > action ) action = ret;
          break;
        }
        case "sendPacket": {
          if( i instanceof NetworkInterface )
            (i as NetworkSender).sendPacket(message as NetworkMessage, sender as Interface);
          break;
        }


        case "receiveBits": {
          if( !receiver )
            throw new Error("receiver is required for receiveBits");

            ret = (i as PhysicalListener).receiveBits(message as NetworkMessage, sender as Interface, receiver);
          if( ret > action ) action = ret;
          break;
        }
        case "sendBits": {
          if( !receiver )
            throw new Error("receiver is required for sendBits");

          (i as PhysicalSender).sendBits(message as NetworkMessage, sender as Interface, receiver, delay);
          break;
        }

      }
    }
    if( typeof i === 'function' && handler == "on" ) {
      ret = (i as GenericEventListener)(message as EventString, sender) ?? ActionHandle.Continue;
      if( ret > action ) action = ret;
    }

    if( action === ActionHandle.Stop )
      break;
  }

  return action;
}

export type GenericEventListener = (message: EventString, sender: Interface|GenericNode) => ActionHandle|void;
export type GenericListener = GenericClassListener|GenericEventListener;

abstract class GenericClassListener {
}
interface Listener<T extends Interface|Message|Link> extends GenericClassListener {
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
  public receiveBits$: Subject<PhysicalMessage> = new Subject<PhysicalMessage>();
  public receiveTrame$: Subject<DatalinkMessage> = new Subject<DatalinkMessage>();
  public receivePacket$: Subject<NetworkMessage> = new Subject<NetworkMessage>();

  public receiveBits(message: PhysicalMessage, from: Interface, to: Interface): ActionHandle {
    this.receiveBits$.next(message);
    return ActionHandle.Continue;
  }
  public receiveTrame(message: DatalinkMessage, from: Interface): ActionHandle {
    this.receiveTrame$.next(message);
    return ActionHandle.Continue;
  }
  public receivePacket(message: NetworkMessage, from: Interface): ActionHandle {
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
  public receiveBits$: Subject<Pair<PhysicalMessage, Interface>> = new Subject<Pair<PhysicalMessage, Interface>>();
  public sendBits$: Subject<Pair<PhysicalMessage, Interface>> = new Subject<Pair<PhysicalMessage, Interface>>();

  public receiveBits(message: PhysicalMessage, from: Interface, to: Interface): ActionHandle {
    this.receiveBits$.next({message: message, source: from, destination: to, delay: 0});
    return ActionHandle.Continue;

  }
  public sendBits(message: PhysicalMessage, from: Interface, to: Interface, delay:number = 0): void {
    this.sendBits$.next({message: message, source: from, destination: to, delay: delay});
  }
}

