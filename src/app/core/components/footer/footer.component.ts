import { Component, ElementRef, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { rippleMouseHandler } from '@syncfusion/ej2-buttons';
import { RouterHost, SwitchHost, GenericNode, ServerHost } from 'src/app/shared/models/node.model';
import { NetworkService } from 'src/app/shared/services/network.service';


@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})

export class FooterComponent implements OnInit {
  public selectableHost: {text: string, child: GenericNode[]}[] = [
    {
      text: 'Router',
      child: [
        new RouterHost("Router 2", 2),
        new RouterHost("Router 3", 3),
        new RouterHost("Router 4", 4),
        new RouterHost("Router 5", 5),
        new RouterHost("Router 6", 6),
      ]
    },
    {
      text: 'Switch',
      child: [
        new SwitchHost("Switch 6", 6),
        new SwitchHost("Switch 12", 12),
        new SwitchHost("Switch 24", 24),
        new SwitchHost("Switch 48", 48)
      ]
    },
    {
      text: 'Host',
      child: [
        new ServerHost("Server", "server"),
        new ServerHost("Laptop", "laptop"),
        new ServerHost("PC", "pc"),
        new ServerHost("Printer", "printer"),
      ]
    }
  ];
  public node$;

  constructor(private elRef:ElementRef, private network: NetworkService) {
    this.node$ = this.network.node$;
  }

  ngOnInit(): void {
  }

  public onClick(node: GenericNode): void {
    this.network.setNode(node);
  }
}
