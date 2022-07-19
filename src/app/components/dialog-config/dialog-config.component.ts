import { Component, Input, OnInit } from '@angular/core';

import { IPAddress, MacAddress } from 'src/app/models/address.model';
import { HardwareInterface } from 'src/app/models/layers/datalink.model';
import { NetworkInterface } from 'src/app/models/layers/network.model';
import { RouterHost, SwitchHost } from 'src/app/models/node.model';

@Component({
  selector: 'app-dialog-config',
  templateUrl: './dialog-config.component.html',
  styleUrls: ['./dialog-config.component.scss']
})
export class DialogConfigComponent implements OnInit {
  @Input() node: SwitchHost|RouterHost|null = null;

  constructor() { }

  ngOnInit(): void {
  }

  setSpeed(iface: HardwareInterface|NetworkInterface, evt: any): void {
    try {
      iface.Speed = evt.value;
    } catch( e ) {
      console.log(evt, evt.event.target.value);
//      evt.event.target.value = 0;
    }
  }

  setMacAddress(iface: HardwareInterface|NetworkInterface, evt: any): void {
    evt.container.classList.remove("e-error");

    try {
      iface.setMacAddress(new MacAddress(evt.value));
    } catch( e ) {
      evt.container.classList.add("e-error");
    }
  }
  setNetAddress(iface: NetworkInterface, evt: any): void {
    evt.container.classList.remove("e-error");

    try {
      iface.setNetAddress(new IPAddress(evt.value));
    } catch( e ) {
      evt.container.classList.add("e-error");
    }
  }
  setNetMask(iface: NetworkInterface, evt: any): void {
    evt.container.classList.remove("e-error");

    try {
      iface.setNetMask(new IPAddress(evt.value, true));
    } catch( e ) {
      evt.container.classList.add("e-error");
    }
  }

}
