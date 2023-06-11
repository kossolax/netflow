import { bufferCount, take, tap } from "rxjs";
import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { IPAddress } from "../address.model";
import { Link } from "../layers/physical.model";
import { DatalinkMessage } from "../message.model";
import { IPv4Message } from "./ipv4.model";
import { SimpleListener } from "./protocols.model";
import { RouterHost } from "../nodes/router.model";

describe('IPv4 protocol', () => {
  let A: RouterHost;
  let B: RouterHost;
  let C: RouterHost;
  let AB: Link;
  let BC: Link;

  let listener: SimpleListener;

  beforeEach(async () => {
    A = new RouterHost();
    A.name = "A";
    A.addInterface().up();


    B = new RouterHost();
    B.name = "B";
    B.addInterface().up();
    B.addInterface().up();

    C = new RouterHost();
    C.name = "C";
    C.addInterface().up();

    AB = new Link(A.getInterface(0), B.getInterface(0));
    BC = new Link(B.getInterface(1), C.getInterface(0));

    listener = new SimpleListener();

    SchedulerService.Instance.Speed = SchedulerState.FASTER;
  });

  it('Router->IPv4-->Router ', (done) => {

    B.getInterface(0).addListener(listener);

    const message = `Hello World! ${Math.random()}`;

    let msg = new IPv4Message.Builder()
      .setPayload(message)
      .setNetSource(A.getInterface(0).getNetAddress() as IPAddress)
      .setNetDestination(B.getInterface(0).getNetAddress() as IPAddress)
      .setMaximumSize(1500)
      .build();

    expect(msg.length).toBe(1);

    A.send(msg[0]);

    listener.receivePacket$.pipe(
      take(1),
    ).subscribe(packet => {
      expect(packet instanceof IPv4Message).toBeTruthy();
      expect(packet.payload).toBe(message);
      expect((packet as IPv4Message).flags.more_fragments).toBeFalsy();

      done();
    });

  });

  it('Router->IPv4[fragmented]-->Router (should reconstruct)', (done) => {

    B.getInterface(0).addListener(listener);

    const message = `Fragmented Packet ${Math.random()}`;

    let msg = new IPv4Message.Builder()
      .setPayload(message)
      .setNetSource(A.getInterface(0).getNetAddress() as IPAddress)
      .setNetDestination(B.getInterface(0).getNetAddress() as IPAddress)
      .setMaximumSize( Math.ceil(message.length / 2) + 1)
      .build();

    expect(msg.length).toBe(2);

    msg.map( i => A.send(i));

    listener.receivePacket$.pipe(
      take(1),
    ).subscribe(packet => {

      expect(packet instanceof IPv4Message).toBeTruthy();
      expect(packet.payload).toBe(message);
      expect((packet as IPv4Message).flags.more_fragments).toBeFalsy();
      expect((packet as IPv4Message).total_length).toBe(message.length);

      done();
    });

  });

  it('Router->IPv4[fragmented]-->Router....>Router  (should not reconstruct)', (done) => {

    B.getInterface(0).addListener(listener);

    const message = `Router->IPv4[fragmented]-->Router....>Router  (should not reconstruct) ${Math.random()}`;

    let msg = new IPv4Message.Builder()
      .setPayload(message)
      .setNetSource(A.getInterface(0).getNetAddress() as IPAddress)
      .setNetDestination(C.getInterface(0).getNetAddress() as IPAddress)
      .setMaximumSize( Math.ceil(message.length / 2) + 1)
      .build();

    expect(msg.length).toBe(2);

    msg.map( i => {
      const trame = new DatalinkMessage(i, A.getInterface(0).getMacAddress(), B.getInterface(0).getMacAddress());
      A.getInterface(0).sendTrame(trame);
    });

    listener.receivePacket$.pipe(
      take(2),
      bufferCount(2),
    ).subscribe(packet => {

      expect(packet[0] instanceof IPv4Message).toBeTruthy();
      expect(packet[1] instanceof IPv4Message).toBeTruthy();

      expect(packet[0].payload).toBe(message);
      expect(packet[1].payload).toBe("");

      expect((packet[0] as IPv4Message).flags.more_fragments).toBeTruthy();
      expect((packet[1] as IPv4Message).flags.more_fragments).toBeFalsy();

      done();
    });

  })

  it('IPv4 builder', () => {
    const data = `Hello World! ${Math.random()}`;

    let msg = new IPv4Message.Builder()
      .setservice(1)
      .setPayload(data);

    expect( () => msg.setMaximumSize(65536)).toThrow();
    expect( () => msg.setMaximumSize(0)).toThrow();
    msg.setMaximumSize(1500);

    expect( () => msg.setTTL(65536)).toThrow();
    expect( () => msg.setTTL(-1)).toThrow();
    msg.setTTL(30);

    expect( () => msg.build() ).toThrow();
    msg.setNetSource(A.getInterface(0).getNetAddress() as IPAddress);
    expect( () => msg.build() ).toThrow();
    msg.setNetDestination(B.getInterface(0).getNetAddress() as IPAddress);

    expect(msg.build().length).toBe(1);
    expect(msg.build()[0].IsReadyAtEndPoint(A.getInterface(0))).toBeFalse();
    expect(msg.build()[0].IsReadyAtEndPoint(B.getInterface(0))).toBeTrue();

    msg.setMaximumSize(1);
    expect(msg.build().length).toBe(data.length);
    expect(msg.build()[0].toString()).toContain("IPv4");

  });

});
