import { Component, ElementRef } from '@angular/core';
import { AbstractLink, Link } from 'src/app/models/layers/physical.model';
import { GenericNode } from 'src/app/models/nodes/generic.model';
import { RouterHost } from 'src/app/models/nodes/router.model';
import { ServerHost } from 'src/app/models/nodes/server.model';
import { SwitchHost } from 'src/app/models/nodes/switch.model';
import { NetworkService } from 'src/app/services/network.service';


@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})

export class FooterComponent {
  public selectableHost: {text: string, child: (GenericNode|AbstractLink)[]}[] = [
    {
      text: 'Router',
      child: [
        new RouterHost("Router 2", 2),
        new RouterHost("Router 3", 3),
        new RouterHost("Router 4", 4),
        new RouterHost("Router 5", 5),
        new RouterHost("Router 6", 6),
      ],
    },
    {
      text: 'Switch',
      child: [
        new SwitchHost("Switch 6", 6, true),
        new SwitchHost("Switch 12", 12, true),
        new SwitchHost("Switch 24", 24, true),
        new SwitchHost("Switch 48", 48, true),
      ],
    },
    {
      text: 'Host',
      child: [
        new ServerHost("Server", "server"),
        new ServerHost("Laptop", "laptop"),
        new ServerHost("PC", "pc"),
        new ServerHost("Printer", "printer"),
      ],
    },
    {
      text: 'Link',
      child: [
        new Link(),
      ],
    },
  ];
  public node$;

  constructor(private elRef:ElementRef, private network: NetworkService) {
    this.node$ = this.network.node$;
  }

  public onClick(node: GenericNode|AbstractLink): void {
    this.network.setNode(node);
  }
}
