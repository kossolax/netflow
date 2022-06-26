import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header/header.component';
import { DiagramModule } from '@syncfusion/ej2-angular-diagrams';


@NgModule({
  declarations: [
    HeaderComponent
  ],
  imports: [
    CommonModule,
    DiagramModule
  ],
  exports: [
    HeaderComponent
  ]
})
export class CoreModule { }
