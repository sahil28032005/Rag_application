import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClerkModule } from '@clerk/angular';
import { environment } from '../../../environments/environment';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ClerkModule.forRoot({
      publishableKey: environment.clerkPublishableKey
    })
  ],
  exports: [
    ClerkModule
  ]
})
export class AuthModule { }