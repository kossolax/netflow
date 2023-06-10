import { take, map, Observable, of, combineLatest, filter } from "rxjs";
import { MacAddress } from "../address.model";
import { Link } from "../layers/physical.model";
import { ArpMessage } from "./arp.model";
import { SimpleListener } from "./protocols.model";
import { RouterHost } from "../nodes/router.model";
import { SwitchHost } from "../nodes/switch.model";

describe('ARP Protocol test', () => {
  let A: RouterHost;
  let B: SwitchHost;
  let C: RouterHost;
  let linkAB: Link;
  let linkBC: Link;

  beforeEach(async () => {
    A = new RouterHost();
    A.name = "A";
    A.addInterface().up();

    B = new SwitchHost();
    B.name = "B";
    B.addInterface().up();
    B.addInterface().up();

    C = new RouterHost();
    C.name = "C";
    C.addInterface().up();

    linkAB = new Link(A.getInterface(0), B.getInterface(0), 100);
    linkBC = new Link(B.getInterface(1), C.getInterface(0), 100);



  });

  it( 'Automatic ARP lookup from L3 request', (done) => {
    const message = `${linkAB} ${Math.random()}`;
    const dst = C.getInterface(0).getNetAddress();

    let listenerOfA = new SimpleListener();
    let listenerOfC = new SimpleListener();
    A.getInterface(0).getInterface(0).addListener(listenerOfA);
    C.getInterface(0).getInterface(0).addListener(listenerOfC);

    const request = listenerOfC.receiveTrame$.pipe(
      filter( i => i.payload instanceof ArpMessage ),
      map( msg => {
        const arp = msg.payload as ArpMessage;
        expect(arp.type).toEqual("request");
        expect(arp.request).toEqual(dst);

        expect(msg.mac_src).toEqual(A.getInterface(0).getMacAddress());
        expect(msg.mac_dst).toEqual(MacAddress.generateBroadcast());
        return true;
      })
    );

    const reply = listenerOfA.receiveTrame$.pipe(
      filter( i => i.payload instanceof ArpMessage ),
      map( msg => {
        const arp = msg.payload as ArpMessage;
        expect(arp.type).toEqual("reply");
        expect(arp.request).toEqual(dst);
        expect(arp.response).toEqual(C.getInterface(0).getMacAddress());

        expect(msg.mac_src).toEqual(C.getInterface(0).getMacAddress());
        expect(msg.mac_dst).toEqual(A.getInterface(0).getMacAddress());
        return true;
      })
    );

    combineLatest([request, reply]).pipe(
      map( i => {
        if( i[0] && i[1] ) {
          done();
        }
      })
    ).subscribe();

    A.send(message, dst);
  });

});
