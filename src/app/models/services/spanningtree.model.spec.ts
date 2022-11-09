import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { Link } from "../layers/physical.model";
import { SwitchHost } from "../node.model";
import { DatalinkListener, SimpleListener } from "../protocols/protocols.model";
import { PVSTPService } from "./spanningtree.model";

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
    A.spanningTree.negociate();

    D.getInterface(0).addListener(listener);
    listener.receiveTrame$.subscribe(trame => {
      done();
    });

  });
});
