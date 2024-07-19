import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CustomDateParserFormatterService } from '@core/services/custom-date-parserformatter.service';
import { NgbCalendar, NgbDate, NgbDateParserFormatter } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-range-date-selector',
  templateUrl: './range-date-selector.component.html',
  styleUrls: ['./range-date-selector.component.scss']
})
export class RangeDateSelectorComponent implements OnInit {
  @Output() rangeSelected = new EventEmitter<{ from: string; to: string }>();
  public hoveredDate: NgbDate | null = null;
  public fromDate!: NgbDate | null;
  public fromDateValue = '';
  public toDate!: NgbDate | null;
  public toDateValue = '';
  public todayDate: NgbDate = this.calendar.getToday();
  public months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembere", "Octubre", "Noviembre", "Diciembre"];
  public currentMonth = "";
  constructor(private calendar: NgbCalendar, public formatter: NgbDateParserFormatter) { }


  ngOnInit(): void {
    const today = this.calendar.getToday();
    this.fromDate = today;
    if (this.fromDate.day < 19) {
      this.currentMonth = this.months[today.month - 1]
    } else {
      this.currentMonth = this.months[today.month]
    }
    this.fromDate.day = 19;
    this.fromDate.month = new Date().getMonth();
    this.fromDateValue = this.formatter.format(this.fromDate);
    this.toDate = today;
    this.toDateValue = this.formatter.format(this.toDate);
    if (this.toDate.equals(today)) {
      this.toDateValue = 'Hoy';
    }
  }

  onDateSelection(date: NgbDate) {
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
  }

  onClosed() {
    this.rangeSelected.emit({ from: this.fromDateValue, to: this.formatter.format(this.toDate) })
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

}
