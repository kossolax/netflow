import { PingCommand, TraceRouteCommand } from "./terminal.command.basic.model";
import { ConfigCommand } from "./terminal.command.config.model";
import { TerminalCommand } from "./terminal.command.model";


export class AdminCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'enable', '#');
    this.parent = parent;

    this.registerCommand(new PingCommand(this));
    this.registerCommand(new TraceRouteCommand(this));
    this.registerCommand(new ConfigCommand(this));
  }

  public override exec(command: string, args: string[], negated: boolean): void {
    if( command === this.name ) {
      this.terminal.write(`${this.Terminal.Node.name} is now in admin mode.`);
      this.terminal.changeDirectory(this);
    }
    else {
      super.exec(command, args, negated);
    }
  }
}
