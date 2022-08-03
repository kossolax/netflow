import { AfterViewInit, Component, Input, ViewChild } from '@angular/core';
import { FunctionsUsingCSI, NgTerminal } from 'ng-terminal';
import { IPAddress, NetworkAddress } from 'src/app/models/address.model';
import { RouterHost, SwitchHost } from 'src/app/models/node.model';

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

  public exec(command: string, args: string[]): TerminalCommand|null {
    if( command === 'end' || command === 'exit' ) {
      console.log('Exiting...', this.parent);
      return this.parent;
    }

    if( command == this.name )
      return this;

    if (command in this.subCommands) {
      return this.subCommands[command].exec(command, args);
    }

    throw new Error(`Command ${command} not found.`);
  }

  public complete(command: string, args: string[]): string[] {
    let commands = Object.keys(this.subCommands);

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

  override exec(command: string, args: string[]): TerminalCommand|null {
    if( args.length < 1 )
      throw new Error('ping requires a hostname');

    this.node.send("ping", new IPAddress(args[0]));
    return null;
  }
}
class AdminCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, parent.Node, 'enable', '#');
    this.parent = parent;
  }

  override exec(command: string, args: string[]): TerminalCommand|null {
    let location = super.exec(command, args);

    if( command === this.name )
      console.log(`${this.node.name} is now in admin mode.`);

    return location;
  }
}
class Terminal extends TerminalCommand {
  private location: TerminalCommand;

  constructor(terminal: NgTerminal, node: RouterHost|SwitchHost) {
    super(terminal, node, 'root', '$');
    this.location = this;

    this.registerCommand(new AdminCommand(this));
    this.registerCommand(new PingCommand(this));
  }

  public override exec(command: string, args: string[]): TerminalCommand|null {
    let location;

    if( this.location === this )
      location = super.exec(command, args);
    else
      location = this.location.exec(command, args);

    if( location )
      this.location = location;

    return this;
  }

  override get Prompt(): string {
    if( this.location === this )
      return `${this.Node.name}${this.prompt}`;
    return `${this.Node.name}${this.location.Prompt}`;
  }
}


@Component({
  selector: 'app-dialog-cli',
  templateUrl: './dialog-cli.component.html',
  styleUrls: ['./dialog-cli.component.scss']
})
export class DialogCliComponent implements AfterViewInit {

  @ViewChild('term', { static: true }) child!: NgTerminal;
  terminal!: Terminal;
  buffer: string[] = [];

  @Input() node: SwitchHost|RouterHost|null = null;

  constructor() { }

  ngAfterViewInit() {
    this.terminal = new Terminal(this.child, this.node as SwitchHost|RouterHost);
    this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)} ${this.terminal.Prompt} `);

    //...
    this.child.keyEventInput.subscribe(e => {
      const ev = e.domEvent as KeyboardEvent;
      const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;
      const key = ev.key;

      if( key === 'Enter' ) {
        let command = this.buffer.join('').trim().split(' ').filter(x => x);
        this.buffer = [];

        if( command.length > 0 ) {
          try {
            this.terminal.exec(command[0], command.slice(1));
          }
          catch( e ) {
            this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)} ${e} `);
          }
        }


        this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)} ${this.terminal.Prompt} `);
      }
      else if( key === 'Backspace' ) {
        if (this.child.underlying.buffer.active.cursorX > this.terminal.Prompt.length+2 ) {
          this.child.write('\b \b');
          this.buffer.pop();
        }
      }
      else if( key === 'Tab' || key === '?' ) {
        let command = this.buffer.join('').trim().split(' ').filter(x => x);
        let completions = this.terminal.complete(command[0], command.slice(1));

        if( completions.length === 1 ) {
          this.buffer = completions[0].split('');
          let rightPart = this.buffer.slice(command[0].length).join('');

          this.child.write(rightPart);
        }
        else if ( completions.length > 1 ) {
          this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)} ${completions.join(' ')} `);
          this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)} ${this.terminal.Prompt} `);
        }

      }
      else if ( key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown' ) {
        // history management
      }
      else if (printable) {
        console.log(key);
        this.child.write(e.key);
        this.buffer.push(e.key);
      }

    });
  }
}
