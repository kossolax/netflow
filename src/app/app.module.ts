import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';

import { enableRipple } from '@syncfusion/ej2-base';
import { MenuModule, TabModule } from '@syncfusion/ej2-angular-navigations';


import { AppComponent } from './app.component';
import { FooterComponent } from './components/footer/footer.component';
import { HeaderComponent } from './components/header/header.component';
import { RouterModule, Routes } from '@angular/router';
import { SchedulerService } from './services/scheduler.service';

enableRipple(true);

const routes: Routes = [
  { path: 'view', loadChildren: () => import('./app.lazy.module').then(m => m.AppLazyModule) },
  { path: '**', redirectTo: '/view/logical' }
];

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    FooterComponent
  ],
  imports: [
    RouterModule.forRoot(routes),

    CommonModule,
    HttpClientModule,
    BrowserModule,

    MenuModule,
    TabModule
  ],
  bootstrap: [AppComponent],
  exports: [RouterModule],
  providers: [
    SchedulerService
  ]
})
export class AppModule { }
