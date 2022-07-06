import { AfterViewInit, Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { DiagramComponent, ImageModel } from '@syncfusion/ej2-angular-diagrams';

import { Observable } from 'rxjs';
import { Network } from 'src/app/shared/models/network.model';
import { RouterHost } from 'src/app/shared/models/node.model';
import { NetworkService } from 'src/app/shared/services/network.service';

@Component({
  selector: 'app-logical',
  templateUrl: './logical.component.html',
  styleUrls: ['./logical.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class LogicalComponent implements OnInit, AfterViewInit  {
  network$!: Observable<Network|null>;

  @ViewChild("diagram") diagram!: DiagramComponent;

  constructor(private network: NetworkService) {
  }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {

    this.network$ = this.network.network$;
    this.network$.subscribe( data => {
      console.log("LogicalComponent:", data);

      this.diagram.clear();


      if( data != null ) {
        for(let key in data.nodes) {
          const node = data.nodes[key];

          this.diagram.add({
            id: node.guid,
            offsetX: node.x,
            offsetY: node.y,
            width: 48,
            height: 48,
            backgroundColor: "transparent",
            borderColor: "transparent",
            shape: {
              type: "Image",
              source: `./assets/images/${node.type}.png`,
            } as ImageModel
          });
        }

        for(let key in data.links) {
          const link = data.links[key];

          this.diagram.addConnector({
            sourceID: link.getInterface(0).Host.guid,
            targetID: link.getInterface(1).Host.guid
          });
        }
      }
    });
  }

}
