import { Component, OnInit } from '@angular/core';
import { MenuEventArgs, MenuItemModel } from '@syncfusion/ej2-angular-navigations';
import { NetworkService } from 'src/app/services/network.service';
import { Link } from 'src/app/models/layers/physical.model';
import { SchedulerService, SchedulerState } from 'src/app/services/scheduler.service';
import { Observable, take } from 'rxjs';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  public time$!: Observable<string>;

  public menuItems: MenuItemModel[] = [
    {
      text: 'File',
      iconCss: 'fa-solid fa-bars',
      items: [
          { text: 'Open', iconCss: 'fa-solid fa-folder-open', id: 'menu-item-open' },
          { text: 'Save', iconCss: 'fa-solid fa-floppy-disk' },
          { separator: true },
          { text: 'Exit' }
      ]
    },
    { separator: true },
    {
        text: 'Help'
    }
  ];

  public get SpeedString(): string {
    let str = SchedulerState[this.Speed].replace(/_/g, ' ').toLowerCase();
    str = str.charAt(0).toUpperCase() + str.slice(1);
    return str;
  }
  public get Speed(): SchedulerState {
    return this.scheduler.Speed;
  }
  public set Speed(speed: SchedulerState) {
    this.scheduler.Speed = speed;
  }


  constructor(private network: NetworkService, private scheduler: SchedulerService) {
  }

  ngOnInit(): void {
    this.time$ = this.scheduler.Timer$;
  }

  public select(args: MenuEventArgs): void {
    if( args.item.id == "menu-item-open" ) {
      document.getElementById('inputValue')?.click();
    }
  }

  public onFileUpload(event: Event) : void {
    const files = (event.target as HTMLInputElement).files as FileList;
    if( files.length == 0 )
      return;

    const file = files.item(0) as File;
    this.network.decode(file).pipe(
      take( 1 )
    ).subscribe( data => {
      this.network.setNetwork(data);
    });
  }

}
