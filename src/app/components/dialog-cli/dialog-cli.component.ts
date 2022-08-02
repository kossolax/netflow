import { AfterViewInit, Component, Input, ViewChild } from '@angular/core';
import { FunctionsUsingCSI, NgTerminal } from 'ng-terminal';
import { IPAddress, NetworkAddress } from 'src/app/models/address.model';
import { RouterHost, SwitchHost } from 'src/app/models/node.model';

abstract class TerminalCommand {
  parent: TerminalCommand;
  name: string;
  prompt: string;

  subCommands: { [key: string]: TerminalCommand } = {};

  constructor(name: string, prompt: string = "") {
    this.name = name;
    this.prompt = prompt;
    this.parent = this;
  }

  public registerCommand(command: TerminalCommand) {
    this.subCommands[command.name] = command;
  }

  public exec(node: SwitchHost|RouterHost, command: string, args: string[]): TerminalCommand|null {
    if( command === 'end' || command === 'exit' ) {
      console.log('Exiting...', this.parent);
      return this.parent;
    }

    if( command == this.name )
      return this;

    if (command in this.subCommands) {
      return this.subCommands[command].exec(node, command, args);
    }

    throw new Error(`Command ${command} not found.`);
  }

}
class PingCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super('ping');
    this.parent = parent;
  }

  override exec(node: SwitchHost|RouterHost, command: string, args: string[]): TerminalCommand|null {
    if( args.length < 1 )
      throw new Error('ping requires a hostname');

    node.send("ping", new IPAddress(args[0]));
    return null;
  }
}
class AdminCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super('enable', '#');
    this.parent = parent;
  }

  override exec(node: SwitchHost|RouterHost, command: string, args: string[]): TerminalCommand|null {
    let location = super.exec(node, command, args);

    if( command === this.name )
      console.log(`${node.name} is now in admin mode.`);

    return location;
  }
}
class Terminal extends TerminalCommand {
  private location: TerminalCommand;

  constructor() {
    super('root', '$');
    this.location = this;

    this.registerCommand(new AdminCommand(this));
    this.registerCommand(new PingCommand(this));
  }

  public override exec(node: SwitchHost | RouterHost, command: string, args: string[]): TerminalCommand|null {
    let location;

    if( this.location === this )
      location = super.exec(node, command, args);
    else
      location = this.location.exec(node, command, args);

    if( location )
      this.location = location;

    return this;
  }

  public get Prompt(): string {
    return `${this.location.prompt}`;
  }
}


@Component({
  selector: 'app-dialog-cli',
  templateUrl: './dialog-cli.component.html',
  styleUrls: ['./dialog-cli.component.scss']
})
export class DialogCliComponent implements AfterViewInit {

  @ViewChild('term', { static: true }) child!: NgTerminal;
  terminal: Terminal = new Terminal();
  buffer: string[] = [];

  @Input() node: SwitchHost|RouterHost|null = null;

  constructor() { }

  ngAfterViewInit() {
    this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)} ${this.terminal.Prompt} `);

    //...
    this.child.keyEventInput.subscribe(e => {
      const ev = e.domEvent as KeyboardEvent;
      const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;
      const key = ev.code;

      if( key == 'Enter' ) {
        let command = this.buffer.join('').trim().split(' ').filter(x => x);
        this.buffer = [];

        if( command.length > 0 ) {
          try {
            this.terminal.exec(this.node as SwitchHost|RouterHost, command[0], command.slice(1));
          }
          catch( e ) {
            this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)} ${e} `);
          }
        }


        this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)} ${this.terminal.Prompt} `);
      }
      else if( key == 'Backspace' ) {
        if (this.child.underlying.buffer.active.cursorX > 2) {
          this.child.write('\b \b');
          this.buffer.pop();
        }
      }
      else if (printable) {
        this.child.write(e.key);
        this.buffer.push(e.key);
      }

    });
  }
}
