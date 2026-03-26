import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { NgbCalendar, NgbDate, NgbDateParserFormatter, NgbInputDatepicker } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-range-date-selector',
  templateUrl: './range-date-selector.component.html',
  styleUrls: ['./range-date-selector.component.scss']
})
export class RangeDateSelectorComponent implements OnInit {
  @Output() rangeSelected = new EventEmitter<{ from: Date|undefined; to: Date|undefined }>();
  @ViewChild('datepicker') private datepickerRef!: NgbInputDatepicker;
  public hoveredDate: NgbDate | null = null;
  public fromDate!: NgbDate | null;
  public fromDateValue = '';
  public toDate!: NgbDate | null;
  public toDateValue = '';
  public todayDate: NgbDate = this.calendar.getToday();
  public months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  public currentPeriod = "";
  public showCleanFilter = false;
  constructor(private calendar: NgbCalendar, public formatter: NgbDateParserFormatter) { }


  ngOnInit(): void {
    const today = this.calendar.getToday();
    this.setCurrentPeriod();
    if (today.day >= 19) {
      this.fromDate = new NgbDate(today.year, today.month, 19);
    } else {
      const prevMonth = this.calendar.getPrev(new NgbDate(today.year, today.month, 1), 'm', 1);
      this.fromDate = new NgbDate(prevMonth.year, prevMonth.month, 19);
    }
    this.fromDateValue = this.formatter.format(this.fromDate);
    this.toDate = new NgbDate(today.year, today.month, today.day);
    this.toDateValue = 'Hoy';
  }

  setCurrentPeriod() {
    const today = this.calendar.getToday();
    if (today.day >= 19) {
      this.currentPeriod = `${this.months[today.month - 1]} - ${this.months[today.month % 12]}`;
    } else {
      const prevIdx = today.month === 1 ? 11 : today.month - 2;
      this.currentPeriod = `${this.months[prevIdx]} - ${this.months[today.month - 1]}`;
    }
  }

  onDateSelection(date: NgbDate) {
    this.showCleanFilter = true;
    if (!this.fromDate && !this.toDate) {
      this.fromDate = date;
    } else if (this.fromDate && !this.toDate && date && date.after(this.fromDate)) {
      this.toDate = date;
    } else {
      this.toDate = null;
      this.fromDate = date;
    }
    this.fromDateValue = this.formatter.format(this.fromDate);
    this.toDateValue = this.formatter.format(this.toDate);
    if (this.toDate?.equals(this.calendar.getToday())) {
      this.toDateValue = 'Hoy';
    }

    if (this.fromDate && this.toDate) {
      const startDate = new Date(this.fromDate.year, this.fromDate.month - 1, this.fromDate.day);
      const endDate = new Date(this.toDate.year, this.toDate.month - 1, this.toDate.day);
      this.rangeSelected.emit({ from: startDate, to: endDate });
      this.datepickerRef.close();
    }
  }

  onClosed() {
    //this.rangeSelected.emit({ from: this.fromDateValue, to: this.formatter.format(this.toDate) })
  }

  isHovered(date: NgbDate) {
    return this.fromDate && !this.toDate && this.hoveredDate && date.after(this.fromDate) && date.before(this.hoveredDate);
  }

  isInside(date: NgbDate) {
    return this.toDate && date.after(this.fromDate) && date.before(this.toDate);
  }

  isRange(date: NgbDate) {
    return date.equals(this.fromDate) || (this.toDate && date.equals(this.toDate)) || this.isInside(date) || this.isHovered(date);
  }

  validateInput(currentValue: NgbDate | null, input: string): NgbDate | null {
    const parsed = this.formatter.parse(input);
    return parsed && this.calendar.isValid(NgbDate.from(parsed)) ? NgbDate.from(parsed) : currentValue;
  }

  goToCurrentPeriod() {
    this.showCleanFilter = false;
    this.fromDate = null;
    this.toDate = null;
    this.fromDateValue = '';
    this.toDateValue = '';
    this.setCurrentPeriod();
    this.rangeSelected.emit({ from: undefined, to: undefined });
    this.datepickerRef.close();
  }

}
