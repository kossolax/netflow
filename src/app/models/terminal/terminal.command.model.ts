import { Observable, Subject } from "rxjs";
import { Terminal } from "./terminal.model";

export abstract class TerminalCommand {
  protected name: string;
  protected terminal: Terminal;
  protected parent: TerminalCommand;
  protected canBeNegative: boolean;
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
    this.canBeNegative = false;
  }

  public registerCommand(command: TerminalCommand): void {
    this.subCommands[command.name] = command;
  }

  public exec(command: string, args: string[], negated: boolean = false): void {
    if( command === 'end' && !negated ) {
      this.terminal.changeDirectory(this.parent);
    }
    else if( command === 'exit' && !negated ) {
      let p = this.parent;
      while( p !== p.parent )
        p = this.parent;

      this.terminal.changeDirectory(p);
    }
    else if (command in this.subCommands && (negated && this.subCommands[command].canBeNegative || !negated) ) {
        this.subCommands[command].exec(command, args, negated);
    }
    else {
      throw new Error(`Command "${negated ? 'no ': ''}${command}" not found.`);
    }
  }

  public autocomplete(command: string, args: string[], negated: boolean): string[] {
    let commands = Object.keys(this.subCommands).filter(c => negated && this.subCommands[c].canBeNegative || !negated);

    /*if( !negated ) {
      commands.push('end');
      commands.push('exit');
    }*/
    commands.sort();

    if( !command )
      return commands;

    return commands.filter(c => c.startsWith(command));
  }
  public autocomplete_child(command: string, args: string[], negated: boolean): string[] {
    if( command in this.subCommands )
      return this.subCommands[command].autocomplete(command, args, negated);
    return [];
  }

  protected finalize(): void {
    this.parent.complete$.next(0);
  }

}
