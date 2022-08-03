import { NgTerminal } from "ng-terminal";
import { IPAddress } from "../address.model";
import { RouterHost, SwitchHost } from "../node.model";

abstract class TerminalCommand {
  protected terminal: NgTerminal;
  protected node: RouterHost|SwitchHost;
  protected parent: TerminalCommand;
  protected name: string;
  protected prompt: string;

  get Terminal(): NgTerminal {
    return this.terminal;
  }
  get Node(): RouterHost|SwitchHost {
    return this.node;
  }
  get Prompt(): string {
    return this.prompt;
  }

  subCommands: { [key: string]: TerminalCommand } = {};

  constructor(terminal: NgTerminal, node: RouterHost|SwitchHost, name: string, prompt: string = "") {
    this.terminal = terminal;
    this.node = node;
    this.name = name;
    this.prompt = prompt;
    this.parent = this;
  }

  public registerCommand(command: TerminalCommand) {
    this.subCommands[command.name] = command;
  }

  public exec(command: string, args: string[]): Promise<TerminalCommand|null> {
    if( command === 'end' ) {
      return Promise.resolve(this.parent);
    }
    else if( command === 'exit' ) {
      let p = this.parent;
      while( p !== p.parent )
        p = this.parent;
      return Promise.resolve(p);
    }

    if( command == this.name )
      return Promise.resolve(this);

    if (command in this.subCommands) {
      return this.subCommands[command].exec(command, args);
    }

    throw new Error(`Command ${command} not found.`);
  }

  public complete(command: string, args: string[]): string[] {
    let commands = Object.keys(this.subCommands);
    commands.push('end');
    commands.push('exit');
    commands.sort();

    if( !command )
      return commands;

    return commands.filter(c => c.startsWith(command));
  }

}
class PingCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, parent.Node, 'ping');
    this.parent = parent;
  }

  override exec(command: string, args: string[]): Promise<TerminalCommand|null> {
    if( args.length < 1 )
      throw new Error(`${this.name} requires a hostname`);

    this.node.send("ping", new IPAddress(args[0]));

    return new Promise((resolve, fail) => {
      setTimeout(resolve, 1000);
    });
  }
}
class TraceRouteCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, parent.Node, 'traceroute');
    this.parent = parent;
  }

  override exec(command: string, args: string[]): Promise<TerminalCommand|null> {
    if( args.length < 1 )
      throw new Error(`${this.name} requires a hostname`);

    this.node.send("traceroute", new IPAddress(args[0]));
    return Promise.resolve(null);
  }
}
class AdminCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, parent.Node, 'enable', '#');
    this.parent = parent;

    this.registerCommand(new PingCommand(this));
    this.registerCommand(new TraceRouteCommand(this));
  }

  override exec(command: string, args: string[]): Promise<TerminalCommand|null> {
    let location = super.exec(command, args);

    if( command === this.name )
      console.log(`${this.node.name} is now in admin mode.`);

    return Promise.resolve(location);
  }
}
export class Terminal extends TerminalCommand {
  private history: string[] = [];
  private location: TerminalCommand;

  constructor(terminal: NgTerminal, node: RouterHost|SwitchHost) {
    super(terminal, node, 'root', '$');
    this.location = this;

    this.registerCommand(new AdminCommand(this));
    this.registerCommand(new PingCommand(this));
    this.registerCommand(new TraceRouteCommand(this));
  }

  public override exec(command: string, args: string[]): Promise<TerminalCommand|null> {
    let location;

    this.history.push([command, ...args].join(' '));

    try {
      if( this.location === this )
        location = super.exec(command, args)
      else
        location = this.location.exec(command, args);
    } catch( e ) {
      return Promise.reject(e);
    }

    return location.then(location => {
      if( location )
        this.location = location;

      return null;
    });
  }

  public override complete(command: string, args: string[]): string[] {
    if( this.location === this )
      return super.complete(command, args);
    return this.location.complete(command, args);
  }

  override get Prompt(): string {
    if( this.location === this )
      return `${this.Node.name}${this.prompt}`;
    return `${this.Node.name}${this.location.Prompt}`;
  }
}
