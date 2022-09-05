import { IPAddress } from "../address.model";
import { Dot1QInterface, HardwareInterface } from "../layers/datalink.model";
import { IPInterface, NetworkInterface } from "../layers/network.model";
import { RouterHost, SwitchHost } from "../node.model";
import { VlanMode } from "../protocols/ethernet.model";
import { TerminalCommand } from "./terminal.command.model";

export class InterfaceCommand extends TerminalCommand {
  public iface: NetworkInterface|HardwareInterface|null;

  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'interface', '(config-if)#');
    this.parent = parent;
    this.iface = null;

    if( this.terminal.Node instanceof RouterHost )
      this.registerCommand(new IPInterfaceCommand(this));
    if( this.terminal.Node instanceof SwitchHost )
      this.registerCommand(new SwitchPortCommand(this));
  }
  public override exec(command: string, args: string[], negated: boolean): void {
    if( command === this.name ) {
      if( args.length === 2 ) {
        const ifaces = this.Terminal.Node.getInterfaces()
          .map( (iface) => iface.matchAll(/^([a-zA-Z]+)\s?(\d+(?:\/\d+)*)/g).next().value  )
          .filter( (iface) => iface[1].startsWith(args[0]) )
          .filter( (iface) => iface[2].startsWith(args[1]) )
          .map( (iface) => iface[0] );

        if( ifaces.length !== 1 )
          throw new Error(`${this.name} requires a valid interface`);

        this.iface = this.Terminal.Node.getInterface(ifaces[0]);
        this.terminal.changeDirectory(this);
      }
      else {
        throw new Error(`${this.name} requires an interface`);
      }
    }
    else {
      super.exec(command, args, negated);
    }
  }

  public override autocomplete(command: string, args: string[], negated: boolean): string[] {

    if( command === this.name ) {
      if( args.length === 1 ) {
        const ifaces = this.Terminal.Node.getInterfaces()
          .filter( (iface) => iface.startsWith(args[0]) )
          .map( (iface) => iface.matchAll(/^([a-zA-Z]+)\s?(\d+(?:\/\d+)*)/g).next().value[1]  );

        return [...new Set(ifaces)];
      }
      else if( args.length === 2 ) {
        const ifaces = this.Terminal.Node.getInterfaces()
          .filter( (iface) => iface.startsWith(args[0]) )
          .map( (iface) => iface.matchAll(/^([a-zA-Z]+)\s?(\d+(?:\/\d+)*)/g).next().value[2]  )
          .filter( (iface) => iface.startsWith(args[1]) );

        return [...new Set(ifaces)];
      }

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}
export class SwitchPortCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'switchport');
    this.parent = parent;
  }

  public override exec(command: string, args: string[], negated: boolean): void {
    console.log(command, args, negated);
    if( command === this.name ) {
      if( args[0] === 'access' && args[1] === 'vlan' && args.length === 3 ) {
        const vlanid = parseInt(args[2]);

        const iface = (this.parent as InterfaceCommand).iface as Dot1QInterface;
        iface.addVlan(vlanid);

        this.finalize();
      }
      else if( args[0] === 'mode' && args.length === 2 ) {
        const iface = (this.parent as InterfaceCommand).iface as Dot1QInterface;

        if( args[1] === 'access' )
          iface.VlanMode = VlanMode.Access;
        else if( args[1] === 'trunk' )
          iface.VlanMode = VlanMode.Trunk;
        else
          throw new Error(`Invalid mode ${args[1]}`);

      }
      else
        throw new Error(`${this.name} requires a subcommand`);
    }
    else {
      super.exec(command, args, negated);
    }
  }

  public override autocomplete(command: string, args: string[], negated: boolean): string[] {
    if( command === this.name ) {
      if( args.length === 1 )
        return ['access', 'mode'];
      if( args[0] === 'access' && args.length === 2 )
        return ['vlan'];
      if( args[0] === 'mode' && args.length === 2 )
        return ['access', 'dynamic', 'trunk'];

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}
export class IPInterfaceCommand extends TerminalCommand {

  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'ip');
    this.parent = parent;
  }

  public override exec(command: string, args: string[], negated: boolean): void {
    if( command === this.name ) {
      if( args[0] === 'address' && args.length === 3 ) {
        const network = new IPAddress(args[1]);
        const mask = new IPAddress(args[2], true);

        const iface = (this.parent as InterfaceCommand).iface as NetworkInterface;

        iface.setNetAddress(network);
        iface.setNetMask(mask);
        this.finalize();
      }
      else
        throw new Error(`${this.name} requires a subcommand`);
    }
    else {
      super.exec(command, args, negated);
    }
  }

  public override autocomplete(command: string, args: string[], negated: boolean): string[] {
    if( command === this.name ) {
      if( args.length === 1 )
        return ['address'];
      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}
