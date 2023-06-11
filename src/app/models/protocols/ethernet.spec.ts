import { catchError, take, timeout } from "rxjs";
import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { Dot1QInterface, EthernetInterface } from "../layers/datalink.model";
import { Link } from "../layers/physical.model";
import { DatalinkMessage } from "../message.model";
import { Dot1QMessage, EthernetMessage, VlanMode } from "./ethernet.model";
import { SimpleListener } from "./protocols.model";
import { SwitchHost } from "../nodes/switch.model";
import { RouterHost } from "../nodes/router.model";
import { MacAddress } from "../address.model";

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

  it('builder', () => {
    const message_eth = new EthernetMessage.Builder()
      .setMacSource(new MacAddress('00:00:00:00:00:01'))
      .setMacDestination(new MacAddress('00:00:00:00:00:02'))
      .setPayload('Hello World!').build();

    const message_dot1q = new Dot1QMessage.Builder()
      .setMacSource(new MacAddress('00:00:00:00:00:01'))
      .setMacDestination(new MacAddress('00:00:00:00:00:02'))
      .setVlan(42)
      .setPayload('Hello World!').build();

    expect(message_eth.mac_src.equals(new MacAddress('00:00:00:00:00:01'))).toBeTrue();
    expect(message_eth.mac_dst?.equals(new MacAddress('00:00:00:00:00:02'))).toBeTrue();
    expect(message_eth.payload).toBe('Hello World!');
    expect(message_eth.toString()).toContain('Ethernet');

    expect(message_dot1q.mac_src.equals(new MacAddress('00:00:00:00:00:01'))).toBeTrue();
    expect(message_dot1q.mac_dst?.equals(new MacAddress('00:00:00:00:00:02'))).toBeTrue();
    expect(message_dot1q.payload).toBe('Hello World!');
    expect(message_dot1q.vlan_id).toBe(42);
    expect(message_dot1q.toString()).toContain('Dot1Q');

    A.getInterface(0).setMacAddress(new MacAddress('00:00:00:00:00:01'));
    B.getInterface(0).setMacAddress(new MacAddress('00:00:00:00:00:02'));

    expect(message_eth.IsReadyAtEndPoint(A.getInterface(0))).toBeFalse();
    expect(message_eth.IsReadyAtEndPoint(B.getInterface(0))).toBeTrue();
    expect(message_dot1q.IsReadyAtEndPoint(A.getInterface(0))).toBeFalse();
    expect(message_dot1q.IsReadyAtEndPoint(B.getInterface(0))).toBeTrue();

    expect( () => new EthernetMessage.Builder().setPayload('Hello World!').setMacSource(new MacAddress('00:00:00:00:00:01')).build()).toThrowError();
    expect( () => new EthernetMessage.Builder().setPayload('Hello World!').setMacDestination(new MacAddress('00:00:00:00:00:01')).build()).toThrowError();

    expect( () => new Dot1QMessage.Builder().setPayload('Hello World!').setMacSource(new MacAddress('00:00:00:00:00:01')).build()).toThrowError();
    expect( () => new Dot1QMessage.Builder().setPayload('Hello World!').setMacDestination(new MacAddress('00:00:00:00:00:01')).build()).toThrowError();

  });

});
