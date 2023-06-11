import { Link } from "../layers/physical.model";
import { SwitchHost } from "./switch.model";
import { RouterHost } from "./router.model";
import { ComputerHost, ServerHost } from "./server.model";

describe('nodes', () => {

  let L1: Link;
  let L2: SwitchHost;
  let L3: RouterHost;
  let L4A: ServerHost;
  let L4B: ComputerHost;

  beforeEach(async () => {
    L1 = new Link();
    L2 = new SwitchHost("Switch", 2);
    L3 = new RouterHost("Router", 2);
    L4A = new ServerHost("Server", "server");
    L4B = new ComputerHost("Computer", "computer");
  });

  it("L2 clone", () => {
    let node = L2.clone();

    expect(node).not.toEqual(L2);
    expect(node.name).toEqual(L2.name);

    const ifaces = L2.getInterfaces().length;
    expect(node.getInterfaces().length).toEqual(L2.getInterfaces().length);
    for(let i = 0; i < ifaces; i++) {
      expect(node.getInterfaces()[i]).toEqual(L2.getInterfaces()[i])
      expect(node.getInterface(i)).not.toEqual(L2.getInterface(i));
    }

  });

  it("L3 clone", () => {
    let node = L3.clone();

    expect(node).not.toEqual(L3);
    expect(node.name).toEqual(L3.name);

    const ifaces = L3.getInterfaces().length;
    expect(node.getInterfaces().length).toEqual(L3.getInterfaces().length);
    for(let i = 0; i < ifaces; i++) {
      expect(node.getInterfaces()[i]).toEqual(L3.getInterfaces()[i])
      expect(node.getInterface(i)).not.toEqual(L3.getInterface(i));
      expect(node.getInterface(i).getInterface(0)).not.toEqual(L3.getInterface(i).getInterface(0));
    }

  });

  it("L4 clone", () => {
    const nodeA = L4A.clone();

    expect(nodeA).not.toEqual(L4A);
    expect(nodeA.name).toEqual(L4A.name);

    expect(nodeA.getInterfaces().length).toEqual(L4A.getInterfaces().length);
    for(let i = 0; i < L4A.getInterfaces().length; i++) {
      expect(nodeA.getInterfaces()[i]).toEqual(L4A.getInterfaces()[i])
      expect(nodeA.getInterface(i)).not.toEqual(L4A.getInterface(i));
      expect(nodeA.getInterface(i).getInterface(0)).not.toEqual(L4A.getInterface(i).getInterface(0));
    }

    const nodeB = L4B.clone();
    expect(nodeB).not.toEqual(L4B);
    expect(nodeB.name).toEqual(L4B.name);

    expect(nodeB.getInterfaces().length).toEqual(L4B.getInterfaces().length);
    for(let i = 0; i < L4B.getInterfaces().length; i++) {
      expect(nodeB.getInterfaces()[i]).toEqual(L4B.getInterfaces()[i])
      expect(nodeB.getInterface(i)).not.toEqual(L4B.getInterface(i));
      expect(nodeB.getInterface(i).getInterface(0)).not.toEqual(L4B.getInterface(i).getInterface(0));
    }
  });

});
