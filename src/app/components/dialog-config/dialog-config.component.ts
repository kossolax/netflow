import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { TabComponent } from '@syncfusion/ej2-angular-navigations';
import { DialogComponent } from '@syncfusion/ej2-angular-popups';
import { GenericNode, RouterHost, ServerHost } from 'src/app/models/node.model';

@Component({
  selector: 'app-dialog-config',
  templateUrl: './dialog-config.component.html',
  styleUrls: ['./dialog-config.component.scss']
})
export class DialogConfigComponent implements OnInit, OnChanges {
  @ViewChild('dialog') dialog!: DialogComponent;
  @ViewChild('tabs') tabs!: TabComponent;

  @Input() node: GenericNode|null = null;
  @Output() exit: EventEmitter<void> = new EventEmitter<void>();

  IsServer(node: GenericNode|null): boolean {
    return node instanceof ServerHost;
  }
  constructor() { }
  ngOnChanges(changes: SimpleChanges): void {
    try {
      if( changes["node"] ) {
        if( changes["node"].currentValue !== null )
          this.dialog.show();
      }
    } catch( e ) { }
  }

  ngOnInit(): void {
  }

  onClose(): void {
    this.node = null;
    this.exit.emit();
  }

}
