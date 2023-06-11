import { buffer, bufferCount, catchError, generate, mergeMap, of, switchMap, take, tap, timeout } from "rxjs";
import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { MacAddress } from "../address.model";
import { PhysicalMessage } from "../message.model";
import { SimpleListener } from "../protocols/protocols.model";
import { EthernetInterface, HardwareInterface } from "./datalink.model";
import { Link } from "./physical.model";
import { SwitchHost } from "../nodes/switch.model";

describe('Physical layer test', () => {
  let A: HardwareInterface;
  let B: HardwareInterface;

  let listener: SimpleListener;

  beforeEach(async () => {
    A = new EthernetInterface(new SwitchHost(), MacAddress.generateAddress(), "Ethernet0/0", 0, 1000, true, false);
    B = new EthernetInterface(new SwitchHost(), MacAddress.generateAddress(), "Ethernet0/0", 0, 1000, true, false);

    A.up();
    B.up();

    listener = new SimpleListener();
    SchedulerService.Instance.Speed = SchedulerState.FASTER;
  });

  it("L1 -> L1", (done) => {
    const l1 = new Link(A, B, 1000);
    B.addListener(listener);

    const message = `Hello World: ${Math.random()}`;

    l1.sendBits(new PhysicalMessage(message), A);
    listener.receiveBits$.pipe(
      take(1)
    ).subscribe( msg => {
      expect(msg.payload).toBe(message);
      done();
    });

  });

  it("L1 queuing", (done) => {
    SchedulerService.Instance.Speed = SchedulerState.REAL_TIME;

    const l1 = new Link(A, B, 1000);
    B.addListener(listener);

    const messages: string[] = [];
    const toSend = 10;

    for(let i=0; i<toSend; i++) {
      messages.push(`Hello World: ${Math.random()}`);
      l1.sendBits(new PhysicalMessage(messages[i]), A);
    }

    listener.receiveBits$.pipe(
      take(toSend)
    ).subscribe( msg => {
      expect(msg.payload).toBe( messages.shift() as string);

      if( messages.length == 0 )
        done();
    });

  });

  it("L1 full duplex should be faster than half duplex", (done) => {
    SchedulerService.Instance.Speed = SchedulerState.REAL_TIME;

    const l1 = new Link(A, B, 1000 * 1000 * 1000);
    l1.addListener(listener);

    const toSend = 100;
    const payloadSize = 10 * 1024 * 1024;
    const payload = new PhysicalMessage("A".repeat(payloadSize));

    const send = (duplex:boolean): void => {
      A.FullDuplex = duplex;
      B.FullDuplex = duplex;

      for(let i=0; i<toSend; i++)
        l1.sendBits(payload, Math.random() > 0.5 ? A : B);
    };

    let start = Date.now(), mid=0, end=0;

    send(false);
    listener.receiveBits$.pipe(
      bufferCount(toSend),
      take(1),
      switchMap( () => {
        mid = Date.now()
        send(true);
        return listener.receiveBits$;
      }),
      bufferCount(toSend),
      take(1),
      tap( () => end = Date.now() ),
    ).subscribe( _ => {
      const half = mid - start;
      const full = end - mid;
      const ratio = half / full;
      expect(half).toBeGreaterThan(full);
      expect(ratio).toBeGreaterThan(1.5);
      done();
    });
  });

  it("L1 -> none", () => {
    const l1 = new Link(A, null, 1000);
    B.addListener(listener);

    const message = `Hello World: ${Math.random()}`;
    expect( () => l1.sendBits(new PhysicalMessage(message), A) ).toThrow();

    expect(l1.getInterface(0)).toEqual(A);
    expect(l1.getInterface(1)).toBeNull();
    expect(() => l1.getInterface(2) ).toThrow();
  });

  it( 'L1 speed function ', () => {
    let link1 = new Link(A, B, 100);
    const speeds: {propagation: number, transmission: number}[] = [];

    [0, 10, 100, 1000].map( speed => {
      speeds.push({
        propagation: link1.getPropagationDelay(),
        transmission: link1.getTransmissionDelay(42, speed),
      });
    });

    SchedulerService.Instance.Speed = SchedulerState.REAL_TIME;

    // propagation is constant
    expect(speeds[0].propagation).toBe(speeds[1].propagation);
    expect(speeds[1].propagation).toBe(speeds[2].propagation);
    expect(speeds[2].propagation).toBe(speeds[3].propagation);

    // tranmission goes faster as speed goes up
    expect(speeds[1].transmission).toBeGreaterThan(speeds[2].transmission);
    expect(speeds[2].transmission).toBeGreaterThan(speeds[3].transmission);

    // tranmission is longer as bytes goes up
    A.Speed = 10;
    expect(link1.getTransmissionDelay(1000, 100)).toBeGreaterThan(link1.getTransmissionDelay(100, 100));
    expect(link1.getTransmissionDelay(10000, 100)).toBeGreaterThan(link1.getTransmissionDelay(10, 100));

    SchedulerService.Instance.Speed = SchedulerState.FASTER;
    const fast = link1.getDelay(1000, 100);
    SchedulerService.Instance.Speed = SchedulerState.REAL_TIME;
    const real = link1.getDelay(1000, 100);
    SchedulerService.Instance.Speed = SchedulerState.SLOWER;
    const slow = link1.getDelay(1000, 100);
    SchedulerService.Instance.Speed = SchedulerState.PAUSED;
    const paused = link1.getDelay(1000, 100);
    SchedulerService.Instance.Speed = SchedulerState.FASTER;

    expect(fast).toBeLessThan(real);
    expect(real).toBeLessThan(slow);
    expect(slow).toBeLessThan(paused);


  });

});

