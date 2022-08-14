import { merge, Observable, startWith, Subject, switchMap, tap } from "rxjs";
import { IPAddress } from "../address.model";
import { IPInterface, NetworkInterface } from "../layers/network.model";
import { RouterHost, SwitchHost } from "../node.model";

abstract class TerminalCommand {
  protected name: string;
  protected terminal: Terminal;
  protected parent: TerminalCommand;
  private prompt: string;
  private complete$: Subject<0> = new Subject();

  get Prompt(): string {
    return this.prompt;
  }
  get Terminal(): Terminal {
    return this.terminal;
  }
  get Complete$(): Observable<0> {
    return this.complete$;
  }

  private subCommands: Record<string, TerminalCommand> = {};

  constructor(terminal: Terminal, name: string, prompt: string = "") {
    this.terminal = terminal;
    this.name = name;
    this.prompt = prompt;
    this.parent = this;
  }

  public registerCommand(command: TerminalCommand): void {
    this.subCommands[command.name] = command;
  }

  public exec(command: string, args: string[]): void {
    if( command === 'end' ) {
      this.terminal.changeDirectory(this.parent);
    }
    else if( command === 'exit' ) {
      let p = this.parent;
      while( p !== p.parent )
        p = this.parent;

      this.terminal.changeDirectory(p);
    }
    else if (command in this.subCommands) {
      this.subCommands[command].exec(command, args);
    }
    else {
      throw new Error(`Command ${command} not found.`);
    }
  }

  public autocomplete(command: string, args: string[]): string[] {
    let commands = Object.keys(this.subCommands);
    commands.push('end');
    commands.push('exit');
    commands.sort();

    if( !command )
      return commands;

    return commands.filter(c => c.startsWith(command));
  }
  public autocomplete_child(command: string, args: string[]): string[] {
    if( command in this.subCommands )
      return this.subCommands[command].autocomplete(command, args);
    return [];
  }

  protected finalize(): void {
    this.parent.complete$.next(0);
  }

}
class PingCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'ping');
    this.parent = parent;
  }

  public override exec(command: string, args: string[]): void {
    if( args.length < 1 )
      throw new Error(`${this.name} requires a hostname`);

    const nethost = this.terminal.Node as RouterHost;
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
class TraceRouteCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'traceroute');
    this.parent = parent;
  }

  public override exec(command: string, args: string[]): void {
    if( args.length < 1 )
      throw new Error(`${this.name} requires a hostname`);

    this.Terminal.Node.send("traceroute", new IPAddress(args[0]));
    this.finalize();
  }
}
class AdminCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'enable', '#');
    this.parent = parent;

    this.registerCommand(new PingCommand(this));
    this.registerCommand(new TraceRouteCommand(this));
    this.registerCommand(new ConfigCommand(this));
  }

  public override exec(command: string, args: string[]): void {
    if( command === this.name ) {
      this.terminal.write(`${this.Terminal.Node.name} is now in admin mode.`);
      this.terminal.changeDirectory(this);
    }
    else {
      super.exec(command, args);
    }
  }
}
class ConfigCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'configure', '(config)#');
    this.parent = parent;


    this.registerCommand(new IPCommand(this));
  }
  public override exec(command: string, args: string[]): void {
    if( command === this.name ) {
      if( args[0] === 'terminal' )
        this.terminal.changeDirectory(this);
      else
        throw new Error(`${this.name} requires a subcommand`);
    }
    else {
      super.exec(command, args);
    }
  }

  public override autocomplete(command: string, args: string[]): string[] {
    if( command === this.name ) {
      if( args.length === 1 )
        return ['terminal'];

      return [];
    }

    return super.autocomplete(command, args);
  }
}
class IPCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'ip');
    this.parent = parent;
  }

  public override exec(command: string, args: string[]): void {
    if( command === this.name ) {
      if( args[0] === 'route' && args.length === 4 ) {
        const network = new IPAddress(args[1]);
        const mask = new IPAddress(args[2], true);
        const gateway = new IPAddress(args[3]);

        (this.Terminal.Node as RouterHost).addRoute(network, mask, gateway);
        this.finalize();
      }
      else
        throw new Error(`${this.name} requires a subcommand`);
    }
    else {
      super.exec(command, args);
    }
  }

  public override autocomplete(command: string, args: string[]): string[] {
    if( command === this.name ) {
      if( args.length === 1 )
        return ['route'];

      return [];
    }

    return super.autocomplete(command, args);
  }
}
class RootCommand extends TerminalCommand {
  constructor(terminal: Terminal) {
    super(terminal, '', '$');
    this.parent = this;

    this.registerCommand(new AdminCommand(this));
    this.registerCommand(new PingCommand(this));
    this.registerCommand(new TraceRouteCommand(this));
  }
}

export class Terminal {
  protected directory$: Subject<TerminalCommand> = new Subject();
  protected text$: Subject<string> = new Subject();
  protected complete$: Subject<0> = new Subject();
  protected locked: boolean = false;

  private history: string[] = [];
  private location: TerminalCommand;
  private node: RouterHost | SwitchHost;

  get Text$(): Observable<string> {
    return this.text$.asObservable();
  }
  get Complete$(): Observable<0> {
    return this.directory$.pipe(
      startWith(this.location),
      switchMap( i => {
        return merge(this.complete$, i.Complete$)
      }),
      tap( () => this.locked = false )
    );
  }

  get Locked(): boolean {
    return this.locked;
  }
  get Node(): RouterHost|SwitchHost {
    return this.node;
  }
  get Prompt(): string {
    return `${this.Node.name}${this.location.Prompt}`;
  }

  constructor(node: RouterHost|SwitchHost) {
    this.node = node;
    this.location = new RootCommand(this);
    this.changeDirectory(this.location);
  }

  public exec(command: string, args: string[]): void {
    this.locked = true;
    this.history.push([command, ...args].join(' '));

    try {
      let real_command = this.location.autocomplete(command, []);
      if( real_command.length === 1 ) {
        command = real_command.join('');

        for(let i=0; i<args.length; i++) {
          let real_args = this.location.autocomplete_child(command, args.slice(0, i+1));
          if( real_args.length === 1 )
            args[i] = real_args.join('');
        }
      }

      this.location.exec(command, args);
    } catch( e ) {
      this.text$.next(e as string);
      this.complete$.next(0);
    }
  }

  public autocomplete(command: string, args: string[]): string[] {
    const commands = this.location.autocomplete(command, args);

    if( commands.length === 1 ) {
      const subCommands = this.location.autocomplete_child(commands[0], args);
      if( subCommands.length >= 1 )
        return subCommands;
    }

    return commands;
  }
  public changeDirectory(t: TerminalCommand): void {
    this.location = t;
    this.directory$.next(t);
    this.complete$.next(0);
  }
  public write(text: string): void {
    this.text$.next(text);
  }
}
