import { bufferCount, take, tap } from "rxjs";
import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { IPAddress } from "../address.model";
import { Link } from "../layers/physical.model";
import { DatalinkMessage } from "../message.model";
import { RouterHost, ServerHost, SwitchHost } from "../node.model";
import { SimpleListener } from "../protocols/protocols.model";
import { DhcpClient, DhcpMessage, DhcpPool, DhcpServer } from "./dhcp.model";

describe('IPv4 protocol', () => {
  let A: ServerHost;
  let B: ServerHost;
  let AB: Link;
  let pool: DhcpPool;

  let listener: SimpleListener;

  beforeEach(async () => {
    A = new ServerHost();
    A.name = "A";
    A.addInterface().up();
    A.getInterface(0).setNetAddress(new IPAddress("192.168.0.1"));

    B = new ServerHost();
    B.name = "B";
    B.addInterface().up();

    AB = new Link(A.getInterface(0), B.getInterface(0));

    pool = new DhcpPool();
    pool.gatewayAddress = new IPAddress("192.168.0.254");
    pool.netmaskAddress = new IPAddress("255.255.255.0");
    pool.startAddress = new IPAddress("192.168.0.2");
    pool.endAddress = new IPAddress("192.168.0.254");

    listener = new SimpleListener();

    SchedulerService.Instance.Speed = SchedulerState.FASTER;
  });

  it('PC->Server', (done) => {

    const dhcpServer = new DhcpServer(A);
    dhcpServer.pools.push(pool);
    const dhcpClient = new DhcpClient(B.getInterface(0));

    dhcpClient.negociate().subscribe((msg) => {
      expect(msg).toBeInstanceOf(IPAddress);
      expect(msg as IPAddress).not.toEqual(new IPAddress("0.0.0.0"));
      done();
    });


  });


});
