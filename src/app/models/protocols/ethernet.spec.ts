import { catchError, take, timeout } from "rxjs";
import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { Dot1QInterface, EthernetInterface } from "../layers/datalink.model";
import { Link } from "../layers/physical.model";
import { DatalinkMessage } from "../message.model";
import { SwitchHost } from "../node.model";
import { SimpleListener } from "./protocols.model";

describe('Ethernet protocol', () => {
  let A: SwitchHost;
  let B: SwitchHost;
  let C: SwitchHost;
  let AB: Link;
  let BC: Link;

  let listener: SimpleListener;

  beforeEach(async () => {
    A = new SwitchHost();
    A.name = "A";
    A.addInterface().up();


    B = new SwitchHost();
    B.name = "B";
    B.addInterface().up();
    B.addInterface().up();

    C = new SwitchHost();
    C.name = "B";
    C.addInterface().up();

    AB = new Link(A.getInterface(0), B.getInterface(0));
    BC = new Link(B.getInterface(1), C.getInterface(0));

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

});
