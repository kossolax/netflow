import { AfterViewInit, Component, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { FunctionsUsingCSI, NgTerminal } from 'ng-terminal';
import { Subject, takeUntil } from 'rxjs';
import { RouterHost, SwitchHost } from 'src/app/models/node.model';
import { Terminal } from 'src/app/models/terminal/terminal.model';

@Component({
  selector: 'app-dialog-cli',
  templateUrl: './dialog-cli.component.html',
  styleUrls: ['./dialog-cli.component.scss'],
})
export class DialogCliComponent implements AfterViewInit, OnChanges {

  @ViewChild('term', { static: true }) public child!: NgTerminal;
  public terminal!: Terminal;
  public buffer: string[] = [];
  private bufferPosition: number = 0;

  @Input() public node: SwitchHost|RouterHost|null = null;
  private onDestroy$: Subject<void> = new Subject<void>();

  constructor() { }

  public ngOnChanges(changes: SimpleChanges): void {
    if( changes["node"] ) {

      this.onDestroy$.next();
      this.child?.underlying?.clear();

      if( changes["node"].currentValue !== null ) {
        this.recreateTerminal();
      }
    }
  }


  private recreateTerminal(): void {
    this.terminal = new Terminal(this.node as SwitchHost|RouterHost);
    this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)} ${this.terminal.Prompt} `);

    this.terminal.Text$.pipe(
      takeUntil(this.onDestroy$)
    ).subscribe( text => {
      this.child.write(` ${text}`);
      this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)}`);
    });

    this.terminal.Complete$.pipe(
      takeUntil(this.onDestroy$)
    ).subscribe( () => {
      this.child.write(` ${this.terminal.Prompt} `);
    });
  }

  public ngAfterViewInit(): void {
    this.recreateTerminal();

    this.child.keyEventInput.subscribe(e => {
      if( this.terminal.Locked )
        return;

      const ev = e.domEvent as KeyboardEvent;
      const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;
      const key = ev.key;

      if( key === 'Enter' ) {
        let command = this.buffer.join('').trim();
        this.buffer = [];
        this.bufferPosition = this.buffer.length;

        if( command.length > 0 ) {
          this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)}`);
          this.terminal.exec(command);
        }
        else {
          this.child.write(`\n ${FunctionsUsingCSI.cursorColumn(1)} ${this.terminal.Prompt} `);
        }

      }
      else if( key === 'Backspace' || key === 'Delete' ) {

        const col = this.child.underlying.buffer.active.cursorX;

        if( key === 'Backspace' && this.bufferPosition > 0 ) {
          this.child.write(`${FunctionsUsingCSI.cursorBackward(1)}`);
          for(let i=this.bufferPosition; i<this.buffer.length; i++)
            this.child.write(`${this.buffer[i]}`);
          this.child.write(` ${FunctionsUsingCSI.cursorColumn(col)}`);

          this.buffer.splice(this.bufferPosition-1, 1);
          this.bufferPosition--;
        }

        if( key === 'Delete' && this.bufferPosition < this.buffer.length ) {

          for(let i=this.bufferPosition+1; i<this.buffer.length; i++)
            this.child.write(`${this.buffer[i]}`);
          this.child.write(` ${FunctionsUsingCSI.cursorColumn(col+1)}`);

          this.buffer.splice(this.bufferPosition, 1);
        }

      }
      else if( key === 'Tab' || key === '?' ) {
        let command = this.buffer.join('');

        let completions = this.terminal.autocomplete(command);

        if( completions.length === 1 ) {
          let commands = command.split(' ').filter(x => x);
          if( command[command.length-1] === ' ' || commands.length === 0 )
            commands.push('');

          let rightPart = completions[0].slice(commands[commands.length-1].length).split('');

          for(let i=this.bufferPosition; i<this.buffer.length; i++)
            this.child.write(FunctionsUsingCSI.cursorForward(1));

          rightPart.forEach(c => this.buffer.push(c));
          this.bufferPosition = this.buffer.length;
          this.child.write(rightPart.join(''));
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
