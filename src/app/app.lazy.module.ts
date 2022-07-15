import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

import { DiagramModule, SnappingService } from '@syncfusion/ej2-angular-diagrams';
import { MenuModule, TabModule } from '@syncfusion/ej2-angular-navigations';


import { AppComponent } from './app.component';
import { LogicalComponent } from './components/logical/logical.component';
import { PhysicalComponent } from './components/physical/physical.component';

const routes: Routes = [
  { path: 'logical', component: LogicalComponent },
  { path: 'physical', component: PhysicalComponent },
  { path: '**', redirectTo: '/logical' }
];


@NgModule({
  declarations: [
    LogicalComponent,
    PhysicalComponent
  ],
  imports: [
    RouterModule.forChild(routes),
    CommonModule,
    HttpClientModule,

    MenuModule,
    TabModule,
    DiagramModule,
  ],
  providers: [SnappingService],
  bootstrap: [],
  exports: [RouterModule]
})
export class AppLazyModule { }
