import { Link } from "./layers/physical.model";
import { GenericNode, IPHost, Host } from "./node.model";

export class Network {
  public nodes: {[key: string]: GenericNode} = {};
  public links: Link[] = [];

  private parsePort(node: GenericNode, json: any, depth: number[] = []): void {
    let name = "";

    if( json.TYPE.endsWith("GigabitEthernet") )
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
    console.log(name, json, depth);
  }


  private parseModule(node: GenericNode, json: any, depth: number[]  = []) : void {
    if ( json.MODULE && json.MODULE.SLOT ) {
      if( json.MODULE.SLOT instanceof Array ) {
        for(let i=0; i<json.MODULE.SLOT.length; i++) {
          const copy = depth.slice();
          copy.push(i);
          this.parseModule(node, json.MODULE.SLOT[i], copy);
        }
      }
      else {
        const copy = depth.slice();
        copy.push(0);
        this.parseModule(node, json.MODULE.SLOT, copy);
      }
    }

    if ( json.MODULE && json.MODULE.PORT ) {
      if( json.MODULE.PORT instanceof Array ) {
        for(let i=0; i<json.MODULE.PORT.length; i++) {
          const copy = depth.slice();
          copy.push(i);
          this.parsePort(node, json.MODULE.PORT[i], copy);
        }
      }
      else {
        const copy = depth.slice();
        copy.push(0);
        this.parsePort(node, json.MODULE.PORT, copy);
      }


    }

  }

  private static fromPKT(json: any): Network {
    const network = new Network();

    //console.log(json);

    json.NETWORK.DEVICES.DEVICE.map( (i: any) => {
      let node: GenericNode|null = null;
      const key = i.ENGINE.SAVE_REF_ID;
      const x = i.WORKSPACE.LOGICAL.X;
      const y = i.WORKSPACE.LOGICAL.Y;

      const type = i.ENGINE.TYPE['#text'].toLowerCase();
      if( type == "router" || type == "pc" || type == "server" )
        node = new IPHost();
      if( type == "switch" || type == "hub" )
        node = new Host();
      if( type == "power distribution device" )
        return;

      if( node == null )
        throw new Error("Unknown node type: " + type);

      node.guid = key;
      node.x = parseFloat(x);
      node.y = parseFloat(y);
      node.type = type;
      network.nodes[key] = node;

      network.parseModule(node, i.ENGINE);

    });

    if( json.NETWORK.LINKS && json.NETWORK.LINKS.LINK ) {
      json.NETWORK.LINKS.LINK.map( (i: any) => {
        const type = i.TYPE;
        const length = i.CABLE.LENGTH;
        const from = network.nodes[i.CABLE.FROM] as Host;
        const to = network.nodes[i.CABLE.TO] as Host;
        // TODO: Attach to the right interface.
        //const link = new Link(from.getInterface(0), to.getInterface(0), length);
        //console.log("LINKS:", i, from, to);
      });
    }

    return network;
  }
  private static fromPKA(json: any): Network {
    return Network.fromPKT(json.PACKETTRACER5[0]);
  }

  static fromPacketTracer(json: any): Network {

    if( json.PACKETTRACER5 !== undefined )
      return Network.fromPKT(json.PACKETTRACER5);
    else if( json.PACKETTRACER5_ACTIVITY !== undefined )
      return Network.fromPKA(json.PACKETTRACER5_ACTIVITY);

    throw new Error("Unknown format");
  }
}
