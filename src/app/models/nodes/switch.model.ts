import { Subject } from "rxjs";
import { Dot1QInterface, HardwareInterface } from "../layers/datalink.model";
import { ActionHandle, DatalinkListener, handleChain } from "../protocols/protocols.model";
import { Node } from "./generic.model";
import { DatalinkMessage } from "../message.model";
import { PVSTPService, SpanningTreeMessage, SpanningTreeState } from "../services/spanningtree.model";
import { SchedulerService } from "src/app/services/scheduler.service";
import { HardwareAddress, MacAddress } from "../address.model";
import { Dot1QMessage, EthernetMessage, VlanMode } from "../protocols/ethernet.model";

export class SwitchHost extends Node<HardwareInterface> implements DatalinkListener {
  public override name = "Switch";
  public override type = "switch";
  public receiveTrame$: Subject<DatalinkMessage> = new Subject<DatalinkMessage>();
  public knownVlan: Record<number, string> = {};
  public spanningTree: PVSTPService;

  private ARPTable: Map<string, {iface: HardwareInterface, lastSeen: number}[]> = new Map<string, {iface: HardwareInterface, lastSeen: number}[]>();

  constructor(name: string="", iface: number=0, spanningTreeSupport: boolean=false) {
    super();
    if( name != "" )
      this.name = name;


    for(let i=0; i<iface; i++)
      this.addInterface();

    this.spanningTree = new PVSTPService(this);
    this.spanningTree.Enable = spanningTreeSupport;

    SchedulerService.Instance.repeat(10).subscribe(() => {
      this.cleanARPTable();
    });
  }

  public addInterface(name: string = ""): HardwareInterface {
    const mac = MacAddress.generateAddress();

    if( name == "" )
      name = "gig0/" + Object.keys(this.interfaces).length;

    const iface = new Dot1QInterface(this, mac, name, 10, 1000, true);
    iface.addListener(this);
    this.interfaces[name] = iface;
    handleChain("on", this.getListener, "OnInterfaceAdded", iface);

    return iface;
  }

  public clone(): SwitchHost {
    const clone = new SwitchHost();
    this.cloneInto(clone);
    return clone;
  }

  public send(message: string|DatalinkMessage, dst?: HardwareAddress): void {
    if( message instanceof DatalinkMessage ) {
      for( const name in this.interfaces ) {
        if( this.interfaces[name].hasMacAddress(message.mac_src as HardwareAddress) ) {
          if( this.spanningTree.State(this.interfaces[name]) === SpanningTreeState.Blocking )
            continue;
          this.interfaces[name].sendTrame(message);
        }
      }
    }
    else {
      if( dst === undefined )
        throw new Error("Destination address is undefined");
      const src = this.getInterface(0).getMacAddress();

      const msg = new DatalinkMessage(
        message,
        src, dst
      );

      for( const name in this.interfaces ) {
        if( this.interfaces[name].hasMacAddress(msg.mac_src as HardwareAddress) ) {
          if( this.spanningTree.State(this.interfaces[name]) === SpanningTreeState.Blocking )
            continue;
          this.interfaces[name].sendTrame(msg);
        }
      }
    }

  }

  public receiveTrame(message: DatalinkMessage, from: HardwareInterface): ActionHandle {
    if( message instanceof SpanningTreeMessage ) // TODO: fix this hack.
      return ActionHandle.Continue;

    if( this.spanningTree.State(from) === SpanningTreeState.Blocking )
      return ActionHandle.Stop;
    if( this.spanningTree.State(from) === SpanningTreeState.Listening )
      return ActionHandle.Handled;

    const src = message.mac_src as HardwareAddress;
    const dst = message.mac_dst as HardwareAddress;

    let found = false;
    this.ARPTable.get(src.toString())?.map( i => {
      if( i.iface.getMacAddress().equals(from.getMacAddress()) ) {
        found = true;
        i.lastSeen = SchedulerService.Instance.getDeltaTime();
      }
    });

    if( !found ) {
      if( !this.ARPTable.get(src.toString()) )
        this.ARPTable.set(src.toString(), []);
      this.ARPTable.get(src.toString())?.push({iface: from, lastSeen: SchedulerService.Instance.getDeltaTime()});
    }

    if( this.spanningTree.State(from) === SpanningTreeState.Learning )
      return ActionHandle.Handled;

    let vlan_id = (from as Dot1QInterface).NativeVlan;
    if( message instanceof Dot1QMessage )
      vlan_id = message.vlan_id;
    else
      vlan_id = (from as Dot1QInterface).Vlan[0];

    let interfaces: Dot1QInterface[] = [];
    if( dst.isBroadcast || this.ARPTable.get(dst.toString()) === undefined ) {
      for( const name in this.interfaces ) {
        if( this.interfaces[name] !== from ) {
          if( (this.interfaces[name] as Dot1QInterface).Vlan.indexOf(vlan_id) !== -1 )
            interfaces.push(this.interfaces[name] as Dot1QInterface);
        }
      }
    }
    else {
      this.ARPTable.get(dst.toString())?.map( i => {
        if( i.iface !== from )
          if( (i.iface as Dot1QInterface).Vlan.indexOf(vlan_id) !== -1 )
            interfaces.push(i.iface as Dot1QInterface);
      });
    }

    interfaces.map( iface => {
      let msg = message;

      if( this.spanningTree.State(iface) === SpanningTreeState.Blocking )
        return;

      if( iface.VlanMode == VlanMode.Trunk ) {
        if( !(message instanceof Dot1QMessage) ) {
          msg = new Dot1QMessage.Builder()
            .setMacSource(msg.mac_src as MacAddress)
            .setMacDestination(msg.mac_dst as MacAddress)
            .setVlan(vlan_id)
            .setPayload(msg.payload)
            .build();
        }
      }
      if( iface.VlanMode == VlanMode.Access ) {
        if( (message instanceof Dot1QMessage) ) {
          msg = new EthernetMessage.Builder()
            .setMacSource(msg.mac_src as MacAddress)
            .setMacDestination(msg.mac_dst as MacAddress)
            .setPayload(msg.payload)
            .build();
        }
      }

      iface.sendTrame(msg);
    });

    this.receiveTrame$.next(message);
    return ActionHandle.Continue;
  }

  private cleanARPTable(): void {
    const cleanDelay = SchedulerService.Instance.getDelay(60 * 5);

    for( const key of this.ARPTable.keys() ) {

      let interfaces = this.ARPTable.get(key);
      if( interfaces !== undefined ) {

        let i = 0;
        while( i < interfaces.length ) {
          const timeSinceLastSeen = SchedulerService.Instance.getDeltaTime() - interfaces[i].lastSeen;

          if( timeSinceLastSeen > cleanDelay )
            interfaces.splice(i, 1);
          else {
            i++;
          }
        }

        if( interfaces.length == 0 )
          this.ARPTable.delete(key);
      }
    }
  }

}
