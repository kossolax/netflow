import { AfterViewInit, Component, Host, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { AnnotationConstraints, ConnectorConstraints, DiagramComponent, DiagramConstraints, NodeConstraints, SnapConstraints, ConnectorModel, DiagramTools, ConnectorDrawingTool, MouseEventArgs, Connector, ToolBase, CommandHandler, BasicShape, BasicShapeModel, NodeModel } from '@syncfusion/ej2-angular-diagrams';
import { timer } from 'rxjs';

import { HardwareInterface, Interface } from 'src/app/models/layers/datalink.model';
import { NetworkInterface } from 'src/app/models/layers/network.model';
import { AbstractLink, Link } from 'src/app/models/layers/physical.model';
import { PhysicalMessage } from 'src/app/models/message.model';
import { Network } from 'src/app/models/network.model';
import { GenericNode, RouterHost, SwitchHost } from 'src/app/models/node.model';
import { LinkLayerSpy } from 'src/app/models/protocols/protocols.model';
import { NetworkService } from 'src/app/services/network.service';
import { SchedulerService } from 'src/app/services/scheduler.service';

@Component({
  selector: 'app-logical',
  templateUrl: './logical.component.html',
  styleUrls: ['./logical.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class LogicalComponent implements AfterViewInit  {
  currentNetwork: Network;
  addingNode: GenericNode|null = null;
  configNode: SwitchHost|RouterHost|null = null;
  networkSpy: LinkLayerSpy = new LinkLayerSpy();

  @ViewChild("diagram") diagram!: DiagramComponent;

  constructor(private network: NetworkService, private scheduler: SchedulerService) {
    this.currentNetwork = new Network();

    setTimeout(() => {
      this.debug();
    }, 100);
    this.configNode = null;
    // this.configNode = new RouterHost("Router-Test", 5);
  }

  debug() {
    let net = new Network();
    let nodes: RouterHost[] = [];
    nodes.push(new RouterHost("Router-1A", 2));
    nodes.push(new RouterHost("Router-1B", 2));

    let index = 0;
    nodes.map( i => {
      i.x = 200 + index * 400;
      i.y = 200;
      net.nodes[i.guid] = i;
      i.getInterfaces().map( j => i.getInterface(j).up() );
      index++;
    });

    let links = [];
    links.push(new Link(nodes[0].getFirstAvailableInterface(), nodes[1].getFirstAvailableInterface(), 10));
    links.map( i => {
      net.links.push(i);
    });

    this.scheduler.repeat(1).subscribe( () => {
      console.log("hi");
      nodes[0].send("coucou", nodes[1].getInterface(0).getNetAddress());
    });


    this.configNode = nodes[0];
    this.network.setNetwork(net);
  }
  ngAfterViewInit(): void {
    this.diagram.constraints = DiagramConstraints.Default | DiagramConstraints.Bridging;
    this.diagram.snapSettings.constraints = SnapConstraints.ShowLines | SnapConstraints.SnapToLines;
    this.diagram.getCustomTool = (action: string) => {
      let tool!: ToolBase;
      if( action == "Draw" )
        tool = new CustomConnectorDrawingTool(this.diagram.commandHandler, "ConnectorSourceEnd", this.diagram.drawingObject as Connector, this);
      return tool;
    };
    this.diagram.drawingObject = {
      type: "Straight",
      sourceDecorator: { shape: "None" },
      targetDecorator: { shape: "None" },
      constraints: ConnectorConstraints.Default & ~ConnectorConstraints.Select,
    } as ConnectorModel;

    this.network.network$.subscribe( (data: Network) => {
      this.currentNetwork = data;
      this.diagram.clear();

      for(let key in data.nodes) {
        this.addNode(data.nodes[key]);
      }
      for(let key in data.links) {
        let link = data.links[key];
        this.addLink(link);
        link.addListener(this.networkSpy);
      }
    });

    this.networkSpy.sendBits$.subscribe( data => {

      if( data.delay < 0.1 ) // this packet is too fast, we don't need to show it
        return;

      this.animate(
        data.source.Host,
        data.destination.Host,
        data.delay,
        data.message.toString()
      );
    });

    this.network.node$.subscribe( (data: GenericNode | AbstractLink | null) => {
      if( data instanceof GenericNode )
        this.addingNode = data;
      else
        this.addingNode = null;

      if( data instanceof AbstractLink )
        this.diagram.tool = DiagramTools.ContinuousDraw;
      else
        this.diagram.tool = DiagramTools.Default;

    });
  }

  onClick(e: any): void {
    if( e.position === undefined || this.addingNode === null )
      return;

    const node = this.addingNode.clone();
    node.x = e.position.x;
    node.y = e.position.y;

    this.onNewNode(node);
  }
  onDoubleClick(e: any) {
    if( e.position === undefined || e.source === null )
      return;

    const nodeId = (e.source as any).properties.id as string;
    const node = this.currentNetwork.nodes[nodeId];
    this.configNode = node as (SwitchHost|RouterHost);
  }

  onNewNode(node: GenericNode) {
    this.currentNetwork.nodes[node.guid] = node;
    this.addNode(node);
    this.network.setNode(null);
  }
  onNewConnexion(
    src: GenericNode, src_iface: HardwareInterface|NetworkInterface,
    dst: GenericNode, dst_iface: HardwareInterface|NetworkInterface): void {
    const link = new Link(src_iface, dst_iface, 1);
    this.currentNetwork.links.push(link);
    this.addLink(link, src.guid, dst.guid);
    this.network.setNode(null);
  }

  addNode(node: GenericNode) {
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
  addLink(link: Link, src_guid?: string, dst_guid?: string) {
    this.diagram.addConnector({
      sourceID: src_guid ?? link.getInterface(0)?.Host.guid,
      targetID: dst_guid ?? link.getInterface(1)?.Host.guid,
      sourceDecorator: { shape: "None" },
      targetDecorator: { shape: "None" },
      constraints: ConnectorConstraints.Default & ~ConnectorConstraints.Select,
      annotations: [{ constraints: AnnotationConstraints.ReadOnly  }]
    });
  }



  public animate(source: GenericNode, target: GenericNode, delay: number, message: string=""): void {
    const start = new Date().getTime() / 1000;

    const node = this.diagram.addNode({
      id: start + "-" + Math.random(),
      offsetX: this.diagram.getNodeObject(source.guid).offsetX,
      offsetY: this.diagram.getNodeObject(source.guid).offsetY as number - 10,
      width: 30,
      height: 30,
      shape: {
        type: "Basic",
        shape: "Rectangle",
      } as BasicShapeModel,
      constraints: NodeConstraints.ReadOnly,
      annotations: [{
        content: message,
        constraints: AnnotationConstraints.ReadOnly,
      }]
    });

    const render = (() => {
      const now = new Date().getTime() / 1000;
      const progress = (now - start) / delay;

      if( progress > 1 ) {
        this.diagram.removeElements(node);
      }
      else {
        let src = {
          x: this.diagram.getNodeObject(source.guid).offsetX as number,
          y: this.diagram.getNodeObject(source.guid).offsetY as number,
        }
        let dst = {
          x: this.diagram.getNodeObject(target.guid).offsetX as number,
          y: this.diagram.getNodeObject(target.guid).offsetY as number,
        }

        node.offsetX = src.x + (dst.x - src.x) * progress;
        node.offsetY = src.y + (dst.y - src.y) * progress - 10;
        requestAnimationFrame(render);
      }
    });

    requestAnimationFrame(render);

  }
}

class CustomConnectorDrawingTool extends ConnectorDrawingTool {
  private component: LogicalComponent;

  private startNode: SwitchHost|RouterHost|null = null;
  private startIface: HardwareInterface|NetworkInterface|null = null;

  private stopNode: SwitchHost|RouterHost|null = null;
  private stopIface: HardwareInterface|NetworkInterface|null = null;

  constructor(commandHandler: CommandHandler, endPoint: string, sourceObject: Connector, parentComponent: LogicalComponent) {
    super(commandHandler, endPoint, sourceObject);
    this.component = parentComponent;
  }

  public override endAction(): void {
    try {
      if( !this.startNode || !this.startIface )
        this.blocked = true;
      if( !this.stopNode || !this.stopIface )
        this.blocked = true;

      if( !this.blocked ) {
        this.component.onNewConnexion(
          this.startNode as GenericNode, this.startIface as (HardwareInterface|NetworkInterface),
          this.stopNode as GenericNode, this.stopIface as (HardwareInterface|NetworkInterface)
        );
      }

    }
    catch(e) {
      console.log(e);
    }

    this.commandHandler.diagram.remove(this.commandHandler.diagram.currentDrawingObject);
  }
  public override mouseMove(args: MouseEventArgs): boolean {
    if( !this.blocked )
      return super.mouseMove(args);
    return false;
  }
  public override mouseUp(args: MouseEventArgs): Promise<void> {
    try {
      if( !args.target )
        throw new Error("No target node");

      const nodeId = (args.target as any).properties.id as string;
      this.stopNode = this.component.currentNetwork.nodes[nodeId] as (SwitchHost|RouterHost);
      this.stopIface = this.stopNode.getFirstAvailableInterface();

    } catch( e ) {
      this.blocked = true;
    }

    return super.mouseUp(args);
  }
  public override mouseDown(args: MouseEventArgs): Promise<void> {
    try {
      if( !args.source )
        throw new Error("No source node");

      const nodeId = (args.source as any).properties.id as string;
      this.startNode = this.component.currentNetwork.nodes[nodeId] as (SwitchHost|RouterHost);
      this.startIface = this.startNode.getFirstAvailableInterface();

    } catch( e ) {
      this.blocked = true;
      this.commandHandler.diagram.remove(this.commandHandler.diagram.currentDrawingObject);
    }

    return super.mouseDown(args);
  }


}
