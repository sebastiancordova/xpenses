import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IUser } from '@core/models/user';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { AddIncomesComponent } from './add-incomes/add-incomes.component';

@Component({
  selector: 'app-incomes',
  templateUrl: './incomes.component.html',
  styleUrls: ['./incomes.component.scss']
})
export class IncomesComponent {
  public filtersForm: FormGroup;
  private unsubscribe$ = new Subject<boolean>();
  public loadingPage = true;
  public currentUser!: IUser;
  public page = 1;
  public pageSize = 8;
  public collectionSize = 1;
  private userService: UserService = inject(UserService);
  private authService: AuthService = inject(AuthService);
  private fb: FormBuilder = inject(FormBuilder);
  private toastr: ToastrService = inject(ToastrService);
  private modalService: NgbModal = inject(NgbModal);

  constructor() {
    this.filtersForm = this.fb.group({
      search: ''
    });
  }

  ngOnInit(): void {
    setTimeout(() => {
      this.loadingPage = false;
    }, 500);
  }


  filter() {

  }

  filterByDate(dates: { from: string; to: string }) {
    /* dates.from =  this.utilsService.getInvertedDate(dates.from);
     dates.to =  this.utilsService.getInvertedDate(dates.to);
     this.sickLeaveService.getSickLeavesFromDateRange(this.selectedFacility?.facilityId, dates)
     .pipe(take(1))
     .subscribe(sl => {
         this.fireSickLeaves = sl;
         this.filter();
     })*/
  }

  openCreateModal() {
    const modalRef = this.modalService.open(AddIncomesComponent, {
      size: 'sm',
      centered: true,
      windowClass: 'add-income-modal',
    })
  }


  get search() {
    return this.filtersForm.get('search');
  }
  get role() {
    return this.filtersForm.get('role');
  }

  ngOnDestroy() {
    this.unsubscribe$.next(true);
    this.unsubscribe$.unsubscribe();
  }
}
