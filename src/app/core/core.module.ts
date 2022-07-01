import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HeaderComponent } from './components/header/header.component';

import { MenuModule } from '@syncfusion/ej2-angular-navigations';
import { SharedModule } from '../shared/shared.module';


@NgModule({
  declarations: [
    HeaderComponent
  ],
  imports: [
    CommonModule,
    MenuModule,
    SharedModule
  ],
  exports: [
    HeaderComponent,
    MenuModule
  ]
})
export class CoreModule { }
