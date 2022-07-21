import { Component, OnInit } from '@angular/core';
import { MenuEventArgs, MenuItemModel } from '@syncfusion/ej2-angular-navigations';
import { NetworkService } from 'src/app/services/network.service';
import { Link } from 'src/app/models/layers/physical.model';
import { SchedulerService, SchedulerState } from 'src/app/services/scheduler.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {

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

  public get Speed(): SchedulerState {
    return SchedulerService.Speed;
  }
  public set Speed(speed: SchedulerState) {
    SchedulerService.Speed = speed;
  }

  constructor(private network: NetworkService) { }

  ngOnInit(): void {
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
    this.network.decode(file).subscribe( data => {
      this.network.setNetwork(data);
    });
  }

}
