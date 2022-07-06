import { AfterViewInit, Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { AnnotationConstraints, ConnectorConstraints, DiagramComponent, DiagramConstraints, ImageModel, NodeConstraints, SnapConstraints, SnapSettingsModel } from '@syncfusion/ej2-angular-diagrams';

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
      this.diagram.clear();
      this.diagram.constraints = DiagramConstraints.Default | DiagramConstraints.Bridging;
      this.diagram.snapSettings.constraints = SnapConstraints.ShowLines | SnapConstraints.SnapToLines


      if( data != null ) {
        for(let key in data.nodes) {
          const node = data.nodes[key];

          this.diagram.add({
            id: node.guid,
            offsetX: node.x,
            offsetY: node.y,
            width: 48,
            height: 48,
            style: {
              fill: "transparent",
              strokeColor: "transparent"
            },
            annotations: [{
              content: node.name,
              horizontalAlignment: 'Center',
              verticalAlignment: 'Top',
              offset: { x: 0.5, y: 1 },
              style: {
                fill: '#ffffff',
              },
              constraints: AnnotationConstraints.ReadOnly
            }],
            shape: {
              type: "Image",
              source: `./assets/images/icons/${node.type}.png`,
            },
            constraints: NodeConstraints.Default & ~NodeConstraints.Resize & ~NodeConstraints.Rotate | NodeConstraints.HideThumbs,
          });
        }

        for(let key in data.links) {
          const link = data.links[key];

          this.diagram.addConnector({
            sourceID: link.getInterface(0).Host.guid,
            targetID: link.getInterface(1).Host.guid,
            sourceDecorator: { shape: "None" },
            targetDecorator: { shape: "None" },
            constraints: ConnectorConstraints.Default & ~ConnectorConstraints.Select,
            annotations: [{ constraints: AnnotationConstraints.ReadOnly  }]
          });
        }

      }
    });
  }

}
