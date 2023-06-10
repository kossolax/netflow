import { Subject, bufferCount, debounceTime, take, timeout, zip } from "rxjs";
import { handleChain, LinkLayerSpy, DatalinkSender, DatalinkListener, ActionHandle, NetworkSender, NetworkListener, GenericEventListener, EventString } from "./protocols.model";
import { DatalinkMessage, NetworkMessage, PhysicalMessage } from "../message.model";
import { EthernetInterface, HardwareInterface, Interface } from "../layers/datalink.model";
import { MacAddress } from "../address.model";
import { IPInterface, NetworkInterface } from "../layers/network.model";
import { SwitchHost } from "../nodes/switch.model";
import { RouterHost } from "../nodes/router.model";
import { GenericNode } from "../nodes/generic.model";

class HardwareLayerSpy extends HardwareInterface implements DatalinkSender, DatalinkListener {
  public receiveTrame$: Subject<DatalinkMessage> = new Subject<DatalinkMessage>();
  public sendTrame$: Subject<DatalinkMessage> = new Subject<DatalinkMessage>();

  constructor() {
    super(new SwitchHost(), MacAddress.generateAddress(), "HardwareSpy");
  }
  public override receiveTrame(message: DatalinkMessage): ActionHandle {
    this.receiveTrame$.next(message);
    return ActionHandle.Continue;
  }
  public override sendTrame(message: DatalinkMessage): ActionHandle {
    this.sendTrame$.next(message);
    return ActionHandle.Continue;
  }

}
class NetworkLayerSpy extends NetworkInterface implements NetworkSender, NetworkListener {
  public receivePacket$: Subject<NetworkMessage> = new Subject<NetworkMessage>();
  public sendPacket$: Subject<NetworkMessage> = new Subject<NetworkMessage>();

  constructor() {
    const host = new RouterHost();
    const mac = new EthernetInterface(host, MacAddress.generateAddress());
    super(host, "NetworkSpy", mac);
  }
  public override receivePacket(message: NetworkMessage): ActionHandle {
    this.receivePacket$.next(message);
    return ActionHandle.Continue;
  }
  public override sendPacket(message: NetworkMessage): ActionHandle {
    this.sendPacket$.next(message);
    return ActionHandle.Continue;
  }
}

describe('handleChain', () => {
  let pc: RouterHost;

  beforeEach(() => {
    pc = new RouterHost("PC", 1);
  });

  it('send / receive bits', (done) => {
    const spy = new LinkLayerSpy();
    const message = new PhysicalMessage(`Hello World!` + Math.random());

    zip(spy.receiveBits$, spy.sendBits$).pipe(take(1)).subscribe(([r, s]) => {
      expect(r.message).toEqual(s.message);
      done();
    });

    const loopback = pc.getInterface(0).getInterface(0);
    handleChain("receiveBits", [spy], message, loopback, loopback);
    handleChain("sendBits", [spy], message, loopback, loopback);
  });

  it('send / receive trames', (done) => {
    const spy = new HardwareLayerSpy();
    const message = new PhysicalMessage(`Hello World!` + Math.random());

    zip(spy.receiveTrame$, spy.sendTrame$).pipe(take(1)).subscribe(([r, s]) => {
      expect(r).toEqual(s);
      done();
    });

    const loopback = pc.getInterface(0).getInterface(0);
    handleChain("receiveTrame", [spy], message, loopback, loopback);
    handleChain("sendTrame", [spy], message, loopback, loopback);
  });

  it('send / receive packets', (done) => {
    const spy = new NetworkLayerSpy();
    const message = new PhysicalMessage(`Hello World!` + Math.random());

    zip(spy.receivePacket$, spy.sendPacket$).pipe(take(1)).subscribe(([r, s]) => {
      expect(r).toEqual(s);
      done();
    });

    const loopback = pc.getInterface(0).getInterface(0);
    handleChain("receivePacket", [spy], message, loopback, loopback);
    handleChain("sendPacket", [spy], message, loopback, loopback);
  });

  it('on OnInterfaceAdded', (done) => {

    const callback: GenericEventListener = (message, event) => {
      expect(message).toEqual("OnInterfaceAdded");
      done();
    }

    const PC = new RouterHost("PC", 1);
    pc.addListener(callback);
    pc.addInterface();
  });

  it('on OnInterfaceUp', (done) => {
      const callback$: Subject<{message: EventString, sender: Interface|GenericNode}> = new Subject();

      callback$.pipe(
        bufferCount(2),
        take(1),
      ).subscribe( (cb) => {
        expect(cb[0].message).toEqual("OnInterfaceUp");
        expect(cb[0].sender).toBeInstanceOf(IPInterface)
        expect(cb[1].message).toEqual("OnInterfaceUp");
        expect(cb[1].sender).toBeInstanceOf(EthernetInterface);
        done();
      });


      const pc = new RouterHost("PC", 1);
      pc.addListener( (message,sender) => callback$.next({message, sender}) );
      pc.getInterface(0).up();
    }
  );

  it('on OnInterfaceDown', (done) => {
    const callback$: Subject<{message: EventString, sender: Interface|GenericNode}> = new Subject();

    callback$.pipe(
      bufferCount(2),
      take(1),
    ).subscribe( (cb) => {
      expect(cb[0].message).toEqual("OnInterfaceDown");
      expect(cb[0].sender).toBeInstanceOf(IPInterface)
      expect(cb[1].message).toEqual("OnInterfaceDown");
      expect(cb[1].sender).toBeInstanceOf(EthernetInterface);
      done();
    });


    const pc = new RouterHost("PC", 1);
    pc.addListener( (message,sender) => callback$.next({message, sender}) );
    pc.getInterface(0).down();
  });

  it('on OnInterfaceChange', (done) => {

    const callback: GenericEventListener = (message, event) => {
      expect(message).toEqual("OnInterfaceChange");
      done();
    }

    const pc = new RouterHost("PC", 1);
    pc.addListener( callback );
    pc.getInterface(0).setMacAddress(MacAddress.generateAddress());
  });

  it('on Action handler', (done) => {

    const callback$ = new Subject();

    const should_continue: GenericEventListener = (message, event) => {
      expect(message).toEqual("OnInterfaceChange");
      return ActionHandle.Continue;
    }
    const should_handle: GenericEventListener = (message, event) => {
      expect(message).toEqual("OnInterfaceChange");
      return ActionHandle.Handled;
    }
    const should_stop: GenericEventListener = (message, event) => {
      expect(message).toEqual("OnInterfaceChange");
      callback$.next(true);
      return ActionHandle.Stop;
    }
    const should_not_be_called: GenericEventListener = (message, event) => {
      done.fail("Should not be called");
      callback$.next(false);
      return ActionHandle.Continue;
    }

    const pc = new RouterHost("PC", 1);

    pc.addListener( should_continue );
    pc.addListener( should_handle );
    pc.addListener( should_continue );
    pc.addListener( should_stop );
    pc.addListener( should_continue );
    pc.addListener( should_handle );
    pc.addListener( should_continue );
    pc.addListener( should_not_be_called );

    callback$.pipe(
      debounceTime(100),
      take(1),
    ).subscribe( (value) => {
      expect(value).toEqual(true);
      done();
    });

    pc.getInterface(0).setMacAddress(MacAddress.generateAddress());

  });


});
