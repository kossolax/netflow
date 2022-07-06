import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { enableRipple } from '@syncfusion/ej2-base';
import { MenuEventArgs, MenuItemModel } from '@syncfusion/ej2-angular-navigations';
import { Network } from 'src/app/shared/models/network.model';
import { NetworkService } from 'src/app/shared/services/network.service';

enableRipple(true);

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {

  public menuItems: MenuItemModel[] = [
    {
      text: 'File',
      iconCss: 'em-icons e-file',
      items: [
          { text: 'Open', iconCss: 'em-icons e-open', id: 'menu-item-open' },
          { text: 'Save', iconCss: 'em-icons e-save' },
          { separator: true },
          { text: 'Exit' }
      ]
    },
    {
        text: 'Edit',
        iconCss: 'em-icons e-edit',
        items: [
            { text: 'Cut', iconCss: 'em-icons e-cut' },
            { text: 'Copy', iconCss: 'em-icons e-copy' },
            { text: 'Paste', iconCss: 'em-icons e-paste' }
        ]
    },
    { separator: true },
    {
        text: 'Help'
    }
  ];

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
