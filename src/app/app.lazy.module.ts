import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

import { DiagramModule, SnappingService } from '@syncfusion/ej2-angular-diagrams';
import { MenuModule, TabModule } from '@syncfusion/ej2-angular-navigations';
import { DialogModule } from '@syncfusion/ej2-angular-popups';

import { LogicalComponent } from './components/logical/logical.component';
import { PhysicalComponent } from './components/physical/physical.component';
import { FormsModule } from '@angular/forms';
import { DialogConfigComponent } from './components/dialog-config/dialog-config.component';
import { TextBoxModule } from '@syncfusion/ej2-angular-inputs';
import { CheckBoxModule, RadioButtonModule, SwitchModule } from '@syncfusion/ej2-angular-buttons';

const routes: Routes = [
  { path: 'logical', component: LogicalComponent },
  { path: 'physical', component: PhysicalComponent },
  { path: '**', redirectTo: '/logical' }
];


@NgModule({
  declarations: [
    LogicalComponent,
    PhysicalComponent,
    DialogConfigComponent
  ],
  imports: [
    RouterModule.forChild(routes),
    CommonModule,
    HttpClientModule,
    FormsModule,

    MenuModule,
    TabModule,
    DiagramModule,
    DialogModule,
    TextBoxModule,
    SwitchModule,
    RadioButtonModule
  ],
  providers: [SnappingService],
  bootstrap: [],
  exports: [RouterModule]
})
export class AppLazyModule { }
