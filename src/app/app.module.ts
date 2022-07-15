import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';

import { enableRipple } from '@syncfusion/ej2-base';
import { DiagramModule, SnappingService } from '@syncfusion/ej2-angular-diagrams';
import { MenuModule, TabModule } from '@syncfusion/ej2-angular-navigations';


import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { FooterComponent } from './components/footer/footer.component';
import { HeaderComponent } from './components/header/header.component';
import { LogicalComponent } from './components/logical/logical.component';
import { PhysicalComponent } from './components/physical/physical.component';

enableRipple(true);

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    FooterComponent,
    LogicalComponent,
    PhysicalComponent

  ],
  imports: [
    CommonModule,
    HttpClientModule,
    BrowserModule,
    AppRoutingModule,

    MenuModule,
    TabModule,
    DiagramModule,
  ],
  providers: [SnappingService],
  bootstrap: [AppComponent]
})
export class AppModule { }
