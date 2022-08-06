import { take, bufferCount, ignoreElements, skip } from "rxjs";
import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { IPAddress } from "../address.model";
import { Link } from "../layers/physical.model";
import { RouterHost } from "../node.model";
import { IPv4Message } from "./ipv4.model";
import { SimpleListener } from "./protocols.model";

describe('AutoNegotiation Protocol test', () => {
  let A: RouterHost;
  let B: RouterHost;
  let AB: Link;

  let listener: SimpleListener;

  beforeEach(async () => {
    A = new RouterHost();
    A.name = "A";
    A.addInterface().up();


    B = new RouterHost();
    B.name = "B";
    B.addInterface().up();

    AB = new Link(A.getInterface(0), B.getInterface(0));

    listener = new SimpleListener();

    SchedulerService.Instance.Speed = SchedulerState.FASTER;
  });

  it('Router->IPv4[1]-->Router ', (done) => {

    B.getInterface(0).addListener(listener);

    const message = `Hello World! ${Math.random()}`;

    let msg = new IPv4Message.Builder()
      .setPayload(message)
      .setMacSource(A.getInterface(0).getMacAddress())
      .setMacDestination(B.getInterface(0).getMacAddress())
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

  it('Router->IPv4[2]-->Router ', (done) => {

    B.getInterface(0).addListener(listener);

    const message = `Fragmented Packet ${Math.random()}`;

    let msg = new IPv4Message.Builder()
      .setPayload(message)
      .setMacSource(A.getInterface(0).getMacAddress())
      .setMacDestination(B.getInterface(0).getMacAddress())
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


});
