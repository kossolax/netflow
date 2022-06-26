import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SimulationRoutingModule } from './simulation-routing.module';
import { LogicalComponent } from './components/logical/logical.component';
import { PhysicalComponent } from './components/physical/physical.component';
import { DiagramModule } from '@syncfusion/ej2-angular-diagrams';


@NgModule({
  declarations: [
    LogicalComponent,
    PhysicalComponent
  ],
  imports: [
    CommonModule,
    SimulationRoutingModule,
    DiagramModule
  ],
  exports: [
    DiagramModule
  ]
})
export class SimulationModule { }
