import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: 'simulation', loadChildren: () => import('./simulation/simulation.module').then(m => m.SimulationModule) },
  { path: '**', redirectTo: 'simulation' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
