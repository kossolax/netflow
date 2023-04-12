import { AfterViewInit, Component, Host, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { AnnotationConstraints, ConnectorConstraints, DiagramComponent, DiagramConstraints, NodeConstraints, SnapConstraints, ConnectorModel, DiagramTools, ConnectorDrawingTool, MouseEventArgs, Connector, ToolBase, CommandHandler, BasicShape, BasicShapeModel, NodeModel, DecoratorModel } from '@syncfusion/ej2-angular-diagrams';
import { resetIncrementalSearchValues } from '@syncfusion/ej2-angular-dropdowns';
import { ignoreElements, Subject, takeUntil, timer } from 'rxjs';
import { IPAddress, MacAddress } from 'src/app/models/address.model';

import { Dot1QInterface, EthernetInterface, HardwareInterface, Interface } from 'src/app/models/layers/datalink.model';
import { NetworkInterface } from 'src/app/models/layers/network.model';
import { AbstractLink, Link } from 'src/app/models/layers/physical.model';
import { PhysicalMessage } from 'src/app/models/message.model';
import { Network } from 'src/app/models/network.model';
import { ComputerHost, GenericNode, L4Host, RouterHost, ServerHost, SwitchHost } from 'src/app/models/node.model';
import { VlanMode } from 'src/app/models/protocols/ethernet.model';
import { ICMPMessage, ICMPType } from 'src/app/models/protocols/icmp.model';
import { LinkLayerSpy } from 'src/app/models/protocols/protocols.model';
import { DhcpPool } from 'src/app/models/services/dhcp.model';
import { SpanningTreeState } from 'src/app/models/services/spanningtree.model';
import { NetworkService } from 'src/app/services/network.service';
import { SchedulerService, SchedulerState } from 'src/app/services/scheduler.service';

@Component({
  selector: 'app-logical',
  templateUrl: './logical.component.html',
  styleUrls: ['./logical.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class LogicalComponent implements AfterViewInit, OnDestroy  {
  public currentNetwork: Network;
  public addingNode: GenericNode|null = null;
  public configNode: SwitchHost|RouterHost|null = null;
  public networkSpy: LinkLayerSpy = new LinkLayerSpy();

  private onDestroy$: Subject<void> = new Subject<void>();

  @ViewChild("diagram") public diagram!: DiagramComponent;

  constructor(private network: NetworkService, private scheduler: SchedulerService) {
    this.currentNetwork = new Network();
    //this.scheduler.Speed = SchedulerState.FASTER;

    setTimeout(() => {
      this.debug();
    }, 100);
    this.configNode = null;
  }

  private debug(): void {
    const vlan = false;
    let net = new Network();
    let nodes: (RouterHost|SwitchHost|L4Host)[] = [];
    nodes.push(new RouterHost("Router-1A", 2));
    nodes.push(new SwitchHost("Switch-1A", 8));
    nodes.push(new SwitchHost("Switch-1B", 8));
    nodes.push(new SwitchHost("Switch-1C", 8));
    nodes.push(new RouterHost("Router-1B", 2));
    nodes.push(new RouterHost("Router-2", 1));
    nodes.push(new ServerHost("Server-1", "server", 1));
    nodes.push(new ComputerHost("Computer-1", "pc", 1));

    let i = 0;

    // Router-1A:
    (nodes[i] as RouterHost).getInterface(0).setNetAddress(new IPAddress("192.168.0.1"));
    (nodes[i] as RouterHost).addRoute("192.168.0.0", "255.255.255.0", "192.168.0.1");
    (nodes[i] as RouterHost).addRoute("0.0.0.0", "0.0.0.0", "192.168.0.2");
    nodes[i].x = 200;
    nodes[i].y = 200;
    net.nodes[nodes[i].guid] = nodes[i++];

    // Switch-1A:
    (nodes[i] as SwitchHost).getInterface(0).setMacAddress(new MacAddress("00:00:00:00:00:03"));
    if( vlan ) {
      ((nodes[i] as SwitchHost).getInterface(0) as Dot1QInterface).VlanMode = VlanMode.Access;
      ((nodes[i] as SwitchHost).getInterface(0) as Dot1QInterface).addVlan(10);
      ((nodes[i] as SwitchHost).getInterface(1) as Dot1QInterface).VlanMode = VlanMode.Trunk;
      ((nodes[i] as SwitchHost).getInterface(1) as Dot1QInterface).addVlan(10);
      ((nodes[i] as SwitchHost).getInterface(1) as Dot1QInterface).addVlan(20);
      ((nodes[i] as SwitchHost).getInterface(2) as Dot1QInterface).VlanMode = VlanMode.Trunk;
      ((nodes[i] as SwitchHost).getInterface(2) as Dot1QInterface).addVlan(10);
      ((nodes[i] as SwitchHost).getInterface(2) as Dot1QInterface).addVlan(20);
      ((nodes[i] as SwitchHost).getInterface(3) as Dot1QInterface).VlanMode = VlanMode.Access;
      ((nodes[i] as SwitchHost).getInterface(3) as Dot1QInterface).addVlan(20);
    }
    nodes[i].x = 400;
    nodes[i].y = 200;
    net.nodes[nodes[i].guid] = nodes[i++];

    // Switch-1B:
    (nodes[i] as SwitchHost).getInterface(0).setMacAddress(new MacAddress("00:00:00:00:00:02"));
    if( vlan ) {
      ((nodes[i] as SwitchHost).getInterface(0) as Dot1QInterface).VlanMode = VlanMode.Trunk;
      ((nodes[i] as SwitchHost).getInterface(0) as Dot1QInterface).addVlan(10);
      ((nodes[i] as SwitchHost).getInterface(0) as Dot1QInterface).addVlan(20);
      ((nodes[i] as SwitchHost).getInterface(1) as Dot1QInterface).VlanMode = VlanMode.Access;
      ((nodes[i] as SwitchHost).getInterface(1) as Dot1QInterface).addVlan(10);
      ((nodes[i] as SwitchHost).getInterface(2) as Dot1QInterface).VlanMode = VlanMode.Trunk;
      ((nodes[i] as SwitchHost).getInterface(2) as Dot1QInterface).addVlan(10);
      ((nodes[i] as SwitchHost).getInterface(2) as Dot1QInterface).addVlan(20);
      ((nodes[i] as SwitchHost).getInterface(3) as Dot1QInterface).VlanMode = VlanMode.Access;
      ((nodes[i] as SwitchHost).getInterface(3) as Dot1QInterface).addVlan(20);
    }
    nodes[i].x = 600;
    nodes[i].y = 200;
    net.nodes[nodes[i].guid] = nodes[i++];

    // Switch-1C:
    (nodes[i] as SwitchHost).getInterface(0).setMacAddress(new MacAddress("00:00:00:00:00:01"));
    if( vlan ) {
      ((nodes[i] as SwitchHost).getInterface(0) as Dot1QInterface).VlanMode = VlanMode.Trunk;
      ((nodes[i] as SwitchHost).getInterface(0) as Dot1QInterface).addVlan(10);
      ((nodes[i] as SwitchHost).getInterface(0) as Dot1QInterface).addVlan(20);
      ((nodes[i] as SwitchHost).getInterface(1) as Dot1QInterface).VlanMode = VlanMode.Trunk;
      ((nodes[i] as SwitchHost).getInterface(1) as Dot1QInterface).addVlan(10);
      ((nodes[i] as SwitchHost).getInterface(1) as Dot1QInterface).addVlan(20);
    }
    nodes[i].x = 500;
    nodes[i].y = 400;
    net.nodes[nodes[i].guid] = nodes[i++];


    // Router-1B:
    (nodes[i] as RouterHost).getInterface(0).setNetAddress(new IPAddress("192.168.0.2"));
    (nodes[i] as RouterHost).getInterface(1).setNetAddress(new IPAddress("192.168.1.2"));
    (nodes[i] as RouterHost).addRoute("192.168.0.0", "255.255.255.0", "192.168.0.2");
    (nodes[i] as RouterHost).addRoute("192.168.1.0", "255.255.255.0", "192.168.1.2");
    nodes[i].x = 800;
    nodes[i].y = 200;
    net.nodes[nodes[i].guid] = nodes[i++];

    // Router-2:
    (nodes[i] as RouterHost).getInterface(0).setNetAddress(new IPAddress("192.168.1.1"));
    (nodes[i] as RouterHost).addRoute("192.168.1.0", "255.255.255.0", "192.168.1.1");
    (nodes[i] as RouterHost).addRoute("0.0.0.0", "0.0.0.0", "192.168.1.2");
    nodes[i].x = 800;
    nodes[i].y = 400;
    net.nodes[nodes[i].guid] = nodes[i++];

    // Server-1:
    (nodes[i] as ServerHost).getInterface(0).setNetAddress(new IPAddress("192.168.0.3"));
    nodes[i].x = 300;
    nodes[i].y = 400;
    (nodes[i] as ServerHost).services.dhcp.Enable = true;

    (nodes[i] as ServerHost).services.dhcp.pools.push(new DhcpPool("pool1",
    new IPAddress("192.168.0.2"), new IPAddress("255.255.255.0"),
    new IPAddress("192.168.0.10"), new IPAddress("192.168.0.254")
    ));
    net.nodes[nodes[i].guid] = nodes[i++];

    // Computer-1:
    nodes[i].x = 700;
    nodes[i].y = 400;
    net.nodes[nodes[i].guid] = nodes[i++];


    let links = [];
    links.push(new Link(nodes[0].getFirstAvailableInterface(), nodes[1].getFirstAvailableInterface(), 10));
    links.push(new Link(nodes[1].getFirstAvailableInterface(), nodes[2].getFirstAvailableInterface(), 10));
    links.push(new Link(nodes[1].getFirstAvailableInterface(), nodes[3].getFirstAvailableInterface(), 10));
    links.push(new Link(nodes[1].getFirstAvailableInterface(), nodes[6].getFirstAvailableInterface(), 10));
    links.push(new Link(nodes[2].getFirstAvailableInterface(), nodes[4].getFirstAvailableInterface(), 10));
    links.push(new Link(nodes[2].getFirstAvailableInterface(), nodes[3].getFirstAvailableInterface(), 10));
    links.push(new Link(nodes[2].getFirstAvailableInterface(), nodes[7].getFirstAvailableInterface(), 10));

    links.push(new Link(nodes[4].getFirstAvailableInterface(), nodes[5].getFirstAvailableInterface(), 10));
    //links.push(new Link(nodes[3].getFirstAvailableInterface(), nodes[4].getFirstAvailableInterface(), 10));
    //links.push(new Link(nodes[1].getFirstAvailableInterface(), nodes[5].getFirstAvailableInterface(), 10));
    //links.push(new Link(nodes[2].getFirstAvailableInterface(), nodes[6].getFirstAvailableInterface(), 10));

    links.map( i => {
      net.links.push(i);
    });

    this.scheduler.repeat(20).pipe(
      takeUntil(this.onDestroy$)
    ).subscribe( () => {

      const icmp = new ICMPMessage.Builder()
        .setNetSource((nodes[0] as RouterHost).getInterface(0).getNetAddress() as IPAddress)
        .setNetDestination(new IPAddress("192.168.0.2"))
        .setType(ICMPType.EchoRequest)
        .build();

      icmp.map( i => (nodes[0] as RouterHost).send(i) );
    });
    this.scheduler.repeat(1).subscribe( () => {
      //nodes[4].send("B", (nodes[0].getInterface(0) as NetworkInterface).getNetAddress());
    });

    this.scheduler.once(0.1).subscribe( () => {
      nodes.map( i => {
        i.getInterfaces().map( j => i.getInterface(j).up() );
      });
    });


    //this.configNode = nodes[0];
    this.network.setNetwork(net);
  }


  public ngOnDestroy(): void {
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }
  public ngAfterViewInit(): void {
    this.diagram.constraints = DiagramConstraints.Default | DiagramConstraints.Bridging;
    this.diagram.snapSettings.constraints = SnapConstraints.ShowLines | SnapConstraints.SnapToLines;
    this.diagram.getCustomTool = (action: string): ToolBase => {
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

    this.network.network$.pipe(
      takeUntil(this.onDestroy$)
    ).subscribe( (data: Network) => {
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

    this.networkSpy.sendBits$.pipe(
      takeUntil(this.onDestroy$)
    ).subscribe( data => {
      this.animate(
        data.source.Host,
        data.destination.Host,
        data.delay,
        data.message.toString()
      );
    });

    this.network.node$.pipe(
      takeUntil(this.onDestroy$)
    ).subscribe( (data: GenericNode | AbstractLink | null) => {
      if( data instanceof GenericNode )
        this.addingNode = data;
      else
        this.addingNode = null;

      if( data instanceof AbstractLink )
        this.diagram.tool = DiagramTools.ContinuousDraw;
      else
        this.diagram.tool = DiagramTools.Default;

    });

    timer(1000, 1000).pipe(
      takeUntil(this.onDestroy$)
    ).subscribe( () => {

    });
  }

  public onClick(e: any): void {
    if( e.position === undefined || this.addingNode === null )
      return;

    const node = this.addingNode.clone();
    node.x = e.position.x;
    node.y = e.position.y;

    this.onNewNode(node);
  }
  public onDoubleClick(e: any): void {
    if( e.position === undefined || e.source === null )
      return;

    const nodeId = (e.source as any).properties.id as string;
    const node = this.currentNetwork.nodes[nodeId];
    this.configNode = node as (SwitchHost|RouterHost);
  }

  public onNewNode(node: GenericNode): void {
    this.currentNetwork.nodes[node.guid] = node;
    this.addNode(node);
    this.network.setNode(null);
  }
  public onNewConnexion(
    src: GenericNode, src_iface: HardwareInterface|NetworkInterface,
    dst: GenericNode, dst_iface: HardwareInterface|NetworkInterface): void {
    const link = new Link(src_iface, dst_iface, 1);
    this.currentNetwork.links.push(link);
    this.addLink(link, src.guid, dst.guid);
    this.network.setNode(null);
  }

  private addNode(node: GenericNode): void {
    this.diagram.add({
      id: node.guid,
      offsetX: node.x,
      offsetY: node.y,
      width: 48,
      height: 48,
      style: {
        fill: "transparent",
        strokeColor: "transparent",
      },
      annotations: [{
        content: node.name,
        horizontalAlignment: 'Center',
        verticalAlignment: 'Top',
        offset: { x: 0.5, y: 1 },
        style: {
          fill: '#ffffff',
        },
        constraints: AnnotationConstraints.ReadOnly,
      }],
      shape: {
        type: "Image",
        source: `./assets/images/icons/${node.type}.png`,
      },
      constraints: NodeConstraints.Default & ~NodeConstraints.Resize & ~NodeConstraints.Rotate | NodeConstraints.HideThumbs,
    });
  }
  private addLink(link: Link, src_guid?: string, dst_guid?: string): void {
    const black = "#505050";
    const red = '#f44336';
    const orange = '#f4af50';
    const green = '#4caf50';
    const blue = '#2196f3';
    const white = '#ffffff';

    function getIfaceColor(iface: Interface|null): string {
      if( iface === null )
        return black;

      if( iface.isActive() === false )
        return red;

      if( iface instanceof HardwareInterface && iface.Host instanceof SwitchHost ) {
        if( iface.Host.spanningTree.State(iface) == SpanningTreeState.Blocking )
          return orange;
        if( iface.Host.spanningTree.State(iface) == SpanningTreeState.Listening )
          return blue;
        if( iface.Host.spanningTree.State(iface) == SpanningTreeState.Learning )
          return blue;
        if( iface.Host.spanningTree.State(iface) == SpanningTreeState.Forwarding )
          return green;
      }

      return green;
    }

    const connector = this.diagram.addConnector({
      sourceID: src_guid ?? link.getInterface(0)?.Host.guid,
      targetID: dst_guid ?? link.getInterface(1)?.Host.guid,
      sourceDecorator: { shape: "Square", style: { fill: getIfaceColor(link.getInterface(0)) } },
      targetDecorator: { shape: "Square", style: { fill: getIfaceColor(link.getInterface(0)) } },
      constraints: ConnectorConstraints.Default & ~ConnectorConstraints.Select,
      annotations: [{ constraints: AnnotationConstraints.ReadOnly  }],
    });

    function OnInterfaceEvent(iface: Interface, decorator: DecoratorModel, message: string): void {
      if( decorator.style )
        decorator.style.fill = getIfaceColor(iface);
    }

    link.getInterface(0)?.addListener((msg, iface) => OnInterfaceEvent(iface as Interface, connector.sourceDecorator, msg));
    link.getInterface(1)?.addListener((msg, iface) => OnInterfaceEvent(iface as Interface, connector.targetDecorator, msg));
  }


  private animate(source: GenericNode, target: GenericNode, delay: number, message: string=""): void {
    function blink(decorator: DecoratorModel|undefined, delay: number): void {
      if( decorator === undefined )
        return;

      if( decorator.style )
        decorator.style.opacity = 0.5;

      setTimeout(() => {
        if( decorator.style )
          decorator.style.opacity = 1.0;
      }, 10);
    }

    if( delay < 0.01 ) { // this packet is too fast, we don't need to show it
      const connector = this.diagram.connectors.find( i => {
        if( (i.sourceID == source.guid || i.sourceID == target.guid ) &&
            (i.targetID == source.guid || i.targetID == target.guid )
        ) {
          return true;
        }
        return false;
      });
      const sourceDecorator = connector?.sourceID == source.guid ? connector.sourceDecorator : connector?.targetDecorator;
      const targetDecorator = connector?.sourceID == target.guid ? connector.sourceDecorator : connector?.targetDecorator;

      blink(sourceDecorator, delay);
      blink(targetDecorator, delay);
      return;
    }

    const start = new Date().getTime() / 1000 * this.scheduler.SpeedOfLight;

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
      }],
    });

    const render = ((): void => {
      const now = new Date().getTime() / 1000 * this.scheduler.SpeedOfLight;
      const progress = (now - start) / delay;

      if( progress > 1 ) {
        this.diagram.removeNode(node, []);
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
