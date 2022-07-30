import { take, delay, bufferCount, switchMap } from "rxjs";
import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { EthernetInterface } from "../layers/datalink.model";
import { Link } from "../layers/physical.model";
import { SwitchHost } from "../node.model";
import { AutonegotiationMessage, AutoNegotiationProtocol, TechnologyField } from "./autonegotiation.model";
import { SimpleListener } from "./protocols.model";

describe('AutoNegotiation Protocol test', () => {
  let A: SwitchHost;
  let B: SwitchHost;

  let listener: SimpleListener;

  beforeEach(async () => {
    A = new SwitchHost();
    A.name = "A";
    A.addInterface().up();

    B = new SwitchHost();
    B.name = "B";
    B.addInterface().up();

    listener = new SimpleListener();
    SchedulerService.Instance.Speed = SchedulerState.FASTER;
  });

  it( 'On cable connects', (done) => {

    B.getInterface(0).addListener(listener);
    let AB = new Link(A.getInterface(0), B.getInterface(0));

    listener.receiveBits$.pipe(
      bufferCount(2),
      take(1),
    ).subscribe( msg => {
      expect(msg[0].payload).toBeInstanceOf(AutonegotiationMessage);
      expect(msg[1].payload).toBeInstanceOf(AutonegotiationMessage);
      done();
    });

  });

  it( 'On cable goes UP', (done) => {

    B.getInterface(0).addListener(listener);
    let AB = new Link(A.getInterface(0), B.getInterface(0));

    listener.receiveBits$.pipe(
      bufferCount(2),
      take(1),
      delay(100),
      switchMap( _ => {
        A.getInterface(0).down();
        A.getInterface(0).up();
        return listener.receiveBits$;
      }),
      bufferCount(2),
      take(1),
    ).subscribe( msg => {
      expect(msg[0].payload).toBeInstanceOf(AutonegotiationMessage);
      expect(msg[1].payload).toBeInstanceOf(AutonegotiationMessage);
      done();
    });

  });

  it( 'Reconfigure to 100 half-duplex', (done) => {

    B.getInterface(0).addListener(listener);
    let AB = new Link(A.getInterface(0), B.getInterface(0));

    listener.receiveBits$.pipe(
      bufferCount(2),
      take(1),
      delay(100),
      switchMap( _ => {
        (A.getInterface(0) as EthernetInterface).reconfigure(100, 100, false);
        return listener.receiveBits$;
      }),
      take(1)
    ).subscribe( msg => {
      expect(msg.payload).toBeInstanceOf(AutonegotiationMessage);
      expect((msg.payload as AutonegotiationMessage).code.nextPage).toBe(false);

      const techno = (msg.payload as AutonegotiationMessage).code.technologyField as TechnologyField;

      expect(techno & TechnologyField.A10BaseT).toBe(0);
      expect(techno & TechnologyField.A100BaseT4).toBe(0);
      expect(techno & TechnologyField.A100BaseTX).toBe(TechnologyField.A100BaseTX);

      expect(techno & TechnologyField.A10BaseT_FullDuplex).toBe(0);
      expect(techno & TechnologyField.A100BaseTX_FullDuplex).toBe(0);
      done();
    });

  });

});
