import { Component, Input, OnInit } from '@angular/core';
import { RouterHost, SwitchHost } from 'src/app/models/node.model';

@Component({
  selector: 'app-dialog-cli',
  templateUrl: './dialog-cli.component.html',
  styleUrls: ['./dialog-cli.component.scss']
})
export class DialogCliComponent implements OnInit {
  @Input() node: SwitchHost|RouterHost|null = null;

  constructor() { }

  ngOnInit(): void {
  }
}
