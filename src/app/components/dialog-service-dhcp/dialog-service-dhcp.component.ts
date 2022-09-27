import { Component, Input } from '@angular/core';
import { RouterHost, ServerHost, SwitchHost } from 'src/app/models/node.model';

@Component({
  selector: 'app-dialog-service-dhcp',
  templateUrl: './dialog-service-dhcp.component.html',
  styleUrls: ['./dialog-service-dhcp.component.scss'],

})
export class DialogServiceDhcpComponent {
  @Input() public node: SwitchHost|RouterHost|null = null;
  public isActive: boolean = false;

  constructor() { }

}
