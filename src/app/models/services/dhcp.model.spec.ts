import { buffer, bufferCount, take, tap, zip } from "rxjs";
import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { IPAddress } from "../address.model";
import { Link } from "../layers/physical.model";
import { RouterHost, ServerHost, SwitchHost } from "../node.model";
import { SimpleListener } from "../protocols/protocols.model";
import { DhcpClient, DhcpPool, DhcpServer } from "./dhcp.model";

describe('IPv4 protocol', () => {
  let A: ServerHost, B: ServerHost, C: ServerHost;
  let R: RouterHost;
  let S: SwitchHost;

  let listener: SimpleListener;

  beforeEach(async () => {
    A = new ServerHost();
    A.name = "A";
    A.addInterface().up();
    A.getInterface(0).setNetAddress(new IPAddress("192.168.0.1"));

    B = new ServerHost();
    B.name = "B";
    B.addInterface().up();

    C = new ServerHost();
    C.name = "C";
    C.addInterface().up();

    S = new SwitchHost();
    S.addInterface().up();
    S.addInterface().up();
    S.addInterface().up();

    R = new RouterHost();
    R.addInterface().up();
    R.getInterface(0).setNetAddress(new IPAddress("192.168.0.254"));
    R.addInterface().up();
    R.getInterface(0).setNetAddress(new IPAddress("192.168.1.254"));

    let pool0 = new DhcpPool();
    pool0.gatewayAddress = new IPAddress("192.168.0.254");
    pool0.netmaskAddress = new IPAddress("255.255.255.0");
    pool0.startAddress = new IPAddress("192.168.0.2");
    pool0.endAddress = new IPAddress("192.168.0.254");

    let pool1 = new DhcpPool();
    pool1.gatewayAddress = new IPAddress("192.168.1.254");
    pool1.netmaskAddress = new IPAddress("255.255.255.0");
    pool1.startAddress = new IPAddress("192.168.1.1");
    pool1.endAddress = new IPAddress("192.168.1.254");

    const dhcpServer = new DhcpServer(A);
    dhcpServer.pools.push(pool0);
    dhcpServer.pools.push(pool1);

    listener = new SimpleListener();

    SchedulerService.Instance.Speed = SchedulerState.FASTER;
  });

  it('PC-->Server', (done) => {

    let AB = new Link(A.getInterface(0), B.getInterface(0));

    const dhcpServer = new DhcpServer(A);
    const dhcpClient = new DhcpClient(B.getInterface(0));

    dhcpClient.negociate().subscribe((msg) => {
      expect(msg).toBeInstanceOf(IPAddress);
      expect(msg as IPAddress).not.toEqual(new IPAddress("0.0.0.0"));
      done();
    });


  });

  it('PC-->Switch-->Server', (done) => {

    let AS = new Link(A.getInterface(0), S.getInterface(0));
    let SB = new Link(S.getInterface(1), B.getInterface(0));

    const dhcpServer = new DhcpServer(A);
    const dhcpClient = new DhcpClient(B.getInterface(0));

    dhcpClient.negociate().subscribe((msg) => {
      expect(msg).toBeInstanceOf(IPAddress);
      expect(msg as IPAddress).not.toEqual(new IPAddress("0.0.0.0"));
      done();
    });

  });

  it('[2PC]-->Switch-->Server', (done) => {

    let AS = new Link(A.getInterface(0), S.getInterface(0));
    let SB = new Link(S.getInterface(1), B.getInterface(0));
    let SC = new Link(S.getInterface(2), C.getInterface(0));


    const dhcpClient1 = new DhcpClient(B.getInterface(0));
    const dhcpClient2 = new DhcpClient(C.getInterface(0));


    zip([dhcpClient1.negociate(), dhcpClient2.negociate()]).subscribe((msg) => {
      expect(msg[0]).toBeInstanceOf(IPAddress);
      expect(msg[1]).toBeInstanceOf(IPAddress);
      expect(msg[0] as IPAddress).not.toEqual(new IPAddress("0.0.0.0"));
      expect(msg[1] as IPAddress).not.toEqual(new IPAddress("0.0.0.0"));
      expect(msg[0] as IPAddress).not.toEqual(msg[1] as IPAddress);
      done();
    });



  });


});
