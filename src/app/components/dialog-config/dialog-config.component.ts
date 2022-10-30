import { Component, Input } from '@angular/core';

import { IPAddress, MacAddress } from 'src/app/models/address.model';
import { Dot1QInterface, HardwareInterface } from 'src/app/models/layers/datalink.model';
import { NetworkInterface } from 'src/app/models/layers/network.model';
import { L4Host, NetworkHost, SwitchHost } from 'src/app/models/node.model';

@Component({
  selector: 'app-dialog-config',
  templateUrl: './dialog-config.component.html',
  styleUrls: ['./dialog-config.component.scss'],
})
export class DialogConfigComponent {
  @Input() public node: SwitchHost|NetworkHost|null = null;

  constructor() { }

  public hasDHCP(iface: HardwareInterface|NetworkInterface): boolean {
    if( iface instanceof NetworkInterface )
      return true;
    return false;
  }
  public setDhcp(iface: HardwareInterface|NetworkInterface, evt: any): void {
    try {
      if( iface instanceof NetworkInterface ) {
        iface.AutoNegociateAddress = evt.checked;
      }
    } catch( e ) {
      console.log(evt, evt.event.target.value);
    }
  }
  public getDhcp(iface: HardwareInterface|NetworkInterface): boolean {
    if( iface instanceof NetworkInterface ) {
      return iface.AutoNegociateAddress;
    }
    return false;
  }

  public hasGateway(): boolean {
    if( this.node instanceof L4Host )
      return true;
    return false;
  }
  public setGateway(evt: any): void {
    evt.container.classList.remove("e-error");

    try {
      (this.node as L4Host).gateway = new IPAddress(evt.value);
    } catch( e ) {
      evt.container.classList.add("e-error");
    }
  }
  public getGateway(): string {
    if( this.node instanceof L4Host )
      return (this.node as L4Host).gateway.toString();
    return "";
  }

  public setSpeed(iface: HardwareInterface|NetworkInterface, evt: any): void {
    try {
      iface.Speed = evt.value;
    } catch( e ) {
      console.log(evt, evt.event.target.value);
//      evt.event.target.value = 0;
    }
  }

  public setMacAddress(iface: HardwareInterface|NetworkInterface, evt: any): void {
    evt.container.classList.remove("e-error");

    try {
      iface.setMacAddress(new MacAddress(evt.value));
    } catch( e ) {
      evt.container.classList.add("e-error");
    }
  }
  public setNetAddress(iface: NetworkInterface, evt: any): void {
    evt.container.classList.remove("e-error");

    try {
      iface.setNetAddress(new IPAddress(evt.value));
    } catch( e ) {
      evt.container.classList.add("e-error");
    }
  }
  public setNetMask(iface: NetworkInterface, evt: any): void {
    evt.container.classList.remove("e-error");

    try {
      iface.setNetMask(new IPAddress(evt.value, true));
    } catch( e ) {
      evt.container.classList.add("e-error");
    }
  }

}
