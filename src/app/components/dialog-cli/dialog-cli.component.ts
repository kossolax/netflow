import { AfterViewInit, Component, Input, ViewChild } from '@angular/core';
import { FunctionsUsingCSI, NgTerminal } from 'ng-terminal';
import { RouterHost, SwitchHost } from 'src/app/models/node.model';
import { Terminal } from 'src/app/models/terminal/terminal.model';

@Component({
  selector: 'app-dialog-cli',
  templateUrl: './dialog-cli.component.html',
  styleUrls: ['./dialog-cli.component.scss'],
})
export class DialogCliComponent implements AfterViewInit {

  @ViewChild('term', { static: true }) public child!: NgTerminal;
  public terminal!: Terminal;
  public buffer: string[] = [];
  private bufferPosition: number = 0;

  @Input() public node: SwitchHost|RouterHost|null = null;

  constructor() { }

  public ngAfterViewInit(): void {
    this.terminal = new Terminal(this.node as SwitchHost|RouterHost);

    this.terminal.Text$.subscribe( text => {
      this.child.write(` ${text}`);
      this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)}`);
    });
    this.terminal.Complete$.subscribe( () => {
      this.child.write(` ${this.terminal.Prompt} `);
    });

    this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)} ${this.terminal.Prompt} `);

    //...
    this.child.keyEventInput.subscribe(e => {
      if( this.terminal.Locked )
        return;

      const ev = e.domEvent as KeyboardEvent;
      const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;
      const key = ev.key;

      if( key === 'Enter' ) {
        let command = this.buffer.join('').trim().split(' ').filter(x => x);
        this.buffer = [];
        this.bufferPosition = this.buffer.length;

        if( command.length > 0 ) {
          this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)}`);
          this.terminal.exec(command[0], command.slice(1));
        }
        else {
          this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)} ${this.terminal.Prompt} `);
        }

      }
      else if( key === 'Backspace' ) {
        if (this.child.underlying.buffer.active.cursorX > this.terminal.Prompt.length+2 ) {
          this.child.write('\b \b');
          this.buffer.pop();
          this.bufferPosition--;
        }
      }
      else if( key === 'Tab' || key === '?' ) {
        let command = this.buffer.join('').trim().split(' ').filter(x => x);
        if( this.buffer[this.buffer.length-1] === ' ' || command.length === 0 )
          command.push('');

        let completions = this.terminal.autocomplete(command[0], command.slice(1));

        if( completions.length === 1 ) {

          if( completions[0] !== command[0] ) {
            let rightPart = completions[0].slice(command[command.length-1].length).split('');

            for(let i=this.bufferPosition; i<this.buffer.length; i++)
              this.child.write(FunctionsUsingCSI.cursorForward(1));

            rightPart.forEach(c => this.buffer.push(c));
            this.bufferPosition = this.buffer.length;
            this.child.write(rightPart.join(''));
          }
        }
        else if ( completions.length > 1 ) {
          this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)} ${completions.join(' ')} `);
          this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)} ${this.terminal.Prompt} ${this.buffer.join('')}`);
        }
      }
      else if ( key === 'ArrowLeft' || key === 'ArrowRight' ) {
        if( key === 'ArrowLeft' ) {
          if( this.bufferPosition > 0 ) {
            this.bufferPosition--;
            this.child.write(FunctionsUsingCSI.cursorBackward(1));
          }
        }
        if( key === 'ArrowRight' ) {
          if( this.bufferPosition < this.buffer.length ) {
            this.bufferPosition++;
            this.child.write(FunctionsUsingCSI.cursorForward(1));
          }
        }
      }
      else if ( key === 'ArrowUp' || key === 'ArrowDown' ) {
        const last = key === 'ArrowUp' ? this.terminal.historyBack() : this.terminal.historyForward();
        this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)} ${this.terminal.Prompt} ${last}`);
      }
      else if (printable) {

        this.child.write(e.key);
        this.buffer.splice(this.bufferPosition, 0, e.key);
        this.bufferPosition++;

        if( this.bufferPosition !== this.buffer.length ) {
          const col = this.child.underlying.buffer.active.cursorX + 2;
          for(let i=this.bufferPosition; i<this.buffer.length; i++)
            this.child.write(this.buffer[i]);

          this.child.write(FunctionsUsingCSI.cursorColumn(col));
        }
      }

    });
  }
}
