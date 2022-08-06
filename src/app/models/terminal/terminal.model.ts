import { merge, Observable, startWith, Subject, switchMap, tap, timer } from "rxjs";
import { IPAddress } from "../address.model";
import { NetworkInterface } from "../layers/network.model";
import { RouterHost, SwitchHost } from "../node.model";
import { IPv4Message } from "../protocols/ip.model";

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

  subCommands: { [key: string]: TerminalCommand } = {};

  constructor(terminal: Terminal, name: string, prompt: string = "") {
    this.terminal = terminal;
    this.name = name;
    this.prompt = prompt;
    this.parent = this;
  }

  public registerCommand(command: TerminalCommand) {
    this.subCommands[command.name] = command;
  }

  public exec(command: string, args: string[]) {
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

  protected finalize() {
    this.parent.complete$.next(0);
  }

}
class PingCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'ping');
    this.parent = parent;
  }

  override exec(command: string, args: string[]) {
    if( args.length < 1 )
      throw new Error(`${this.name} requires a hostname`);

    const nethost = this.terminal.Node as RouterHost;

    const icmp = new IPv4Message.Builder()
      .setPayload("1234567")
      .setMacSource(nethost.getInterface(0).getMacAddress())
      .setNetSource(nethost.getInterface(0).getNetAddress() as IPAddress)
      .setNetDestination(new IPAddress(args[0]))
      .setMaximumSize(5)
      .build();

    icmp.map(msg => nethost.send(msg) );

    timer(1000).subscribe(() => {
      this.finalize();
    });
  }
}
class TraceRouteCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'traceroute');
    this.parent = parent;
  }

  override exec(command: string, args: string[]) {
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
  }

  override exec(command: string, args: string[]) {
    if( command === this.name ) {
      this.terminal.write(`${this.Terminal.Node.name} is now in admin mode.`);
      this.terminal.changeDirectory(this);
    }
    else {
      super.exec(command, args);
    }
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

  public exec(command: string, args: string[]) {
    this.locked = true;
    this.history.push([command, ...args].join(' '));

    try {
      this.location.exec(command, args);
    } catch( e ) {
      this.text$.next(e as string);
      this.complete$.next(0);
    }
  }

  public autocomplete(command: string, args: string[]): string[] {
    return this.location.autocomplete(command, args);
  }
  public changeDirectory(t: TerminalCommand) {
    this.location = t;
    this.directory$.next(t);
    this.complete$.next(0);
  }
  public write(text: string) {
    this.text$.next(text);
  }
}
