import { mergeMap, Observable, Subject, switchMap, take } from "rxjs";
import { MacAddress } from "../address.model";
import { DatalinkMessage, NetworkMessage, PhysicalMessage } from "../message.model";
import { SwitchHost } from "../node.model";
import { SimpleListener } from "../protocols/protocols.model";
import { EthernetInterface, HardwareInterface, Interface } from "./datalink.model";
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
});
function as(arg0: () => void, as: any, DatalinkListener: any) {
  throw new Error("Function not implemented.");
}

function DatalinkListener(arg0: () => void, as: (arg0: () => void, as: any, DatalinkListener: any) => void, DatalinkListener: any) {
  throw new Error("Function not implemented.");
}

function receiveBits(msg: any) {
  throw new Error("Function not implemented.");
}

