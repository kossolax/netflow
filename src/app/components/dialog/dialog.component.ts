import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { TabComponent } from '@syncfusion/ej2-angular-navigations';
import { DialogComponent as SyncfusionDialogComponent } from '@syncfusion/ej2-angular-popups';
import { GenericNode, RouterHost, ServerHost, SwitchHost } from 'src/app/models/node.model';

@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.scss'],
})
export class DialogComponent implements OnChanges {
  @ViewChild('dialog') public dialog!: SyncfusionDialogComponent;
  @ViewChild('tabs') public tabs!: TabComponent;

  @Input() public node: SwitchHost|RouterHost|null = null;
  @Output() public exit: EventEmitter<void> = new EventEmitter<void>();

  public IsServer(node: GenericNode|null): boolean {
    return node instanceof ServerHost;
  }
  constructor() { }

  public ngOnChanges(changes: SimpleChanges): void {
    try {
      if( changes["node"] ) {
        if( changes["node"].currentValue !== null )
          this.dialog.show();
      }
    } catch( e ) { }
  }

  public onClose(): void {
    this.node = null;
    this.exit.emit();
  }
}
