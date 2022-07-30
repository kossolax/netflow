import { Link } from './physical.model';
import { SwitchHost } from '../node.model';
import { catchError, take, timeout, delay } from 'rxjs';
import { SimpleListener } from '../protocols/protocols.model';
import { MacAddress } from '../address.model';
import { SchedulerService, SchedulerState } from 'src/app/services/scheduler.service';

describe('Datalink layer test', () => {
  let A: SwitchHost;
  let B: SwitchHost;
  let C: SwitchHost;
  let listener: SimpleListener;

  beforeEach(async () => {
    A = new SwitchHost("A", 1);
    A.getInterfaces().map( i => {
      A.getInterface(i).up();
    });

    B = new SwitchHost("B", 2);
    B.getInterfaces().map( i => {
      B.getInterface(i).up();
    });

    C = new SwitchHost("C", 1);
    C.getInterfaces().map( i => {
      C.getInterface(i).up();
    });


    listener = new SimpleListener();
    SchedulerService.Instance.Speed = SchedulerState.FASTER;
  });

  it( 'L2 (down) -> L2', () => {
    let link1 = new Link(A.getInterface(0), C.getInterface(0), 100);


    const message = `${link1} ${Math.random()}`;
    const mac = C.getInterface(0).getMacAddress();

    A.getInterface(0).down();
    expect( () => A.send(message, mac) ).toThrow();
  });

  it( 'L2 -> (down) L2', (done) => {
    let link1 = new Link(A.getInterface(0), C.getInterface(0), 1);


    const message = `${link1} ${Math.random()}`;
    const mac = C.getInterface(0).getMacAddress();

    C.getInterface(0).down();
    A.send(message, mac);

    C.receiveTrame$.pipe(
      take(1),
      timeout(1000),
      catchError( async () => { })
    ).subscribe( msg => {
      expect(msg).toBeUndefined();
      done();
    });
  });

  it( 'L2 -> none', (done) => {

    const message = `${Math.random()}`;
    const mac = MacAddress.generateBroadcast();
    A.send(message, mac);

    C.receiveTrame$.pipe(
      take(1),
      timeout(500),
      catchError( async () => { })
    ).subscribe( msg => {
      expect(msg).toBeUndefined();
      done();
    });
  });

  it( 'L2 <- (loopback) ', (done) => {
    let link1 = new Link(A.getInterface(0), C.getInterface(0), 100);

    const message = `${link1} ${Math.random()}`;

    A.getInterface(0).addListener(listener);

    listener.receiveBits$.subscribe( msg => {
      throw new Error("Should not receive bit");
    });

    A.receiveTrame$.pipe(
      take(1),
      delay(500)
    ).subscribe( msg => {
      expect(msg.mac_src).toEqual(A.getInterface(0).getMacAddress());
      expect(msg.mac_dst).toEqual(A.getInterface(0).getMacAddress());
      expect(msg.payload).toBe(message);
      done();
    });


    A.send(message, A.getInterface(0).getMacAddress());

  });

  it( 'L2 -> L2', (done) => {
    let link1 = new Link(A.getInterface(0), C.getInterface(0), 100);

    const message = `${link1} ${Math.random()}`;
    A.send(message, C.getInterface(0).getMacAddress());
    C.receiveTrame$.pipe(
      take(1)
    ).subscribe( msg => {
      expect(msg.mac_src).toEqual(A.getInterface(0).getMacAddress());
      expect(msg.mac_dst).toEqual(C.getInterface(0).getMacAddress());
      expect(msg.payload).toBe(message);
      done();
    });
  });

  it( 'L2 -> L2 -> L2', (done) => {
    let link1 = new Link(A.getInterface(0), B.getInterface(0), 10);
    let link2 = new Link(B.getInterface(1), C.getInterface(0), 10);

    const message = `${link1} <--> ${link2} ${Math.random()}`;
    A.send(message, C.getInterface(0).getMacAddress());
    C.receiveTrame$.pipe(
      take(1)
    ).subscribe( msg => {
      expect(msg.mac_src).toEqual(A.getInterface(0).getMacAddress());
      expect(msg.mac_dst).toEqual(C.getInterface(0).getMacAddress());
      expect(msg.payload).toBe(message);
      done();
    });
  });

  it( 'L2 MacAddress function ', () => {

    const mac1 = A.getInterface(0).getMacAddress();
    const mac2 = MacAddress.generateAddress();

    expect(A.getInterface(0).hasMacAddress(mac1)).toBe(true);
    expect(A.getInterface(0).hasMacAddress(MacAddress.generateBroadcast())).toBe(true);
    expect(A.getInterface(0).hasMacAddress(mac2)).toBe(mac1.equals(mac2));

    A.getInterface(0).setMacAddress(mac2);
    expect(A.getInterface(0).hasMacAddress(mac2)).toBe(true);

  });

  it( 'L2 link function ', () => {
    let link1 = new Link(A.getInterface(0), B.getInterface(0), 100);
    let link2 = new Link(B.getInterface(1), C.getInterface(0), 100);

    expect(A.getInterface(0).isConnectedTo(link1)).toBe(true);
    expect(B.getInterface(0).isConnectedTo(link1)).toBe(true);
    expect(B.getInterface(1).isConnectedTo(link2)).toBe(true);
    expect(C.getInterface(0).isConnectedTo(link2)).toBe(true);
    expect(A.getInterface(0).isConnectedTo(link2)).toBe(false);

    expect( () => new Link(A.getInterface(0), C.getInterface(0), 100) ).toThrow();
    expect( () => new Link(A.getInterface(0), B.getInterface(0), 100) ).toThrow();
    expect( () => new Link(B.getInterface(0), B.getInterface(0), 100) ).toThrow();
    expect( () => new Link(B.getInterface(0), B.getInterface(1), 100) ).toThrow();
    expect( () => new Link(B.getInterface(2), B.getInterface(3), 100) ).toThrow();

    expect( () => A.getInterface(0).connectTo(link1) ).toThrow();
    expect( () => A.getInterface(0).connectTo(link2) ).toThrow();
  });

  it( 'L2 speed function ', () => {
    let tmp = 10;

    expect( () => A.getInterface(0).Speed = tmp ).toThrow();
    expect( A.getInterface(0).Speed ).toBe(0);

    let link1 = new Link(A.getInterface(0), B.getInterface(0), 100);
    expect( () => A.getInterface(0).Speed = 42 ).toThrow();

    [0, 10, 100, 1000].map( speed => {
      A.getInterface(0).Speed = speed;
      expect( A.getInterface(0).Speed ).toBe(speed);
    });
  });

  it( 'L2 other function ', () => {
    expect(A.getInterface(0).Host).toEqual(A);
    expect( () => A.getInterface(2) ).toThrow();
  });

});
