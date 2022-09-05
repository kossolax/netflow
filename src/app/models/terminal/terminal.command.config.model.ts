import { IPAddress } from "../address.model";
import { RouterHost, SwitchHost } from "../node.model";
import { InterfaceCommand } from "./terminal.command.interface.model";
import { TerminalCommand } from "./terminal.command.model";

export class ConfigCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'configure', '(config)#');
    this.parent = parent;

    if( this.terminal.Node instanceof RouterHost )
      this.registerCommand(new IPConfigCommand(this));
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
export class IPConfigCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'ip');
    this.parent = parent;
    this.canBeNegative = true;
  }

  public override exec(command: string, args: string[], negated: boolean): void {
    console.log(command, args, negated);
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
