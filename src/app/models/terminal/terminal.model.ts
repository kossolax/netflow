import { merge, Observable, startWith, Subject, switchMap, tap } from "rxjs";
import { IPAddress } from "../address.model";
import { IPInterface } from "../layers/network.model";
import { RouterHost, SwitchHost } from "../node.model";
import { AdminCommand } from "./terminal.command.admin.model";
import { RootCommand } from "./terminal.command.basic.model";
import { TerminalCommand } from "./terminal.command.model";



export class Terminal {
  protected directory$: Subject<TerminalCommand> = new Subject();
  protected text$: Subject<string> = new Subject();
  protected complete$: Subject<0> = new Subject();
  protected locked: boolean = false;

  private historyIndex: number = 0;
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

  public exec(commandWithArguments: string): void {
    let commands = commandWithArguments.trim().split(' ').filter(x => x);
    let command = commands[0];
    let args = commands.slice(1);


    this.locked = true;
    this.history.push([command, ...args].join(' '));
    this.historyIndex = this.history.length-1;

    let negated = false;
    if( command === 'no' ) {
      negated = true;
      command = args.length >= 1 ? args.shift()! : '';
    }

    try {
      let real_command = this.location.autocomplete(command, [], negated);
      if( real_command.length === 1 ) {
        command = real_command.join('');

        for(let i=0; i<args.length; i++) {
          let real_args = this.location.autocomplete_child(command, args.slice(0, i+1), negated);
          if( real_args.length === 1 )
            args[i] = real_args.join('');
        }
      }

      this.location.exec(command, args, negated);
    } catch( e ) {
      this.text$.next(e as string);
      this.complete$.next(0);
    }
  }
  public historyBack(): string {
    if( this.historyIndex > 0 )
      this.historyIndex--;
    return this.history[this.historyIndex];
  }
  public historyForward(): string {
    if( this.historyIndex < this.history.length-1 )
      this.historyIndex++;
    return this.history[this.historyIndex];
  }

  public autocomplete(commandWithArguments: string): string[] {
    let commands = commandWithArguments.trim().split(' ').filter(x => x);
    let command = commands[0] || '';
    let args = commands.slice(1) || [];
    let negated = false;

    if( command === 'no' ) {
      negated = true;
      command = args.length >= 1 ? args.shift()! : '';
    }

    if( commandWithArguments[commandWithArguments.length-1] === ' ' )
      args.push('');

    const commandsAvailable = this.location.autocomplete(command, args, negated);

    if( commandsAvailable.length === 1 ) {
      const subCommands = this.location.autocomplete_child(commandsAvailable[0], args, negated);
      if( subCommands.length >= 1 || args.length >= 1 )
        return subCommands;
    }

    return commandsAvailable;
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
