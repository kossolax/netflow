import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { Link } from "../layers/physical.model";
import { SwitchHost } from "../node.model";
import { DatalinkListener, SimpleListener } from "../protocols/protocols.model";
import { PVSTPService, SpanningTreeMessage } from "./spanningtree.model";
import { filter, first, interval, take, tap, timeout } from "rxjs";
import { MacAddress } from "../address.model";

describe('STP protocol', () => {
  let A: SwitchHost, B: SwitchHost, C: SwitchHost, D: SwitchHost;
  let AB, BC, CA, CD: Link;
  let listener: SimpleListener;

  beforeEach(async () => {
    A = new SwitchHost("A", 2);
    A.getInterface(0).up();
    A.getInterface(1).up();
    A.spanningTree.Enable = true;

    B = new SwitchHost("B", 2);
    B.getInterface(0).up();
    B.getInterface(1).up();
    B.spanningTree.Enable = true;

    C = new SwitchHost("C", 3);
    C.getInterface(0).up();
    C.getInterface(1).up();
    C.getInterface(2).up();
    C.spanningTree.Enable = true;

    D = new SwitchHost("D", 1);
    D.getInterface(0).up();
    D.spanningTree.Enable = true;

    AB = new Link(A.getFirstAvailableInterface(), B.getFirstAvailableInterface());
    BC = new Link(B.getFirstAvailableInterface(), C.getFirstAvailableInterface());
    CA = new Link(C.getFirstAvailableInterface(), A.getFirstAvailableInterface());
    CD = new Link(C.getFirstAvailableInterface(), D.getFirstAvailableInterface());

    listener = new SimpleListener();

    SchedulerService.Instance.Speed = SchedulerState.FASTER;
  });

  it('STP Broadcast', (done) => {
    D.getInterface(0).addListener(listener);

    listener.receiveTrame$.pipe(
      take(1)
    ).subscribe(trame => {
      expect(trame.mac_src.equals(C.getInterface(2).getMacAddress())).toBeTruthy();
      expect(trame).toBeInstanceOf(SpanningTreeMessage);
      done();
    });
    A.spanningTree.negociate();
  });

  it('STP root', (done) => {
    const mac = new MacAddress("00:00:00:00:00:01");

    A.spanningTree.Enable = false;
    A.getInterface(0).setMacAddress( mac );
    A.spanningTree.Enable = true;

    expect(A.spanningTree.IsRoot).toBeTruthy();
    expect(B.spanningTree.IsRoot).toBeTruthy();
    expect(C.spanningTree.IsRoot).toBeTruthy();
    expect(D.spanningTree.IsRoot).toBeTruthy();

    interval(100).pipe(
      filter(() => A.spanningTree.Root.equals(mac) ),
      filter(() => B.spanningTree.Root.equals(mac) ),
      filter(() => C.spanningTree.Root.equals(mac) ),
      filter(() => D.spanningTree.Root.equals(mac) ),
      take(1),
      timeout(5 * 1000),
    ).subscribe( {
      next: () => {
        expect(A.spanningTree.IsRoot).toBeTruthy();
        expect(B.spanningTree.IsRoot).toBeFalsy();
        expect(C.spanningTree.IsRoot).toBeFalsy();
        expect(D.spanningTree.IsRoot).toBeFalsy();
        done();
      },
      error: (err) => {
        done.fail("Root not found in time");
      },
    });


    A.spanningTree.negociate();
    B.spanningTree.negociate();
    C.spanningTree.negociate();
    D.spanningTree.negociate();
  });

});
