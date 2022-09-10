import { combineLatest, concatMap, map, tap } from "rxjs";
import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { IPAddress } from "../address.model";
import { Link } from "../layers/physical.model";
import { RouterHost } from "../node.model";
import { Terminal } from "./terminal.model";

describe('Terminal root test', () => {
  let A: RouterHost;
  let B: RouterHost;
  let link: Link;
  let terminalRouter: Terminal;

  beforeEach(async () => {
    A = new RouterHost("A", 1);
    A.getInterface(0).setNetAddress(new IPAddress("192.168.0.1"));
    A.getInterface(0).up();

    B = new RouterHost("B", 1);
    B.getInterface(0).setNetAddress(new IPAddress("192.168.0.2"));
    B.getInterface(0).up();

    link = new Link(A.getInterface(0), B.getInterface(0), 1);

    terminalRouter = new Terminal(A);
    SchedulerService.Instance.Speed = SchedulerState.FASTER;
  });

  it( 'ping', (done) => {
    terminalRouter.exec("ping 192.168.0.2");

    combineLatest([
      terminalRouter.Text$.pipe(
        map( (text) => {
          expect(text).toContain("alive");
          expect(text).not.toContain("dead");
          return true;
        }),
      ),
      terminalRouter.Complete$.pipe(
        map( _ => true )
      ),
    ]).subscribe( _ => done() );

  });
});
