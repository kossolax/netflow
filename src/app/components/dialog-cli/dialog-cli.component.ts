import { AfterViewInit, Component, Input, ViewChild } from '@angular/core';
import { FunctionsUsingCSI, NgTerminal } from 'ng-terminal';
import { IPAddress, NetworkAddress } from 'src/app/models/address.model';
import { RouterHost, SwitchHost } from 'src/app/models/node.model';

abstract class TerminalCommand {
  name: string;

  subCommands: { [key: string]: TerminalCommand } = {};

  constructor(name: string) {
    this.name = name;
  }

  public registerCommand(command: TerminalCommand) {
    this.subCommands[command.name] = command;
  }

  public exec(node: SwitchHost|RouterHost, command: string, args: string[]) {
    if (command in this.subCommands) {
      this.subCommands[command].exec(node, command, args);
    }
    else {
      throw new Error(`Command "${command}" not found.`);
    }
  }

}
class PingCommand extends TerminalCommand {
  constructor() {
    super('ping');
  }

  override exec(node: SwitchHost|RouterHost, command: string, args: string[]) {
    if( args.length < 1 )
      throw new Error('ping requires a hostname');

    node.send("ping", new IPAddress(args[0]));
  }
}
class AdminCommand extends TerminalCommand {
  constructor() {
    super('enable');
  }
}
class Terminal extends TerminalCommand {
  constructor() {
    super('root');

    this.registerCommand(new AdminCommand());
    this.registerCommand(new PingCommand());
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

  ngAfterViewInit(){

    this.child.write(FunctionsUsingCSI.cursorColumn(1) + '$ ');

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
            this.child.write(`\r\n ${e} \r\n`);
          }
        }


        this.child.write('\n' + FunctionsUsingCSI.cursorColumn(1) + '$ '); // \r\n
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
