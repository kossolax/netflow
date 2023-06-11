import { take, bufferCount, ignoreElements, skip } from "rxjs";
import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { IPAddress } from "../address.model";
import { IPInterface } from "../layers/network.model";
import { Link } from "../layers/physical.model";
import { ICMPMessage, ICMPType } from "./icmp.model";
import { IPv4Message } from "./ipv4.model";
import { SimpleListener } from "./protocols.model";
import { RouterHost } from "../nodes/router.model";

describe('ICMP protocol', () => {
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
    C.name = "B";
    C.addInterface().up();

    AB = new Link(A.getInterface(0), B.getInterface(0));
    BC = new Link(B.getInterface(1), C.getInterface(0));

    listener = new SimpleListener();

    SchedulerService.Instance.Speed = SchedulerState.FASTER;
  });

  it('Router->ICMP-->Router ', (done) => {

    const ipface = (A.getInterface(0) as IPInterface);

    ipface.sendIcmpRequest(B.getInterface(0).getNetAddress() as IPAddress).subscribe( msg => {
      expect(msg).not.toBeNull();
      expect(msg instanceof ICMPMessage).toBeTruthy();

      done();
    });

  });

  it('Router->ICMP-->none ', (done) => {

    const ipface = (A.getInterface(0) as IPInterface);

    ipface.sendIcmpRequest(IPAddress.generateAddress()).subscribe( msg => {
      expect(msg).toBeNull();
      done();
    });

  });

  it('ICMP builder', () => {

    let msg = new ICMPMessage.Builder()
      .setNetSource(A.getInterface(0).getNetAddress() as IPAddress)
      .setNetDestination(B.getInterface(0).getNetAddress() as IPAddress);


    expect( () => {
      msg.setType(ICMPType.EchoRequest);
      msg.setCode(1);
    }).toThrow();

    expect( () => {
      msg.setType(ICMPType.EchoReply);
      msg.setCode(1);
    }).toThrow();

    expect( () => {
      msg.setType(ICMPType.TimeExceeded);
      msg.setCode(2);
    }).toThrow();

    expect( () => {
      msg.setType(ICMPType.DestinationUnreachable);
      msg.setCode(3);
    }).not.toThrow();

    expect( () => {
      msg.setType(ICMPType.DestinationUnreachable);
      msg.setCode(16);
    }).toThrow();

    expect( () => {
      msg.setType(42 as ICMPType);
      msg.setCode(42);
    }).toThrow();

    expect(msg.build().length).toBe(1);

    expect( () => new ICMPMessage.Builder().setNetSource(IPAddress.generateAddress()).build()).toThrow();
    expect( () => new ICMPMessage.Builder().setNetDestination(IPAddress.generateAddress()).build()).toThrow();

    const request = new ICMPMessage.Builder()
      .setNetSource(A.getInterface(0).getNetAddress() as IPAddress)
      .setNetDestination(B.getInterface(0).getNetAddress() as IPAddress)
      .setType(ICMPType.EchoRequest)
      .setCode(0)
      .build()[0];
    const reply = new ICMPMessage.Builder()
      .setNetSource(B.getInterface(0).getNetAddress() as IPAddress)
      .setNetDestination(A.getInterface(0).getNetAddress() as IPAddress)
      .setType(ICMPType.EchoReply)
      .setCode(0)
      .build()[0];


    expect(request.toString()).toContain("ICMP");
    expect(request.toString()).toContain("Request");
    expect(reply.toString()).toContain("ICMP");
    expect(reply.toString()).toContain("Reply");
    expect(msg.build()[0].toString()).toContain("ICMP");
  });

});
