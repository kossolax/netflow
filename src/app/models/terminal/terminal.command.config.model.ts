import { IPAddress } from "../address.model";
import { RouterHost } from "../nodes/router.model";
import { SwitchHost } from "../nodes/switch.model";
import { InterfaceCommand } from "./terminal.command.interface.model";
import { TerminalCommand } from "./terminal.command.model";

export class ConfigCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'configure', '(config)#');
    this.parent = parent;

    this.registerCommand(new HostnameConfigCommand(this));

    if( this.terminal.Node instanceof RouterHost )
      this.registerCommand(new IPConfigCommand(this));
    if( this.terminal.Node instanceof SwitchHost )
      this.registerCommand(new VlanConfigCommand(this));

    this.registerCommand(new InterfaceCommand(this));
  }
  public override exec(command: string, args: string[], negated: boolean): void {
    if( command === this.name ) {
      if( args[0] === 'terminal' )
        this.terminal.changeDirectory(this);
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
        return ['terminal'];

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}
class HostnameConfigCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'hostname');
    this.parent = parent;
    this.canBeNegative = true;
  }

  public override exec(command: string, args: string[], negated: boolean): void {
    if( command === this.name ) {
      if( args.length === 1 ) {
        this.Terminal.Node.name = args[0];

        this.finalize();
      }
      else
        throw new Error(`${this.name} requires a subcommand`);
    }
    else {
      super.exec(command, args, negated);
    }
  }
}
class IPConfigCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'ip');
    this.parent = parent;
    this.canBeNegative = true;
  }

  public override exec(command: string, args: string[], negated: boolean): void {
    if( command === this.name ) {
      if( args[0] === 'route' && args.length === 4 ) {
        const network = new IPAddress(args[1]);
        const mask = new IPAddress(args[2], true);
        const gateway = new IPAddress(args[3]);

        if( negated )
          (this.Terminal.Node as RouterHost).deleteRoute(network, mask, gateway);
        else
          (this.Terminal.Node as RouterHost).addRoute(network, mask, gateway);
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
        return ['route'];

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

class VlanConfigCommand extends TerminalCommand {
  public vlan_id: number = 0;

  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'vlan', '(config-vlan)#');
    this.parent = parent;
    this.canBeNegative = true;

    this.registerCommand(new VlanNameCommand(this));
  }

  public override exec(command: string, args: string[], negated: boolean): void {
    if( command === this.name ) {
      if( args.length === 1 ) {
        const host = this.Terminal.Node as SwitchHost;
        this.vlan_id = parseInt(args[0]);

        if( !negated ) {
          if( !host.knownVlan[this.vlan_id] )
            host.knownVlan[this.vlan_id] = `VLAN${this.vlan_id}`;

          this.terminal.changeDirectory(this);
        }
        else {
          if( host.knownVlan[this.vlan_id] )
            delete host.knownVlan[this.vlan_id];
          this.finalize();
        }
      }
      else {
        throw new Error(`${this.name} requires an vlan id`);
      }
    }
    else {
      super.exec(command, args, negated);
    }
  }
}
class VlanNameCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'name');
    this.parent = parent;
  }

  public override exec(command: string, args: string[], negated: boolean): void {
    if( command === this.name ) {
      if( args.length === 1 ) {
        const vlan_id = (this.parent as VlanConfigCommand).vlan_id;
        const host = this.Terminal.Node as SwitchHost;

        if( !negated )
          host.knownVlan[vlan_id] = args[0];

        this.finalize();
      }
      else {
        throw new Error(`${this.name} requires an vlan name`);
      }
    }
    else {
      super.exec(command, args, negated);
    }
  }
}
