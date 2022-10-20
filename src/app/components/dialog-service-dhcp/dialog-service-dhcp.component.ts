import { Component, Input, OnChanges, OnInit, ViewChild } from '@angular/core';
import { ChangeEventArgs, DropDownListComponent } from '@syncfusion/ej2-angular-dropdowns';
import { InputEventArgs } from '@syncfusion/ej2-angular-inputs';
import { Observable, Subject } from 'rxjs';
import { IPAddress } from 'src/app/models/address.model';
import { ServerHost } from 'src/app/models/node.model';
import { DhcpPool } from 'src/app/models/services/dhcp.model';

@Component({
  selector: 'app-dialog-service-dhcp',
  templateUrl: './dialog-service-dhcp.component.html',
  styleUrls: ['./dialog-service-dhcp.component.scss'],

})
export class DialogServiceDhcpComponent {
  @Input() public node: ServerHost|null = null;
  @ViewChild('poolList') public poolList!: DropDownListComponent;

  public selectedPool: DhcpPool|null = null;

  get isActive(): boolean {
    return this.node?.services.dhcp.Enable as boolean;
  }
  set isActive(value: boolean) {
    if (this.node) {
      this.node.services.dhcp.Enable = value;
    }
  }
  get Pools(): DhcpPool[] {
    return this.node?.services.dhcp.pools as DhcpPool[];
  }
  public onSelect(event: ChangeEventArgs): void {
    this.selectedPool = event.itemData as DhcpPool;
  }
  public onRefresh(): void {
    if( this.selectedPool )
      this.poolList.value = this.selectedPool.name;
    this.poolList.refresh();
  }
  public onRemove(): void {
    const idx = this.Pools.indexOf(this.selectedPool as DhcpPool);
    this.Pools.splice(idx, 1);
    this.selectedPool = null;
    this.poolList.clear();
    this.onRefresh();
  }
  public onAdd(): void {
    const name = 'poolName';
    let idx = 1;
    while ( this.Pools.find(p => p.name === name + idx)  ) {
      idx++;
    }
    const newPool = new DhcpPool(`${name}${idx}`);

    this.Pools.push(newPool);
    this.selectedPool = newPool;
    this.poolList.value = newPool.name;
    this.onRefresh();
  }


  public getData(kind: 'gatewayAddress'|'netmaskAddress'|'startAddress'|'endAddress'|string): string {
    if( this.selectedPool ) {
      if( kind === 'gatewayAddress' || kind === 'netmaskAddress' || kind === 'startAddress' || kind === 'endAddress' )
        return this.selectedPool[kind].toString();
      return this.selectedPool.otherServices[kind].toString() || '';
    }
    return '';
  }
  public setData(kind: 'gatewayAddress'|'netmaskAddress'|'startAddress'|'endAddress'|'otherServices'|string, evt: InputEventArgs): void {
    try {
      evt.container?.classList.remove('e-error');

      const ip = new IPAddress(evt.value as string);

      if (this.selectedPool) {
        if( kind === 'gatewayAddress' || kind === 'netmaskAddress' || kind === 'startAddress' || kind === 'endAddress' )
          this.selectedPool[kind] = ip;
        else
          this.selectedPool.otherServices[kind] = ip;
      }
    } catch (error) {
      evt.container?.classList.add('e-error');
    }
  }

}
