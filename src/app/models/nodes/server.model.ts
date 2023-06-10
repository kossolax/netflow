import { DhcpServer } from "../services/dhcp.model";
import { L4Host } from "./generic.model";


export class ServerHost extends L4Host {

  public services: {dhcp: DhcpServer};

  constructor(name: string = "", type: string="server", iface: number=0) {
    super(name, type, iface);
    this.services = {
      "dhcp": new DhcpServer(this),
    };
  }

  public clone(): ServerHost {
    const clone = new ServerHost();
    this.cloneInto(clone);
    return clone;
  }

}
export class ComputerHost extends L4Host {

  constructor(name: string = "", type: string="server", iface: number=0) {
    super(name, type, iface);
  }


  public clone(): ComputerHost {
    const clone = new ComputerHost();
    this.cloneInto(clone);
    return clone;
  }

}
