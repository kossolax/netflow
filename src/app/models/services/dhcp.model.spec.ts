import { buffer, bufferCount, delay, switchMap, take, tap, zip } from "rxjs";
import { SchedulerService, SchedulerState } from "src/app/services/scheduler.service";
import { IPAddress, MacAddress } from "../address.model";
import { Link } from "../layers/physical.model";
import { SimpleListener } from "../protocols/protocols.model";
import { DhcpClient, DhcpMessage, DhcpPool, DhcpServer, DhcpType } from "./dhcp.model";
import { ServerHost } from "../nodes/server.model";
import { RouterHost } from "../nodes/router.model";
import { SwitchHost } from "../nodes/switch.model";

describe('DHCP protocol', () => {
  let A: ServerHost, B: ServerHost, C: ServerHost;
  let R: RouterHost;
  let S: SwitchHost;

  beforeEach(async () => {
    A = new ServerHost();
    A.name = "A";
    A.addInterface().up();
    A.getInterface(0).setNetAddress(new IPAddress("192.168.0.1"));
    A.gateway = new IPAddress("192.168.0.254");

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
    R.getInterface(1).setNetAddress(new IPAddress("192.168.1.254"));

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

    A.services.dhcp.pools.push(pool0);
    A.services.dhcp.pools.push(pool1);
    A.services.dhcp.Enable = true;

    SchedulerService.Instance.Speed = SchedulerState.FASTER;
  });

  it('Request: PC-->Server', (done) => {
    let AB = new Link(A.getInterface(0), B.getInterface(0));

    B.getInterface(0).AutoNegociateAddress = false;
    expect(B.getInterface(0).AutoNegociateAddress).toBeFalsy();
    B.getInterface(0).AutoNegociateAddress = true;
    expect(B.getInterface(0).AutoNegociateAddress).toBeTruthy();
    B.getInterface(0).AutoNegociateAddress = false;


    const dhcpClient = new DhcpClient(B.getInterface(0));
    dhcpClient.negociate().subscribe((msg) => {
      expect(msg).toBeInstanceOf(IPAddress);
      expect(msg as IPAddress).not.toEqual(new IPAddress("0.0.0.0"));
      done();
    });


  });

  it('Request: PC-->Switch-->Server', (done) => {
    let AS = new Link(A.getInterface(0), S.getInterface(0));
    let SB = new Link(S.getInterface(1), B.getInterface(0));

    const dhcpClient = new DhcpClient(B.getInterface(0));

    dhcpClient.negociate().subscribe((msg) => {
      expect(msg).toBeInstanceOf(IPAddress);
      expect(msg as IPAddress).not.toEqual(new IPAddress("0.0.0.0"));
      done();
    });

  });

  it('Request: [2PC]-->Switch-->Server', (done) => {
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

  it('Request: PC-->Router-->Server', (done) => {
    let AR = new Link(A.getInterface(0), R.getInterface(0));
    let RB = new Link(R.getInterface(1), B.getInterface(0));

    const dhcpRelay = new DhcpServer(R);
    dhcpRelay.forwarder = new IPAddress("192.168.0.1");
    dhcpRelay.Enable = true;

    const dhcpClient = new DhcpClient(B.getInterface(0));

    dhcpClient.negociate().subscribe((msg) => {
      expect(msg).toBeInstanceOf(IPAddress);
      expect(msg as IPAddress).not.toEqual(new IPAddress("0.0.0.0"));
      expect(new IPAddress("192.168.1.0").InSameNetwork(new IPAddress("255.255.255.0"), msg as IPAddress)).toBeTruthy();
      done();
    });

  });

  it('Release: [2PC]-->Switch-->Server', (done) => {
    let AS = new Link(A.getInterface(0), S.getInterface(0));
    let SB = new Link(S.getInterface(1), B.getInterface(0));
    let SC = new Link(S.getInterface(2), C.getInterface(0));

    const dhcpClient1 = new DhcpClient(B.getInterface(0));
    const dhcpClient2 = new DhcpClient(C.getInterface(0));

    let ip: IPAddress | null;
    dhcpClient1.negociate().pipe(
      tap( msg => {
        expect(msg).toBeInstanceOf(IPAddress);
        dhcpClient1.release();
        ip = msg;
      }),
      delay(100),
      switchMap( msg => dhcpClient2.negociate()  ),
      tap( msg => {
        expect(msg).toBeInstanceOf(IPAddress);
        expect((msg as IPAddress).equals(ip as IPAddress)).toBeTruthy();
      }),
      delay(100),
      switchMap( msg => dhcpClient1.negociate()  ),
      tap( msg => {
        expect(msg).toBeInstanceOf(IPAddress);
        expect((msg as IPAddress).equals(ip as IPAddress)).toBeFalsy();
        done();
      })
    ).subscribe();

  });

  it("builder", () => {
    const msg = new DhcpMessage.Builder();
    expect( () => msg.build() ).toThrowError();

    msg.setNetSource(IPAddress.generateAddress());
    expect( () => msg.build() ).toThrowError();

    msg.setNetDestination(IPAddress.generateAddress());
    expect( () => msg.build() ).toThrowError();

    msg.setClientHardwareAddress(MacAddress.generateAddress());

    expect( () => msg.setType(DhcpType.Ack).build() ).toThrowError();
    expect( () => msg.setType(DhcpType.Nak).build() ).toThrowError();
    expect( () => msg.setType(DhcpType.Offer).build() ).toThrowError();

    msg.setServerAddress(IPAddress.generateAddress());
    expect( () => msg.setType(DhcpType.Offer).build() ).toThrowError();
    expect( () => msg.setType(DhcpType.Request).build() ).toThrowError();
    expect( () => msg.setType(DhcpType.Request).build() ).toThrowError();
    expect( () => msg.setType(DhcpType.Release).build() ).toThrowError();

    msg.setServerAddress(new IPAddress("0.0.0.0"))
    msg.setYourAddress(IPAddress.generateAddress());
    expect( () => msg.setType(DhcpType.Ack).build() ).toThrowError();
    expect( () => msg.setType(DhcpType.Nak).build() ).toThrowError();
    expect( () => msg.setType(DhcpType.Offer).build() ).toThrowError();

    msg.setClientAddress(IPAddress.generateAddress());
    expect( () => msg.setType(DhcpType.Request).build() ).toThrowError();

    const request = new DhcpMessage.Builder()
      .setType(DhcpType.Discover)
      .setNetSource(new IPAddress("0.0.0.0"))
      .setNetDestination(IPAddress.generateBroadcast())
      .setClientHardwareAddress(MacAddress.generateAddress())
      .build()[0] as DhcpMessage;

    expect(request.toString()).toContain("DHCP");

  });
});
