import { Component, Input } from '@angular/core';
import { NetworkHost, ServerHost } from 'src/app/models/node.model';

@Component({
  selector: 'app-dialog-service',
  templateUrl: './dialog-service.component.html',
  styleUrls: ['./dialog-service.component.scss'],
})
export class DialogServiceComponent {
  @Input() public node: NetworkHost|null = null;
  get Server(): ServerHost {
    return this.node as ServerHost;
  }

  constructor() { }

}
