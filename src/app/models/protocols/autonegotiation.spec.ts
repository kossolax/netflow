import { take, bufferCount, switchMap, tap, pipe, map, delay } from "rxjs";
import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { EthernetInterface } from "../layers/datalink.model";
import { Link } from "../layers/physical.model";
import { SwitchHost } from "../node.model";
import { AdvancedTechnologyField, AutonegotiationMessage, TechnologyField } from "./autonegotiation.model";
import { SimpleListener } from "./protocols.model";

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
      expect(msg[0][0].payload).toBeInstanceOf(AutonegotiationMessage);
      expect(msg[0][1].payload).toBeInstanceOf(AutonegotiationMessage);
      expect(msg[1][0].payload).toBeInstanceOf(AutonegotiationMessage);
      expect(msg[1][1].payload).toBeInstanceOf(AutonegotiationMessage);
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
      expect(msg[0].payload).toBeInstanceOf(AutonegotiationMessage);
      expect(msg[1].payload).toBeInstanceOf(AutonegotiationMessage);
      done();
    });
  });

  function TOAST(speed: number, duplex: boolean, bits: number) {
    return pipe(
      switchMap( _ => {
        (A.getInterface(0) as EthernetInterface).reconfigure(speed, speed, duplex);
        (B.getInterface(0) as EthernetInterface).reconfigure(speed, speed, duplex);
        return listener.receiveBits$;
      }),
      bufferCount(speed >= 1000 ? 2 : 1),
      bufferCount(2),
      map( msg => {
        if( (msg[0][0].payload as AutonegotiationMessage).code.acknowledge )
          return msg[1];
        return msg[0];
      }),
      take(1),
      tap( msg => {
        for(let i=0; i<msg.length; i++) {
          expect(msg[i].payload).toBeInstanceOf(AutonegotiationMessage);
          expect((msg[i].payload as AutonegotiationMessage).code.acknowledge).toBeFalse();

          if( i !== msg.length-1 ) {
            expect((msg[i].payload as AutonegotiationMessage).code.technologyField).toBe( 0 );
            expect((msg[i].payload as AutonegotiationMessage).code.nextPage).toBe( true );
          }
          else {
            expect((msg[i].payload as AutonegotiationMessage).code.technologyField).toBe( bits );
            expect((msg[i].payload as AutonegotiationMessage).code.nextPage).toBe( false );
          }
        }
      }),
    )
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
    ).subscribe( () => {
      done();
    })
  });


  it( 'Auto-Negociate L1 --> none ', () => {

    expect( () => {
      const l1 = new Link(A.getInterface(1), null, 1000);
    }).toThrow();
  });

});
