import { take, map, Observable, of, combineLatest, filter } from "rxjs";
import { MacAddress } from "../address.model";
import { Link } from "../layers/physical.model";
import { Host, IPHost } from "../node.model";
import { ArpMessage } from "./arp.model";
import { SimpleListener } from "./protocols.model";

describe('ARP Protocol test', () => {
  let A: IPHost;
  let B: Host;
  let C: IPHost;
  let linkAB: Link;
  let linkBC: Link;

  beforeEach(async () => {
    A = new IPHost();
    A.name = "A";
    A.addInterface().up();

    B = new Host();
    B.name = "B";
    B.addInterface().up();
    B.addInterface().up();

    C = new IPHost();
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
    A.send(message, dst);

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
    ).subscribe()
  });

});
