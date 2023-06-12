import { IPAddress } from "../address.model";
import { Link } from "../layers/physical.model";
import { RouterHost } from "./router.model";

describe('router', () => {

  let L1: Link;
  let L3: RouterHost;

  beforeEach(async () => {
    L3 = new RouterHost("Router", 2);
    L1 = new Link(L3.getInterface(0), L3.getInterface(1), 1000);

    for(let i = 0; i < 2; i++) {
      L3.getInterface(i).up();
    }

  });

  it("route", () => {
    const dst = new IPAddress("192.168.1.1");

    expect(L3.getNextHop(dst)).toBeNull();

    L3.addRoute("192.168.0.0", "255.255.255.0", "192.168.0.1");
    expect(L3.getNextHop(dst)).toBeNull();

    L3.addRoute("0.0.0.0", "255.255.255.0", "192.168.0.2");
    expect(L3.getNextHop(dst)).toBeNull();

    L3.addRoute("192.168.1.0", "255.255.0.0", "192.168.0.3");
    expect(L3.getNextHop(dst)).toEqual(new IPAddress("192.168.0.3"));

    L3.addRoute("192.168.1.0", "255.255.255.0", "192.168.0.4");
    expect(L3.getNextHop(dst)).toEqual(new IPAddress("192.168.0.4"));

    L3.addRoute("192.168.1.0", "255.255.255.128", "192.168.0.5");
    expect(L3.getNextHop(dst)).toEqual(new IPAddress("192.168.0.5"));

    expect( () => L3.addRoute("192.168.1.0", "255.255.255.128", "192.168.0.5") ).toThrowError();
    expect( () => L3.deleteRoute("192.168.1.0", "255.255.255.128", "192.168.0.5") ).not.toThrowError();
    expect( () => L3.deleteRoute("192.168.1.0", "255.255.255.128", "192.168.0.5") ).toThrowError();


  });



});
