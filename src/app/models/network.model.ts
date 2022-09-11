import { Link } from "./layers/physical.model";
import { GenericNode, ServerHost, RouterHost, SwitchHost, NetworkHost } from "./node.model";

export class Network {
  public nodes: Record<string, GenericNode> = {};
  public links: Link[] = [];

  private parsePort(node: GenericNode, json: any, depth: number[] = []): void {
    let name = "";


    if( json.TYPE === null )
      return;
    else if( json.TYPE.endsWith("GigabitEthernet") )
      name = "GigabitEthernet";
    else if( json.TYPE.endsWith("FastEthernet") )
      name = "FastEthernet";
    else if( json.TYPE.endsWith("Ethernet") )
      name = "Ethernet";
    else if( json.TYPE.endsWith("Serial") )
      name = "Serial";
    else if( json.TYPE.endsWith("Modem") )
      name = "Modem";
    else
      throw new Error("Unknown port type: " + json.TYPE);

    name += depth.join("/");

    if(  node instanceof SwitchHost || node instanceof NetworkHost )
      node.addInterface(name);
    else
      throw new Error("Unknown node type: " + node.type);
  }

  private parseModule(node: GenericNode, json: any, depth: number[]  = [], first: number = 0) : void {
    if ( json.MODULE && json.MODULE.PORT ) {
      if( json.MODULE.PORT instanceof Array ) {
        let lastType = "";
        let lastId = first;
        for(let i=0; i<json.MODULE.PORT.length; i++) {
          if( json.MODULE.PORT[i].TYPE !== lastType )
            lastId = first;
          lastType = json.MODULE.PORT[i].TYPE;
          const copy = depth.slice();
          copy.push(lastId++);
          this.parsePort(node, json.MODULE.PORT[i], copy);
        }
      }
      else {
        const copy = depth.slice();
        copy.push(first);
        this.parsePort(node, json.MODULE.PORT, copy);
      }
    }

    if ( json.MODULE && json.MODULE.SLOT ) {
      if( json.MODULE.SLOT instanceof Array ) {
        for(let i=0; i<json.MODULE.SLOT.length; i++) {
          const copy = depth.slice();
          if( json.MODULE.SLOT[i].TYPE !== "ePtHostModule" )
            copy.push(i);
          this.parseModule(node, json.MODULE.SLOT[i], copy, first);
        }
      }
      else {
        const copy = depth.slice();
        if( json.MODULE.SLOT.TYPE !== "ePtHostModule" )
          copy.push(0);
        this.parseModule(node, json.MODULE.SLOT, copy, first);
      }
    }



  }

  private static fromPKT(json: any): Network {
    const network = new Network();

    json.NETWORK.DEVICES.DEVICE.map( (i: any) => {
      let node: GenericNode|null = null;
      const key = i.ENGINE.SAVE_REF_ID;
      const x = i.WORKSPACE.LOGICAL.X;
      const y = i.WORKSPACE.LOGICAL.Y;

      const type = i.ENGINE.TYPE['#text'].toLowerCase();
      if( type == "pc" || type == "laptop" || type == "server" || type == "printer" || type == "cloud" )
        node = new ServerHost();
      else if( type == "router" )
        node = new RouterHost();
      else if( type == "switch" || type == "hub" )
        node = new SwitchHost();
      else if( type == "power distribution device" )
        return;

      if( node == null )
        throw new Error("Unknown node type: " + type);

      node.guid = key;
      node.x = parseFloat(x);
      node.y = parseFloat(y);
      node.type = type;
      network.nodes[key] = node;
      network.parseModule(node, i.ENGINE, [], node instanceof NetworkHost ? 0 : 1);
    });

    if( json.NETWORK.LINKS && json.NETWORK.LINKS.LINK ) {
      json.NETWORK.LINKS.LINK.map( (i: any) => {
        const from = network.nodes[i.CABLE.FROM] as (SwitchHost|NetworkHost);
        const to = network.nodes[i.CABLE.TO] as (SwitchHost|NetworkHost);
        const length = i.CABLE.LENGTH;

        try {
          const from_iface = from.getInterface(i.CABLE.PORT[0]);
          const to_iface = to.getInterface(i.CABLE.PORT[1]);

          const link = new Link(from_iface, to_iface, length);
          network.links.push(link);
        } catch(e) {
          console.log(e, i.CABLE.PORT, from, to);
        }
      });
    }

    return network;
  }
  private static fromPKA(json: any): Network {
    return Network.fromPKT(json.PACKETTRACER5[0]);
  }

  public static fromPacketTracer(json: any): Network {

    if( json.PACKETTRACER5 !== undefined )
      return Network.fromPKT(json.PACKETTRACER5);
    else if( json.PACKETTRACER5_ACTIVITY !== undefined )
      return Network.fromPKA(json.PACKETTRACER5_ACTIVITY);

    throw new Error("Unknown format");
  }
}
