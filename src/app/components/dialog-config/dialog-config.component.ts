import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { TabComponent } from '@syncfusion/ej2-angular-navigations';
import { DialogComponent } from '@syncfusion/ej2-angular-popups';
import { IPAddress, MacAddress } from 'src/app/models/address.model';
import { HardwareInterface } from 'src/app/models/layers/datalink.model';
import { NetworkInterface } from 'src/app/models/layers/network.model';
import { GenericNode, RouterHost, ServerHost, SwitchHost } from 'src/app/models/node.model';

@Component({
  selector: 'app-dialog-config',
  templateUrl: './dialog-config.component.html',
  styleUrls: ['./dialog-config.component.scss']
})
export class DialogConfigComponent implements OnInit, OnChanges {
  @ViewChild('dialog') dialog!: DialogComponent;
  @ViewChild('tabs') tabs!: TabComponent;

  @Input() node: SwitchHost|RouterHost|null = null;
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

  setMacAddress(iface: HardwareInterface|NetworkInterface, evt: any): void {
    evt.container.classList.remove("e-error");

    try {
      iface.setMacAddress(new MacAddress(evt.value));
    } catch( e ) {
      evt.container.classList.add("e-error");
    }
  }
  setNetAddress(iface: NetworkInterface, evt: any): void {
    evt.container.classList.remove("e-error");

    try {
      iface.setNetAddress(new IPAddress(evt.value));
    } catch( e ) {
      evt.container.classList.add("e-error");
    }
  }

}
