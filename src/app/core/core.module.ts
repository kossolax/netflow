import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HeaderComponent } from './components/header/header.component';

import { MenuModule } from '@syncfusion/ej2-angular-navigations';


@NgModule({
  declarations: [
    HeaderComponent
  ],
  imports: [
    CommonModule,
    MenuModule
  ],
  exports: [
    HeaderComponent,
    MenuModule
  ]
})
export class CoreModule { }
