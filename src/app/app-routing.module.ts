import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LogicalComponent } from './components/logical/logical.component';
import { PhysicalComponent } from './components/physical/physical.component';


const routes: Routes = [
  { path: 'logical', component: LogicalComponent },
  { path: 'physical', component: PhysicalComponent },
  { path: '**', redirectTo: 'logical' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
