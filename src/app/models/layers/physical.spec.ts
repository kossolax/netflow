import { catchError, take, timeout } from "rxjs";
import { MacAddress } from "../address.model";
import { PhysicalMessage } from "../message.model";
import { SwitchHost } from "../node.model";
import { SimpleListener } from "../protocols/protocols.model";
import { EthernetInterface, HardwareInterface } from "./datalink.model";
import { Link } from "./physical.model";

describe('Physical layer test', () => {
  let A: HardwareInterface;
  let B: HardwareInterface;

  let listener: SimpleListener;

  beforeEach(async () => {
    A = new EthernetInterface(new SwitchHost(), MacAddress.generateAddress());
    B = new EthernetInterface(new SwitchHost(), MacAddress.generateAddress());

    A.up();
    B.up();

    listener = new SimpleListener();
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
      link1.Speed = speed;
      speeds.push({
        propagation: link1.getPropagationDelay(),
        transmission: link1.getTransmissionDelay(42)
      });
    });

    expect( () => link1.Speed = 42 ).toThrow();

    // propagation is constant
    expect(speeds[0].propagation).toBe(speeds[1].propagation);
    expect(speeds[1].propagation).toBe(speeds[2].propagation);
    expect(speeds[2].propagation).toBe(speeds[3].propagation);

    // tranmission goes faster as speed goes up
    expect(speeds[1].transmission).toBeGreaterThan(speeds[2].transmission);
    expect(speeds[2].transmission).toBeGreaterThan(speeds[3].transmission);

    // tranmission is longer as bytes goes up
    A.Speed = 10;
    expect(link1.getTransmissionDelay(1000)).toBeGreaterThan(link1.getTransmissionDelay(100));
    expect(link1.getTransmissionDelay(10000)).toBeGreaterThan(link1.getTransmissionDelay(10));
  });

});

