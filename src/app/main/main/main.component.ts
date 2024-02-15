import { Component, OnInit, inject } from '@angular/core';
import { UserService } from '@core/services/user.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {
  private userService: UserService = inject(UserService);

  ngOnInit(): void {
      this.userService.currentUser$();
  }
}
