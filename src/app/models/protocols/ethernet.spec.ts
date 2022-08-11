import { catchError, take, timeout } from "rxjs";
import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { Dot1QInterface, EthernetInterface } from "../layers/datalink.model";
import { Link } from "../layers/physical.model";
import { DatalinkMessage } from "../message.model";
import { RouterHost, SwitchHost } from "../node.model";
import { Dot1QMessage, EthernetMessage, VlanMode } from "./ethernet.model";
import { SimpleListener } from "./protocols.model";

describe('Ethernet protocol', () => {
  let A: SwitchHost;
  let B: SwitchHost;
  let C: SwitchHost;
  let D: RouterHost;

  let AB: Link;
  let BC: Link;
  let CD: Link;

  let listener: SimpleListener;

  beforeEach(async () => {
    A = new SwitchHost();
    A.name = "A";
    A.addInterface().up();
    A.addInterface().up();


    B = new SwitchHost();
    B.name = "B";
    B.addInterface().up();
    B.addInterface().up();

    C = new SwitchHost();
    C.name = "C";
    C.addInterface().up();
    C.addInterface().up();

    D = new RouterHost();
    D.name = "D";
    D.addInterface().up();

    AB = new Link(A.getInterface(0), B.getInterface(0));
    BC = new Link(B.getInterface(1), C.getInterface(0));
    CD = new Link(C.getInterface(1), D.getInterface(0));

    listener = new SimpleListener();

    SchedulerService.Instance.Speed = SchedulerState.FASTER;
  });


  it('Switch[0]->ETH-->[0]Switch[0]-->[0]Switch', (done) => {
    C.getInterface(0).addListener(listener);

    const message = `Hello World! ${Math.random()}`;
    const trame = new DatalinkMessage(message, A.getInterface(0).getMacAddress(), C.getInterface(0).getMacAddress());

    A.send(trame);

    listener.receiveTrame$.pipe(
      take(1),
    ).subscribe(packet => {
      expect(packet.payload).toBe(message);
      done();
    });
  });
  it('Switch[0]->ETH-->[1]Switch[1]-->[1]Switch', (done) => {
    C.getInterface(0).addListener(listener);

    const message = `Hello World! ${Math.random()}`;
    const trame = new DatalinkMessage(message, A.getInterface(0).getMacAddress(), C.getInterface(0).getMacAddress());

    (B.getInterface(0) as Dot1QInterface).addVlan(1);
    (B.getInterface(1) as Dot1QInterface).addVlan(1);
    (C.getInterface(0) as Dot1QInterface).addVlan(1);

    A.send(trame);
    listener.receiveTrame$.pipe(
      take(1),
    ).subscribe(packet => {
      expect(packet.payload).toBe(message);
      done();
    });
  });
  it('Switch[0]->DOT1Q-->[1]Switch[1]-->[1]Switch', (done) => {
    C.getInterface(0).addListener(listener);

    const message = `Hello World! ${Math.random()}`;
    const trame = new DatalinkMessage(message, A.getInterface(0).getMacAddress(), C.getInterface(0).getMacAddress());

    (A.getInterface(0) as Dot1QInterface).VlanMode = VlanMode.Trunk;
    (B.getInterface(0) as Dot1QInterface).addVlan(1);
    (B.getInterface(0) as Dot1QInterface).VlanMode = VlanMode.Trunk;
    (B.getInterface(1) as Dot1QInterface).addVlan(1);
    (B.getInterface(1) as Dot1QInterface).VlanMode = VlanMode.Trunk;
    (C.getInterface(0) as Dot1QInterface).addVlan(1);
    (C.getInterface(1) as Dot1QInterface).VlanMode = VlanMode.Trunk;

    A.send(trame);
    listener.receiveTrame$.pipe(
      take(1),
      timeout(1000),
      catchError( async () => { })
    ).subscribe(packet => {
      expect(packet).toBeUndefined();
      done();
    });
  });
  it('Switch[0]->ETH-->[0]Switch[1]-->[1]Switch', (done) => {
    C.getInterface(0).addListener(listener);

    const message = `Hello World! ${Math.random()}`;
    const trame = new DatalinkMessage(message, A.getInterface(0).getMacAddress(), C.getInterface(0).getMacAddress());

    (B.getInterface(1) as Dot1QInterface).addVlan(1);
    (C.getInterface(0) as Dot1QInterface).addVlan(1);

    A.send(trame);
    listener.receiveTrame$.pipe(
      take(1),
      timeout(1000),
      catchError( async () => { })
    ).subscribe(packet => {
      expect(packet).toBeUndefined();
      done();
    });
  });

  it('Router->ETH-->[0]Switch[0]-->[0]Switch[0]..>[0]Switch', (done) => {
    B.getInterface(1).addListener(listener);

    const message = `Hello World! ${Math.random()}`;
    const trame = new DatalinkMessage(message, D.getInterface(0).getMacAddress(), A.getInterface(0).getMacAddress());

    D.getInterface(0).sendTrame(trame);

    listener.receiveTrame$.pipe(
      take(1),
    ).subscribe(packet => {
      expect(packet.payload).toBe(message);
      expect(packet).not.toBeInstanceOf(Dot1QMessage);
      expect(packet).toBeInstanceOf(EthernetMessage);
      done();
    });
  });
  it('Router->ETH-->[0]Switch[1]-->[1]Switch', (done) => {
    B.getInterface(1).addListener(listener);

    const message = `Hello World! ${Math.random()}`;
    const trame = new DatalinkMessage(message, D.getInterface(0).getMacAddress(), B.getInterface(0).getMacAddress());

    (C.getInterface(0) as Dot1QInterface).addVlan(1);
    (B.getInterface(1) as Dot1QInterface).addVlan(1);

    D.getInterface(0).sendTrame(trame);

    listener.receiveTrame$.pipe(
      take(1),
      timeout(1000),
      catchError( async () => { })
    ).subscribe(packet => {
      expect(packet).toBeUndefined();
      done();
    });
  });
  it('Router-Eth->[0]Switch[0]-->[0]Switch', (done) => {
    B.getInterface(1).addListener(listener);

    const message = `Hello World! ${Math.random()}`;
    const trame = new DatalinkMessage(message, D.getInterface(0).getMacAddress(), B.getInterface(0).getMacAddress());

    D.getInterface(0).sendTrame(trame);

    listener.receiveTrame$.pipe(
      take(1),
    ).subscribe(packet => {
      expect(packet.payload).toBe(message);
      expect(packet).not.toBeInstanceOf(Dot1QMessage);
      expect(packet).toBeInstanceOf(EthernetMessage);
      done();
    });
  });

});
