import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { DialogComponent } from '@syncfusion/ej2-angular-popups';
import { Observable } from 'rxjs';
import { GenericNode } from 'src/app/models/node.model';

@Component({
  selector: 'app-dialog-config',
  templateUrl: './dialog-config.component.html',
  styleUrls: ['./dialog-config.component.scss']
})
export class DialogConfigComponent implements OnInit, OnChanges {
  @ViewChild('template') template!: DialogComponent;
  @Input() node: GenericNode|null = null;
  @Output() exit: EventEmitter<void> = new EventEmitter<void>();

  constructor() { }
  ngOnChanges(changes: SimpleChanges): void {
    if( changes["node"] ) {
      if( changes["node"].currentValue !== null )
        this.template.show();
    }
  }

  ngOnInit(): void {
  }

  onClose(): void {
    this.node = null;
    this.exit.emit();
  }

}
