import { Component, OnInit } from '@angular/core';
import { MenuEventArgs, MenuItemModel } from '@syncfusion/ej2-angular-navigations';
import * as pako from 'pako';
//@ts-ignore
import * as twofish from 'twofish';

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

  constructor() { }

  ngOnInit(): void {
  }

  public select(args: MenuEventArgs): void {
    if( args.item.id == "menu-item-open" ) {
      document.getElementById('inputValue')?.click();
    }
  }

  private twofishdecode(data: Uint8Array): Uint8Array {
    const key = new Uint8Array([137, 137, 137, 137, 137, 137, 137, 137, 137, 137, 137, 137, 137, 137, 137, 137]);
    const IV = new Uint8Array([16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16]);

    const session = twofish.twofish(IV);
    return session.decrypt(key, data);
  }
  public onFileUpload(event: Event) : void {
    const files = (event.target as HTMLInputElement).files as FileList;
    if( files.length == 0 )
      return;

    const file = files.item(0) as File;

    const reader = new FileReader();

    reader.onloadend = (e) => {
      let input = new Uint8Array(reader.result as ArrayBuffer);
      let processed = new Uint8Array(input.length);
      let length = input.length;

      // deobfuscation
      for(let i = 0; i<length; i++)
        processed[i] = input[length + ~i] ^ (length - i * length)


      // decryption
      let output = this.twofishdecode(processed);

      console.log(   output[0]==0xD2,    output[1]==0xCC,    output[2]==0x64);

      // deobfuscation
      for(let i = 0; i<output.length; i++)
        output[i] = output[i] ^ (output.length - i);

      // decompression
      let len = output[0] << 24 | output[1] << 16 | output[2] << 8 | output[3];

      let result = pako.inflate(output.slice(4), {to: 'string' });
      console.log(result);
    }

    reader.readAsArrayBuffer(file);
  }

}
