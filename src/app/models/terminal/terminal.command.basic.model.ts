import { IPAddress } from "../address.model";
import { IPInterface } from "../layers/network.model";
import { AdminCommand } from "./terminal.command.admin.model";
import { Terminal } from "./terminal.model";
import { TerminalCommand } from "./terminal.command.model";
import { RouterHost } from "../nodes/router.model";
import { SwitchHost } from "../nodes/switch.model";
import { NetworkHost } from "../nodes/generic.model";

export class RootCommand extends TerminalCommand {
  constructor(terminal: Terminal) {
    super(terminal, '', '$');
    this.parent = this;

    if( terminal.Node instanceof RouterHost || terminal.Node instanceof SwitchHost )
      this.registerCommand(new AdminCommand(this));

    this.registerCommand(new PingCommand(this));
  }
}
export class PingCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'ping');
    this.parent = parent;
  }

  public override exec(command: string, args: string[], negated: boolean): void {
    if( args.length < 1 )
      throw new Error(`${this.name} requires a hostname`);

    const nethost = this.terminal.Node as NetworkHost;
    const ipface = nethost.getInterface(0) as IPInterface;

    ipface.sendIcmpRequest(new IPAddress(args[0]), 20).subscribe( (data) => {
      if( data )
        this.terminal.write(`${args[0]} is alive`);
      else
        this.terminal.write(`${args[0]} is dead`);
      this.finalize();
    });
  }
}
