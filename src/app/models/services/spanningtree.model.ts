import { Subscription } from "rxjs";
import { SchedulerService } from "src/app/services/scheduler.service";
import { HardwareAddress, MacAddress } from "../address.model";
import { HardwareInterface, Interface } from "../layers/datalink.model";
import { DatalinkMessage, Payload } from "../message.model";
import { GenericNode, SwitchHost } from "../node.model";
import { EthernetMessage } from "../protocols/ethernet.model";
import { ActionHandle, DatalinkListener } from "../protocols/protocols.model";
import { NetworkServices } from "./dhcp.model";

export enum SpanningTreeState {
  Disabled,
  Listening,
  Learning,
  Forwarding,
  Blocking,
};
enum MessageType {
  configuration,
  topologyChange,
};
export enum SpanningTreePortRole {
  Disabled,
  Root,
  Designated,
  Blocked,
  Alternate,
  Backup,
};


const SpanningTreeMultiCastAddress = new MacAddress("01:80:C2:00:00:00");

export class SpanningTreeMessage extends EthernetMessage {
  public protocol_id = 0;
  public version = 0;
  public message_type: MessageType = MessageType.configuration;
  public flags = {
    topology_change: false,
    topology_change_ack: false,
  }
  public root_id = {
    priority: 32768,
    mac: new MacAddress("FF:FF:FF:FF:FF:FF"),
  }
  public root_path_cost = 0;
  public bridge_id = {
    priority: 32768,
    mac: new MacAddress("FF:FF:FF:FF:FF:FF"),
  }
  public port_id = {
    priority: 32768,
    global_id: 0,
  }

  public message_age = 0;
  public max_age = 20;
  public hello_time = 2;
  public forward_delay = 15;


  protected constructor(payload: Payload|string,
    mac_src: HardwareAddress, mac_dst: HardwareAddress|null) {
    super(payload, mac_src, mac_dst);
  }

  public static override Builder = class extends (EthernetMessage.Builder) {
    private type = MessageType.configuration;
    public setType(type: MessageType): this {
      this.type = type;
      return this;
    }

    private bridge = new MacAddress("FF:FF:FF:FF:FF:FF");
    public setBridge(bridge: MacAddress): this {
      this.bridge = bridge;

      if(this.bridge.compareTo(this.root) < 0)
        this.root = this.bridge;

      return this;
    }

    private root = new MacAddress("FF:FF:FF:FF:FF:FF");
    public setRoot(root: MacAddress): this {
      this.root = root;
      return this;
    }

    private cost = 0;
    public setCost(cost: number): this {
      this.cost = cost;
      return this;
    }

    private port = 0;
    public setPort(port: number|string): this {
      // convert string to number using hashcode
      if( typeof port === "string" ) {
        let hash = 0;
        for (let i = 0; i < port.length; i++)
          hash = port.charCodeAt(i) + ((hash << 5) - hash);
        this.port = hash;
      }
      else {
        this.port = port;
      }
      return this;
    }
    private age = -1;
    public setMessageAge(age: number): this {
      this.age = age;
      return this;
    }

    public override build(): EthernetMessage {
      const message = new SpanningTreeMessage(this.payload, this.bridge, SpanningTreeMultiCastAddress);
      message.mac_src = this.mac_src as MacAddress;
      message.bridge_id.mac = this.bridge;
      message.root_id.mac = this.root;
      message.message_type = this.type;
      message.root_path_cost = this.cost;
      message.port_id.global_id = this.port;
      message.message_age = this.age > 0 ? this.age : SchedulerService.Instance.getDeltaTime();

      return message;
    }
  }
}

export class PVSTPService extends NetworkServices<SwitchHost> implements DatalinkListener {
  private roles = new Map<HardwareInterface, SpanningTreePortRole>();
  private state = new Map<HardwareInterface, SpanningTreeState>();
  private cost = new Map<HardwareInterface, number>();
  private maxAge = 20;
  private helloTime = 2;
  private forwardDelay = 15;

  private switchToDebug = "Switch-1A";

  private root_id = {
    mac: new MacAddress("FF:FF:FF:FF:FF:FF"),
    priority: 32768,
  };
  private bridge_id = {
    mac: new MacAddress("FF:FF:FF:FF:FF:FF"),
    priority: 32768,
  }

  constructor(host: SwitchHost) {
    super(host);

    host.addListener( (msg, iface) => {
      if( msg === "OnInterfaceAdded" )
        this.setDefaultRoot();
    });

    this.setDefaultRoot();
    SchedulerService.Instance.repeat(this.helloTime).subscribe( () => this.negociate() );
  }

  public State(iface: HardwareInterface): SpanningTreeState {
    return this.state.get(iface) ?? SpanningTreeState.Disabled;
  }
  public Role(iface: HardwareInterface): SpanningTreePortRole {
    return this.roles.get(iface) ?? SpanningTreePortRole.Disabled;
  }
  public Cost(iface: HardwareInterface): number {
    return this.cost.get(iface) ?? Number.MAX_VALUE;
  }


  override set Enable(enable: boolean) {
    super.Enable = enable;
    this.setDefaultRoot();
  }
  override get Enable(): boolean {
    return this.enabled;
  }

  private setDefaultRoot(): void {
    this.bridge_id.mac = new MacAddress("FF:FF:FF:FF:FF:FF");

    this.host.getInterfaces().map( i => {
      const iface = this.host.getInterface(i);
      const mac = iface.getMacAddress() as MacAddress;

      if( mac.compareTo(this.root_id.mac) < 0 )
        this.root_id.mac = mac;

      if( mac.compareTo(this.bridge_id.mac) < 0 )
        this.bridge_id.mac = mac;

      if( this.Enable && iface.isActive()  && iface.isConnected ) {
        if( this.roles.get(iface) === undefined ) { // boot, we are the root. So the COST is 0.
          this.changeRole(iface, SpanningTreePortRole.Designated);
          this.changeState(iface, SpanningTreeState.Blocking);
          this.cost.set(iface, 0);
        }
      }
      if( !this.Enable ) {
        this.changeRole(iface, SpanningTreePortRole.Disabled);
        this.changeState(iface, SpanningTreeState.Disabled);
        this.roles.delete(iface);
        this.state.delete(iface);
        this.changingState.delete(iface);
      }
    });

  }

  private changingState: Map<HardwareInterface, Subscription> = new Map();
  private changeState(iface: HardwareInterface, state: SpanningTreeState): void {
    let oldState = this.state.get(iface) as SpanningTreeState;
    this.state.set(iface, state);

    if( state != oldState ) {
      const name = this.host.getInterfaces().find( i => this.host.getInterface(i) === iface );
      if( this.host.name === this.switchToDebug )
        console.warn(this.host.name, "change state", name, "from", SpanningTreeState[oldState], "to", SpanningTreeState[state]);
      iface.trigger("OnInterfaceChange");

      this.changingState.get(iface)?.unsubscribe();
      switch(state) {
        case SpanningTreeState.Blocking:
          this.changingState.set(iface, SchedulerService.Instance.once(this.maxAge).subscribe( () => {
            this.changeState(iface, SpanningTreeState.Listening);
          }));
          break;
        case SpanningTreeState.Listening:
          this.changingState.set(iface, SchedulerService.Instance.once(this.forwardDelay).subscribe( () => {
            this.changeState(iface, SpanningTreeState.Learning);
          }));
          break;
        case SpanningTreeState.Learning:
          this.changingState.set(iface, SchedulerService.Instance.once(this.forwardDelay).subscribe( () => {
            this.changeState(iface, SpanningTreeState.Forwarding);
          }));
          break;
        case SpanningTreeState.Forwarding:
          break;
      }
    }
  }
  private changeRole(iface: HardwareInterface, role: SpanningTreePortRole): void {
    let oldRole = this.roles.get(iface) as SpanningTreePortRole;
    this.roles.set(iface, role);

    if( this.roles.get(iface) !== oldRole ) {
      const name = this.host.getInterfaces().find( i => this.host.getInterface(i) === iface );
      if( this.host.name === this.switchToDebug )
        console.error(this.host.name, "change role", name, "from", SpanningTreePortRole[oldRole], "to", SpanningTreePortRole[role]);
      iface.trigger("OnInterfaceChange");


      switch(role) {
        case SpanningTreePortRole.Backup:
        case SpanningTreePortRole.Blocked:
          this.changeState(iface, SpanningTreeState.Blocking);
          break;
      }
    }
  }

  public negociate(): void {
    if( !this.Enable )
      return;

    this.setDefaultRoot();

    if( this.root_id.mac.equals(this.bridge_id.mac) || false ) {

      this.host.getInterfaces().map( i => {
        const iface = this.host.getInterface(i);
        if( iface.isActive() === false || iface.isConnected === false ) return;

        const message = new SpanningTreeMessage.Builder()
          .setMacSource(iface.getMacAddress() as MacAddress)
          .setBridge(this.bridge_id.mac)
          .setRoot(this.root_id.mac)
          .setPort(i)
          .setCost(this.Cost(iface))
          .setMessageAge(SchedulerService.Instance.getDeltaTime())
          .build();

        iface.sendTrame(message);
      });
    }
  }

  public receiveTrame(message: DatalinkMessage, from: Interface): ActionHandle {

    if( message instanceof SpanningTreeMessage ) {

      if( message.message_age + this.maxAge > SchedulerService.Instance.getDeltaTime() + this.maxAge )
        return ActionHandle.Stop;
      if( message.bridge_id.mac.equals(this.bridge_id.mac) )
        return ActionHandle.Stop;

      if( this.root_id.priority < message.root_id.priority ||
        (this.root_id.priority == message.root_id.priority && message.root_id.mac.compareTo(this.root_id.mac) < 0) ) {
        this.root_id.mac = message.root_id.mac;
        this.root_id.priority = message.root_id.priority;

        this.forwardDelay = message.forward_delay;
        this.helloTime = message.hello_time;
        this.maxAge = message.max_age;

        this.cost.clear();
      }

      if( this.Cost(from as HardwareInterface) > message.root_path_cost ) {
        this.cost.set(from as HardwareInterface, message.root_path_cost);
        const name = this.host.getInterfaces().find( i => this.host.getInterface(i) === from );
        console.log(this.host.name, "change cost", name, "to", message.root_path_cost);
      }

      // I'm not the root
      if( this.bridge_id.mac.equals(this.root_id.mac) === false ) {
        let bestInterface:HardwareInterface|null = null;
        let bestCost = Number.MAX_VALUE;

        this.host.getInterfaces().map( i => {
          const iface = this.host.getInterface(i);
          if( iface.isActive() === false || iface.isConnected === false ) return;

          const cost = this.Cost(iface);
          if( cost < bestCost ) {
              bestInterface = iface;
              bestCost = cost;
          }
        });

        if( bestInterface ) {
          this.host.getInterfaces().map( i => {
            const iface = this.host.getInterface(i);
            if( iface.isActive() === false || iface.isConnected === false ) return;

            if( iface === bestInterface )
              this.changeRole(iface, SpanningTreePortRole.Root);
            else
              this.changeRole(iface, SpanningTreePortRole.Designated);
          });
        }

        const hasRoot = this.host.getInterfaces().find( i => this.roles.get(this.host.getInterface(i)) === SpanningTreePortRole.Root );
        if( hasRoot && this.Role(from as HardwareInterface) !== SpanningTreePortRole.Root ) {
          const iface = from as HardwareInterface;
          const name = this.host.getInterfaces().find( i => this.host.getInterface(i) === iface );

          if( iface.getMacAddress().compareTo(message.mac_src) >= 0 )
            this.changeRole(iface, SpanningTreePortRole.Blocked);
          else
            this.changeRole(iface, SpanningTreePortRole.Designated);
        }

        if( this.State(from as HardwareInterface) === SpanningTreeState.Blocking )
          return ActionHandle.Stop;

        this.host.getInterfaces().map( i => {
          const iface = this.host.getInterface(i);
          if( iface.isActive() === false || iface.isConnected === false ) return;
          if( this.State(iface) === SpanningTreeState.Blocking ) return;

          if( iface !== from ) {
            const forwarded = new SpanningTreeMessage.Builder()
              .setMacSource(iface.getMacAddress() as MacAddress)
              .setBridge(this.bridge_id.mac)
              .setRoot(message.root_id.mac)
              .setCost(message.root_path_cost + 10)
              .setPort(message.port_id.global_id)
              .setMessageAge(message.message_age)
              .build();
            iface.sendTrame(forwarded);
          }
        });

      }

      return ActionHandle.Handled;
    }

    return ActionHandle.Continue;
  }
}
