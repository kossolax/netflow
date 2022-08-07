import { take, bufferCount, ignoreElements, skip } from "rxjs";
import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { IPAddress } from "../address.model";
import { IPInterface } from "../layers/network.model";
import { Link } from "../layers/physical.model";
import { RouterHost } from "../node.model";
import { ICMPMessage, ICMPType } from "./icmp.model";
import { IPv4Message } from "./ipv4.model";
import { SimpleListener } from "./protocols.model";

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
      expect(msg instanceof IPv4Message).toBeTruthy();
      expect(msg?.payload instanceof ICMPMessage).toBeTruthy();

      done();
    });

  });

  it('ICMP builder', () => {

    let msg = new ICMPMessage.Builder()
      .setMacSource(A.getInterface(0).getMacAddress())
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
      msg.setCode(16);
    }).toThrow();

    expect(msg.build().length).toBe(1);

  });

});
