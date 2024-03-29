import { Link } from './physical.model';
import { delay, take, timeout, catchError } from 'rxjs';
import { SimpleListener } from '../protocols/protocols.model';
import { IPAddress, MacAddress } from '../address.model';
import { SchedulerService, SchedulerState } from 'src/app/services/scheduler.service';
import { RouterHost } from '../nodes/router.model';
import { SwitchHost } from '../nodes/switch.model';

describe('Network layer test', () => {
  let A: RouterHost;
  let B: SwitchHost;
  let C: RouterHost;
  let listener: SimpleListener;

  beforeEach(async () => {
    A = new RouterHost();
    A.name = "A";
    A.addInterface().up();

    B = new SwitchHost();
    B.name = "B";
    B.addInterface().up();
    B.addInterface().up();

    C = new RouterHost();
    C.name = "C";
    C.addInterface().up();


    listener = new SimpleListener();
    SchedulerService.Instance.Speed = SchedulerState.FASTER;
  });

  it( 'L3 (down) -> L3', () => {
    let link1 = new Link(A.getInterface(0), C.getInterface(0), 100);


    const message = `${link1} ${Math.random()}`;
    const dst = C.getInterface(0).getNetAddress();

    A.getInterface(0).down();
    expect( () => A.send(message, dst) ).toThrow();
  });

  it( 'L3 -> (down) L3', (done) => {
    let link1 = new Link(A.getInterface(0), C.getInterface(0), 1);


    const message = `${link1} ${Math.random()}`;
    const dst = C.getInterface(0).getNetAddress();

    C.getInterface(0).down();
    A.send(message, dst);

    C.receivePacket$.pipe(
      take(1),
      timeout(1000),
      catchError( async () => { })
    ).subscribe( msg => {
      expect(msg).toBeUndefined();
      done();
    });
  });

  it( 'L3 <- (loopback) ', (done) => {
    let link1 = new Link(A.getInterface(0), C.getInterface(0), 100);

    const message = `${link1} ${Math.random()}`;

    A.getInterface(0).addListener(listener);
    A.getInterface(0).addListener(listener);

    listener.receiveBits$.subscribe( msg => {
      throw new Error("Should not receive bit");
    });
    listener.receiveTrame$.subscribe( msg => {
      throw new Error("Should not receive trame");
    });

    A.receivePacket$.pipe(
      take(1),
      delay(500)
    ).subscribe( msg => {
      expect(msg.net_src).toEqual(A.getInterface(0).getNetAddress());
      expect(msg.net_dst).toEqual(A.getInterface(0).getNetAddress());
      expect(msg.payload).toBe(message);
      done();
    });


    A.send(message, A.getInterface(0).getNetAddress());

  });

  it( 'L3 -> L3', (done) => {
    let link1 = new Link(A.getInterface(0), C.getInterface(0), 100);

    const message = `Hello World: ${Math.random()}`;
    A.send(message, C.getInterface(0).getNetAddress());
    C.receivePacket$.pipe(
      take(1)
    ).subscribe( msg => {
      expect(msg.net_src).toEqual(A.getInterface(0).getNetAddress());
      expect(msg.net_dst).toEqual(C.getInterface(0).getNetAddress());

      expect(msg.payload).toBe(message);
      done();
    });
  });

  it( 'L3 -> L2 -> L3', (done) => {
    let link1 = new Link(A.getInterface(0), B.getInterface(0), 100);
    let link2 = new Link(B.getInterface(1), C.getInterface(0), 100);

    const message = `Hello World: ${Math.random()}`;
    A.send(message, C.getInterface(0).getNetAddress());
    C.receivePacket$.pipe(
      take(1)
    ).subscribe( msg => {
      expect(msg.net_src).toEqual(A.getInterface(0).getNetAddress());
      expect(msg.net_dst).toEqual(C.getInterface(0).getNetAddress());

      expect(msg.payload).toBe(message);
      done();
    });

  });

  it( 'L3 MacAddress function ', () => {

    const mac1 = A.getInterface(0).getMacAddress();
    const mac2 = MacAddress.generateAddress();

    expect(A.getInterface(0).getMacAddress()).toEqual(mac1);

    A.getInterface(0).setMacAddress(mac2);
    expect(A.getInterface(0).getMacAddress()).toEqual(mac2);

  });

  it( 'L3 NetAddress function ', () => {

    const addr1 = A.getInterface(0).getNetAddress();
    const addr2 = IPAddress.generateAddress();

    expect(A.getInterface(0).hasNetAddress(addr1)).toBe(true);
    expect(A.getInterface(0).hasNetAddress(IPAddress.generateBroadcast())).toBe(true);
    expect(A.getInterface(0).hasNetAddress(addr2)).toBe(addr1.equals(addr2));

    expect( () => A.getInterface(0).addNetAddress(addr1)).toThrow();
    expect( () => A.getInterface(0).addNetAddress(IPAddress.generateBroadcast())).toThrow();

    A.getInterface(0).setNetAddress(addr2);
    expect(A.getInterface(0).hasNetAddress(addr2)).toBe(true);

    const mask = new IPAddress("255.0.0.0", true);
    A.getInterface(0).setNetMask(mask);
    expect(A.getInterface(0).getNetMask()).toEqual(new IPAddress("255.0.0.0", true))

    expect( () => A.getInterface(0).setNetAddress(mask)).toThrow();
    expect( () => A.getInterface(0).setNetMask(new IPAddress("255.0.255.0", true))).toThrow();
    expect( () => A.getInterface(0).setNetMask(new IPAddress("255.0.255.0"))).toThrow();
  });

  it( 'L3 speed function ', () => {

    let link1 = new Link(A.getInterface(0), B.getInterface(0), 100);
    expect( () => A.getInterface(0).Speed = 42 ).toThrow();
    expect( () => A.getInterface(0).Speed = 10000000 ).toThrow();
    expect( () => A.getInterface(0).Speed = -1 ).toThrow();
    expect( () => A.getInterface(0).Speed = -10 ).toThrow();

    [10, 100, 1000].map( speed => {
      A.getInterface(0).Speed = speed;
      expect( A.getInterface(0).Speed ).toBe(speed);
    });

  });

  it('L3 other functions', () => {
    expect(A.getInterface(0).isConnected).toBe(false);

    let link1 = new Link(A.getInterface(0), B.getInterface(0), 100);
    expect(A.getInterface(0).isConnected).toBe(true);
  });
});
