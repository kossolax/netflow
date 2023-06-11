import { take, bufferCount, switchMap, tap, pipe, map, delay, Observable, UnaryFunction, catchError, TimeoutError, timeout } from "rxjs";
import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { EthernetInterface } from "../layers/datalink.model";
import { Link } from "../layers/physical.model";
import { Message, PhysicalMessage } from "../message.model";
import { AdvancedTechnologyField, AutonegotiationMessage, TechnologyField } from "./autonegotiation.model";
import { SimpleListener } from "./protocols.model";
import { SwitchHost } from "../nodes/switch.model";
import { time } from "console";

describe('AutoNegotiation Protocol test', () => {
  let A: SwitchHost;
  let B: SwitchHost;
  let AB: Link;

  let listener: SimpleListener;

  beforeEach(async () => {
    A = new SwitchHost();
    A.name = "A";
    A.addInterface().up();
    A.addInterface().up();

    B = new SwitchHost();
    B.name = "B";
    B.addInterface().up();

    AB = new Link(A.getInterface(0), B.getInterface(0));

    listener = new SimpleListener();
    SchedulerService.Instance.Speed = SchedulerState.FASTER;
  });

  it( 'On cable connects', (done) => {
    B.getInterface(0).addListener(listener);

    listener.receiveBits$.pipe(
      bufferCount(2),
      bufferCount(2),
      take(1),
    ).subscribe( msg => {
      expect(msg[0][0]).toBeInstanceOf(AutonegotiationMessage);
      expect(msg[0][1]).toBeInstanceOf(AutonegotiationMessage);
      expect(msg[1][0]).toBeInstanceOf(AutonegotiationMessage);
      expect(msg[1][1]).toBeInstanceOf(AutonegotiationMessage);
      done();
    });
  });

  it( 'On cable goes UP', (done) => {
    B.getInterface(0).addListener(listener);

    listener.receiveBits$.pipe(
      bufferCount(2),
      bufferCount(2),
      take(1),
      switchMap( _ => {
        A.getInterface(0).down();
        A.getInterface(0).up();
        return listener.receiveBits$;
      }),
      bufferCount(2),
      take(1),
    ).subscribe( msg => {
      expect(msg[0]).toBeInstanceOf(AutonegotiationMessage);
      expect(msg[1]).toBeInstanceOf(AutonegotiationMessage);
      done();
    });
  });

  function TOAST(speed: number, duplex: boolean, bits: number): UnaryFunction<Observable<unknown>, Observable<PhysicalMessage[]>> {
    return pipe(
      switchMap(_ => {
        (A.getInterface(0) as EthernetInterface).reconfigure(speed, speed, duplex);
        (B.getInterface(0) as EthernetInterface).reconfigure(speed, speed, duplex);
        return listener.receiveBits$;
      }),
      bufferCount(speed >= 1000 ? 2 : 1),
      bufferCount(2),
      map(msg => {
        if ((msg[0][0] as AutonegotiationMessage).payload.acknowledge)
          return msg[1];
        return msg[0];
      }),
      take(1),
      tap(msg => {
        for (let i = 0; i < msg.length; i++) {
          expect(msg[i]).toBeInstanceOf(AutonegotiationMessage);
          expect((msg[i] as AutonegotiationMessage).payload.acknowledge).toBeFalse();

          if (i !== msg.length - 1) {
            expect((msg[i] as AutonegotiationMessage).payload.technologyField).toBe(0);
            expect((msg[i] as AutonegotiationMessage).payload.nextPage).toBe(true);
          }
          else {
            expect((msg[i] as AutonegotiationMessage).payload.technologyField).toBe(bits);
            expect((msg[i] as AutonegotiationMessage).payload.nextPage).toBe(false);
          }
        }

        expect(A.getInterface(0).Speed).toBe(speed);
        expect(B.getInterface(0).Speed).toBe(speed);
      })
    );
  }

  it( 'Reconfigure both interfaces to different same speeds', (done) => {

    B.getInterface(0).addListener(listener);

    listener.receiveBits$.pipe(
      bufferCount(2),
      bufferCount(2),
      take(1),

      TOAST(10, false, TechnologyField.A10BaseT),
      TOAST(10, true, TechnologyField.A10BaseT | TechnologyField.A10BaseT_FullDuplex ),

      TOAST(100, false, TechnologyField.A100BaseTX),
      TOAST(100, true, TechnologyField.A100BaseTX | TechnologyField.A100BaseTX_FullDuplex ),

      TOAST(1000, false, AdvancedTechnologyField.A1000BaseT | AdvancedTechnologyField.A1000BaseT_HalfDuplex ),
      TOAST(1000, true, AdvancedTechnologyField.A1000BaseT ),

      TOAST(2500, false, 0 ),
      catchError( err => {
        expect(err).toBeInstanceOf(TimeoutError);
        return [];
      }),
      TOAST(2500, true, 0 ),
      catchError( err => {
        expect(err).toBeInstanceOf(TimeoutError);
        return [];
      }),
    ).subscribe( () => {
      done();
    })
  });


  it( 'Auto-Negociate L1 --> none ', () => {

    expect( () => {
      const l1 = new Link(A.getInterface(1), null, 1000);
    }).toThrow();
  });

  it('builder', () => {
    const one = new AutonegotiationMessage.Builder().setMaxSpeed(100).build();
    const two = new AutonegotiationMessage.Builder().setMaxSpeed(1000).build();

    expect(one.length).toBe(1);
    expect(two.length).toBe(2);
    expect(one[0].payload.nextPage).toBe(false);
    expect(two[0].payload.nextPage).toBe(true);
    expect(one[0].toString()).toContain('AutoNegotiation');
  });

});
