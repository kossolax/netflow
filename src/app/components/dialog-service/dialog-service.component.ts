import { Component, Input } from '@angular/core';
import { NetworkHost, RouterHost, ServerHost, SwitchHost } from 'src/app/models/node.model';

@Component({
  selector: 'app-dialog-service',
  templateUrl: './dialog-service.component.html',
  styleUrls: ['./dialog-service.component.scss'],
})
export class DialogServiceComponent {
  @Input() public node: SwitchHost|RouterHost|null = null;

  constructor() { }

}
