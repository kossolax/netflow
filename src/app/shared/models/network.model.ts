import { Link } from "./layers/physical.model";
import { GenericNode, IPHost, Host } from "./node.model";

export class Network {
  public nodes: {[key: string]: GenericNode} = {};


  private static fromPKT(json: any): Network {
    const network = new Network();

    //console.log(json);

    json.NETWORK.DEVICES.DEVICE.map( (i: any) => {
      let node: GenericNode|null = null;
      const key = i.ENGINE.SAVE_REF_ID;
      const x = i.WORKSPACE.LOGICAL.X;
      const y = i.WORKSPACE.LOGICAL.Y;

      const type = i.ENGINE.TYPE['#text'].toLowerCase();
      if( type == "router" )
        node = new IPHost();
      if( type == "switch" )
        node = new Host();

      if( type == "pc" || type == "server" )
        return;

      if( node !== null ) {
        node.guid = key;
        node.x = x;
        node.y = y;

        network.nodes[key] = node;
      }

    });

    json.NETWORK.LINKS.LINK.map( (i: any) => {
      const type = i.TYPE;
      const length = i.CABLE.LENGTH;
      const from = network.nodes[i.CABLE.FROM] as Host;
      const to = network.nodes[i.CABLE.TO] as Host;
      // TODO: Attach to the right interface.
      //const link = new Link(from.getInterface(0), to.getInterface(0), length);
      //console.log("LINKS:", i, from, to);
    });

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
