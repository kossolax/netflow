import { Component, ElementRef, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { rippleMouseHandler } from '@syncfusion/ej2-buttons';
import { RouterHost, SwitchHost, GenericNode } from 'src/app/shared/models/node.model';
import { NetworkService } from 'src/app/shared/services/network.service';


@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})

export class FooterComponent implements OnInit {
  public selectableHost: {text: string, type: string, child: GenericNode[]}[] = [
    {
      text: 'Router',
      type: 'router',
      child: [
        new RouterHost("Router 1", 2),
        new RouterHost("Router 2", 3),
        new RouterHost("Router 3", 4),
        new RouterHost("Router 4", 5),
        new RouterHost("Router 5", 6),
      ]
    },
    {
      text: 'Switch',
      type: 'switch',
      child: [
        new SwitchHost("Switch 1", 24),
        new SwitchHost("Switch 2", 24),
        new SwitchHost("Switch 3", 24),
        new SwitchHost("Switch 4", 24),
        new SwitchHost("Switch 5", 24)
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
