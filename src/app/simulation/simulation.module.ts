import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SimulationRoutingModule } from './simulation-routing.module';
import { LogicalComponent } from './components/logical/logical.component';
import { PhysicalComponent } from './components/physical/physical.component';
import { CoreModule } from '../core/core.module';

import {  ConnectorBridgingService, DiagramModule } from '@syncfusion/ej2-angular-diagrams';


@NgModule({
  declarations: [
    LogicalComponent,
    PhysicalComponent
  ],
  imports: [
    CommonModule,
    CoreModule,
    DiagramModule,
    SimulationRoutingModule
  ],
  providers: [
    ConnectorBridgingService
  ]
})
export class SimulationModule { }
