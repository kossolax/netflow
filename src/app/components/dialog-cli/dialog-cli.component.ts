import { AfterViewInit, Component, Input, ViewChild } from '@angular/core';
import { FunctionsUsingCSI, NgTerminal } from 'ng-terminal';
import { catchError } from 'rxjs';
import { RouterHost, SwitchHost } from 'src/app/models/node.model';
import { Terminal, TerminalCommand } from 'src/app/models/terminal/terminal.model';




@Component({
  selector: 'app-dialog-cli',
  templateUrl: './dialog-cli.component.html',
  styleUrls: ['./dialog-cli.component.scss']
})
export class DialogCliComponent implements AfterViewInit {

  @ViewChild('term', { static: true }) child!: NgTerminal;
  terminal!: Terminal;
  buffer: string[] = [];
  locked: boolean = false;

  @Input() node: SwitchHost|RouterHost|null = null;

  constructor() { }

  ngAfterViewInit() {
    this.terminal = new Terminal(this.child, this.node as SwitchHost|RouterHost);
    this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)} ${this.terminal.Prompt} `);

    //...
    this.child.keyEventInput.subscribe(e => {
      if( this.locked )
        return;

      const ev = e.domEvent as KeyboardEvent;
      const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;
      const key = ev.key;

      if( key === 'Enter' ) {
        let command = this.buffer.join('').trim().split(' ').filter(x => x);
        this.buffer = [];

        if( command.length > 0 ) {
          this.locked = true;
          this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)}`);
          this.terminal.exec(command[0], command.slice(1)).subscribe({
            error: (err: Error) => {
              this.child.write(`${FunctionsUsingCSI.cursorColumn(1)} ${err}\n`);
              this.child.write(`${FunctionsUsingCSI.cursorColumn(1)} ${this.terminal.Prompt} `);
              this.locked = false;
            },
            complete: () => {
              this.child.write(`${FunctionsUsingCSI.cursorColumn(1)} ${this.terminal.Prompt} `);
              this.locked = false;
            }
          });
        }
        else {
          this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)} ${this.terminal.Prompt} `);
        }

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
