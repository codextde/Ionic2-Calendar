import { DatePipe } from "@angular/common";
import { IonSlides } from "@ionic/angular";
import {
    Component,
    OnInit,
    OnChanges,
    HostBinding,
    Input,
    Output,
    EventEmitter,
    SimpleChanges,
    ViewChild,
    ViewEncapsulation,
    TemplateRef,
    ElementRef
} from "@angular/core";
import { Subscription } from "rxjs";

import {
    ICalendarComponent,
    IDisplayEvent,
    IEvent,
    ITimeSelected,
    IRange,
    IWeekView,
    IWeekViewRow,
    IWeekViewDateRow,
    CalendarMode,
    IDateFormatter,
    IDisplayWeekViewHeader
} from "./calendar";
import { CalendarService } from "./calendar.service";
import {
    IDisplayAllDayEvent,
    IWeekViewAllDayEventSectionTemplateContext,
    IWeekViewNormalEventSectionTemplateContext
} from "./calendar";

@Component({
    selector: "weekview",
    templateUrl: "./weekview.html",
    styleUrls: ["./weekview.scss"],
    encapsulation: ViewEncapsulation.None
})
export class WeekViewComponent
    implements ICalendarComponent, OnInit, OnChanges {
    @ViewChild("weekSlider") slider: IonSlides;
    @HostBinding("class.weekview") class = true;

    @Input() weekviewHeaderTemplate: TemplateRef<IDisplayWeekViewHeader>;
    @Input() weekviewAllDayEventTemplate: TemplateRef<IDisplayAllDayEvent>;
    @Input() weekviewNormalEventTemplate: TemplateRef<IDisplayEvent>;
    @Input() weekviewAllDayEventSectionTemplate: TemplateRef<
        IWeekViewAllDayEventSectionTemplateContext
    >;
    @Input() weekviewNormalEventSectionTemplate: TemplateRef<
        IWeekViewNormalEventSectionTemplateContext
    >;
    @Input() weekviewInactiveAllDayEventSectionTemplate: TemplateRef<
        IWeekViewAllDayEventSectionTemplateContext
    >;
    @Input() weekviewInactiveNormalEventSectionTemplate: TemplateRef<
        IWeekViewNormalEventSectionTemplateContext
    >;

    @Input() formatWeekTitle: string;
    @Input() formatWeekViewDayHeader: string;
    @Input() formatHourColumn: string;
    @Input() startingDayWeek: number;
    @Input() allDayLabel: string;
    @Input() hourParts: number;
    @Input() eventSource: IEvent[];
    @Input() autoSelect: boolean = true;
    @Input() markDisabled: (date: Date) => boolean;
    @Input() locale: string;
    @Input() dateFormatter: IDateFormatter;
    @Input() dir: string = "";
    @Input() scrollToHour: number = 0;
    @Input() preserveScrollPosition: boolean;
    @Input() lockSwipeToPrev: boolean;
    @Input() lockSwipes: boolean;
    @Input() startHour: number;
    @Input() endHour: number;
    @Input() sliderOptions: any;
    @Input() hourSegments: number;

    @Output() onRangeChanged = new EventEmitter<IRange>();
    @Output() onEventSelected = new EventEmitter<IEvent>();
    @Output() onTimeSelected = new EventEmitter<ITimeSelected>();
    @Output() onTitleChanged = new EventEmitter<string>(true);

    public views: IWeekView[] = [];
    public currentViewIndex = 0;
    public range: IRange;
    public direction = 0;
    public mode: CalendarMode = "week";

    private inited = false;
    private callbackOnInit = true;
    private currentDateChangedFromParentSubscription: Subscription;
    private eventSourceChangedSubscription: Subscription;
    private slideChangedSubscription: Subscription;

    public hourColumnLabels: string[];
    public initScrollPosition: number;
    private formatDayHeader: (date: Date) => string;
    private formatTitle: (date: Date) => string;
    private formatHourColumnLabel: (date: Date) => string;
    private hourRange: number;

    constructor(
        private calendarService: CalendarService,
        private elm: ElementRef
    ) {}

    ngOnInit() {
        if (!this.sliderOptions) {
            this.sliderOptions = {};
        }
        this.sliderOptions.loop = true;

        this.hourRange = (this.endHour - this.startHour) * this.hourSegments;
        if (this.dateFormatter && this.dateFormatter.formatWeekViewDayHeader) {
            this.formatDayHeader = this.dateFormatter.formatWeekViewDayHeader;
        } else {
            let datePipe = new DatePipe(this.locale);
            this.formatDayHeader = function(date: Date) {
                return datePipe.transform(date, this.formatWeekViewDayHeader);
            };
        }

        if (this.dateFormatter && this.dateFormatter.formatWeekViewTitle) {
            this.formatTitle = this.dateFormatter.formatWeekViewTitle;
        } else {
            let datePipe = new DatePipe(this.locale);
            this.formatTitle = function(date: Date) {
                return datePipe.transform(date, this.formatWeekTitle);
            };
        }

        if (this.dateFormatter && this.dateFormatter.formatWeekViewHourColumn) {
            this.formatHourColumnLabel = this.dateFormatter.formatWeekViewHourColumn;
        } else {
            let datePipe = new DatePipe(this.locale);
            this.formatHourColumnLabel = function(date: Date) {
                return datePipe.transform(date, this.formatHourColumn);
            };
        }

        if (this.lockSwipeToPrev) {
            this.slider.lockSwipeToPrev(true);
        }

        if (this.lockSwipes) {
            this.slider.lockSwipes(true);
        }

        this.refreshView();
        this.hourColumnLabels = this.getHourColumnLabels();
        this.inited = true;

        this.currentDateChangedFromParentSubscription = this.calendarService.currentDateChangedFromParent$.subscribe(
            currentDate => {
                this.refreshView();
            }
        );

        this.eventSourceChangedSubscription = this.calendarService.eventSourceChanged$.subscribe(
            () => {
                this.onDataLoaded();
            }
        );

        this.slideChangedSubscription = this.calendarService.slideChanged$.subscribe(
            direction => {
                if (direction == 1) {
                    this.slider.slideNext();
                } else if (direction == -1) {
                    this.slider.slidePrev();
                }
            }
        );
    }

    ngAfterViewInit() {
        let title = this.getTitle();
        this.onTitleChanged.emit(title);

        if (this.scrollToHour > 0) {
            let hourColumns = this.elm.nativeElement
                .querySelector(".weekview-normal-event-container")
                .querySelectorAll(".calendar-hour-column");
            let me = this;
            setTimeout(function() {
                me.initScrollPosition =
                    hourColumns[me.scrollToHour - me.startHour].offsetTop;
            }, 50);
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (!this.inited) return;

        let eventSourceChange = changes["eventSource"];
        if (eventSourceChange && eventSourceChange.currentValue) {
            this.onDataLoaded();
        }

        let lockSwipeToPrev = changes["lockSwipeToPrev"];
        if (lockSwipeToPrev) {
            this.slider.lockSwipeToPrev(lockSwipeToPrev.currentValue);
        }

        let lockSwipes = changes["lockSwipes"];
        if (lockSwipes) {
            this.slider.lockSwipes(lockSwipes.currentValue);
        }
    }

    ngOnDestroy() {
        if (this.currentDateChangedFromParentSubscription) {
            this.currentDateChangedFromParentSubscription.unsubscribe();
            this.currentDateChangedFromParentSubscription = null;
        }

        if (this.eventSourceChangedSubscription) {
            this.eventSourceChangedSubscription.unsubscribe();
            this.eventSourceChangedSubscription = null;
        }

        if (this.slideChangedSubscription) {
            this.slideChangedSubscription.unsubscribe();
            this.slideChangedSubscription = null;
        }
    }

    onSlideChanged() {
        if (this.callbackOnInit) {
            this.callbackOnInit = false;
            return;
        }

        let currentSlideIndex = this.slider.getActiveIndex(),
            direction = 0,
            currentViewIndex = this.currentViewIndex;

        this.slider.getActiveIndex().then((currentSlideIndex: any) => {
            currentSlideIndex = (currentSlideIndex + 2) % 3;
            if (currentSlideIndex - currentViewIndex === 1) {
                direction = 1;
            } else if (currentSlideIndex === 0 && currentViewIndex === 2) {
                direction = 1;
                this.slider.slideTo(1, 0, false);
            } else if (currentViewIndex - currentSlideIndex === 1) {
                direction = -1;
            } else if (currentSlideIndex === 2 && currentViewIndex === 0) {
                direction = -1;
                this.slider.slideTo(3, 0, false);
            }
            this.currentViewIndex = currentSlideIndex;
            this.move(direction);
        });
    }

    move(direction: number) {
        if (direction === 0) {
            return;
        }
        this.direction = direction;
        let adjacent = this.calendarService.getAdjacentCalendarDate(
            this.mode,
            direction
        );
        this.calendarService.setCurrentDate(adjacent);
        this.refreshView();
        this.direction = 0;
    }

    static createDateObjects(
        startTime: Date,
        startHour: number,
        endHour: number,
        timeInterval: number
    ): IWeekViewRow[][] {
        let times: IWeekViewRow[][] = [],
            currentHour = startTime.getHours(),
            currentDate = startTime.getDate(),
            hourStep,
            minStep;

        if (timeInterval < 1) {
            hourStep = Math.floor(1 / timeInterval);
            minStep = 60;
        } else {
            hourStep = 1;
            minStep = Math.floor(60 / timeInterval);
        }

        for (let hour = startHour; hour < endHour; hour += hourStep) {
            for (let interval = 0; interval < 60; interval += minStep) {
                let row: IWeekViewRow[] = [];
                for (let day = 0; day < 7; day += 1) {
                    let time = new Date(startTime.getTime());
                    time.setHours(currentHour + hour, interval);
                    time.setDate(currentDate + day);
                    row.push({
                        events: [],
                        time: time
                    });
                }
                times.push(row);
            }
        }
        return times;
    }

    static getDates(startTime: Date, n: number): IWeekViewDateRow[] {
        let dates = new Array(n),
            current = new Date(startTime.getTime()),
            i = 0;
        current.setHours(12); // Prevent repeated dates because of timezone bug
        while (i < n) {
            dates[i++] = {
                date: new Date(current.getTime()),
                events: [],
                dayHeader: ""
            };
            current.setDate(current.getDate() + 1);
        }
        return dates;
    }

    private getHourColumnLabels(): string[] {
        let hourColumnLabels: string[] = [];
        for (
            let hour = 0, length = this.views[0].rows.length;
            hour < length;
            hour += 1
        ) {
            hourColumnLabels.push(
                this.formatHourColumnLabel(this.views[0].rows[hour][0].time)
            );
        }
        return hourColumnLabels;
    }

    getViewData(startTime: Date): IWeekView {
        let dates = WeekViewComponent.getDates(startTime, 7);
        for (let i = 0; i < 7; i++) {
            dates[i].dayHeader = this.formatDayHeader(dates[i].date);
        }

        return {
            rows: WeekViewComponent.createDateObjects(
                startTime,
                this.startHour,
                this.endHour,
                this.hourSegments
            ),
            dates: dates
        };
    }

    getRange(currentDate: Date): IRange {
        let year = currentDate.getFullYear(),
            month = currentDate.getMonth(),
            date = currentDate.getDate(),
            day = currentDate.getDay(),
            difference = day - this.startingDayWeek;

        if (difference < 0) {
            difference += 7;
        }

        let firstDayOfWeek = new Date(year, month, date - difference);
        let endTime = new Date(year, month, date - difference + 7);

        return {
            startTime: firstDayOfWeek,
            endTime: endTime
        };
    }

    onDataLoaded() {
        let eventSource = this.eventSource,
            len = eventSource ? eventSource.length : 0,
            startTime = this.range.startTime,
            endTime = this.range.endTime,
            utcStartTime = new Date(
                Date.UTC(
                    startTime.getFullYear(),
                    startTime.getMonth(),
                    startTime.getDate()
                )
            ),
            utcEndTime = new Date(
                Date.UTC(
                    endTime.getFullYear(),
                    endTime.getMonth(),
                    endTime.getDate()
                )
            ),
            currentViewIndex = this.currentViewIndex,
            rows = this.views[currentViewIndex].rows,
            dates = this.views[currentViewIndex].dates,
            oneHour = 3600000,
            oneDay = 86400000,
            // add allday eps
            eps = 0.016,
            allDayEventInRange = false,
            normalEventInRange = false,
            rangeStartRowIndex = this.startHour * this.hourSegments,
            rangeEndRowIndex = this.endHour * this.hourSegments,
            allRows = 24 * this.hourSegments;

        for (let i = 0; i < 7; i += 1) {
            dates[i].events = [];
            dates[i].hasEvent = false;
        }

        for (let day = 0; day < 7; day += 1) {
            for (let hour = 0; hour < this.hourRange; hour += 1) {
                rows[hour][day].events = [];
            }
        }
        for (let i = 0; i < len; i += 1) {
            let event = eventSource[i];
            let eventStartTime = new Date(event.startTime.getTime());
            let eventEndTime = new Date(event.endTime.getTime());

            if (event.allDay) {
                if (
                    eventEndTime <= utcStartTime ||
                    eventStartTime >= utcEndTime
                ) {
                    continue;
                } else {
                    allDayEventInRange = true;

                    let allDayStartIndex: number;
                    if (eventStartTime <= utcStartTime) {
                        allDayStartIndex = 0;
                    } else {
                        allDayStartIndex = Math.floor(
                            (eventStartTime.getTime() -
                                utcStartTime.getTime()) /
                                oneDay
                        );
                    }

                    let allDayEndIndex: number;
                    if (eventEndTime >= utcEndTime) {
                        allDayEndIndex = Math.ceil(
                            (utcEndTime.getTime() - utcStartTime.getTime()) /
                                oneDay
                        );
                    } else {
                        allDayEndIndex = Math.ceil(
                            (eventEndTime.getTime() - utcStartTime.getTime()) /
                                oneDay
                        );
                    }

                    let displayAllDayEvent: IDisplayEvent = {
                        event: event,
                        startIndex: allDayStartIndex,
                        endIndex: allDayEndIndex
                    };

                    let eventSet = dates[allDayStartIndex].events;
                    if (eventSet) {
                        eventSet.push(displayAllDayEvent);
                    } else {
                        eventSet = [];
                        eventSet.push(displayAllDayEvent);
                        dates[allDayStartIndex].events = eventSet;
                    }
                    dates[allDayStartIndex].hasEvent = true;
                }
            } else {
                if (eventEndTime <= startTime || eventStartTime >= endTime) {
                    continue;
                } else {
                    normalEventInRange = true;

                    let timeDiff: number;
                    let timeDifferenceStart: number;
                    if (eventStartTime <= startTime) {
                        timeDifferenceStart = 0;
                    } else {
                        timeDiff =
                            eventStartTime.getTime() -
                            startTime.getTime() -
                            (eventStartTime.getTimezoneOffset() -
                                startTime.getTimezoneOffset()) *
                                60000;
                        timeDifferenceStart =
                            (timeDiff / oneHour) * this.hourSegments;
                    }

                    let timeDifferenceEnd: number;
                    if (eventEndTime >= endTime) {
                        timeDiff =
                            endTime.getTime() -
                            startTime.getTime() -
                            (endTime.getTimezoneOffset() -
                                startTime.getTimezoneOffset()) *
                                60000;
                        timeDifferenceEnd =
                            (timeDiff / oneHour) * this.hourSegments;
                    } else {
                        timeDiff =
                            eventEndTime.getTime() -
                            startTime.getTime() -
                            (eventEndTime.getTimezoneOffset() -
                                startTime.getTimezoneOffset()) *
                                60000;
                        timeDifferenceEnd =
                            (timeDiff / oneHour) * this.hourSegments;
                    }

                    let startIndex = Math.floor(timeDifferenceStart),
                        endIndex = Math.ceil(timeDifferenceEnd - eps),
                        startRowIndex = startIndex % allRows,
                        dayIndex = Math.floor(startIndex / allRows),
                        endOfDay = dayIndex * allRows,
                        startOffset = 0,
                        endOffset = 0;

                    if (this.hourParts !== 1) {
                        if (startRowIndex < rangeStartRowIndex) {
                            startOffset = 0;
                        } else {
                            startOffset = Math.floor(
                                (timeDifferenceStart - startIndex) *
                                    this.hourParts
                            );
                        }
                    }

                    do {
                        endOfDay += allRows;
                        let endRowIndex: number;
                        if (endOfDay < endIndex) {
                            endRowIndex = allRows;
                        } else {
                            if (endOfDay === endIndex) {
                                endRowIndex = allRows;
                            } else {
                                endRowIndex = endIndex % allRows;
                            }
                            if (this.hourParts !== 1) {
                                if (endRowIndex > rangeEndRowIndex) {
                                    endOffset = 0;
                                } else {
                                    endOffset = Math.floor(
                                        (endIndex - timeDifferenceEnd) *
                                            this.hourParts
                                    );
                                }
                            }
                        }
                        if (startRowIndex < rangeStartRowIndex) {
                            startRowIndex = 0;
                        } else {
                            startRowIndex -= rangeStartRowIndex;
                        }
                        if (endRowIndex > rangeEndRowIndex) {
                            endRowIndex = rangeEndRowIndex;
                        }
                        endRowIndex -= rangeStartRowIndex;

                        if (startRowIndex < endRowIndex) {
                            let displayEvent = {
                                event: event,
                                startIndex: startRowIndex,
                                endIndex: endRowIndex,
                                startOffset: startOffset,
                                endOffset: endOffset
                            };
                            let eventSet = rows[startRowIndex][dayIndex].events;
                            if (eventSet) {
                                eventSet.push(displayEvent);
                            } else {
                                eventSet = [];
                                eventSet.push(displayEvent);
                                rows[startRowIndex][dayIndex].events = eventSet;
                            }
                            dates[dayIndex].hasEvent = true;
                        }
                        startRowIndex = 0;
                        startOffset = 0;
                        dayIndex += 1;
                    } while (endOfDay < endIndex);
                }
            }
        }

        if (normalEventInRange) {
            for (let day = 0; day < 7; day += 1) {
                let orderedEvents: IDisplayEvent[] = [];
                for (let hour = 0; hour < this.hourRange; hour += 1) {
                    if (rows[hour][day].events) {
                        rows[hour][day].events.sort(
                            WeekViewComponent.compareEventByStartOffset
                        );
                        orderedEvents = orderedEvents.concat(
                            rows[hour][day].events
                        );
                    }
                }
                if (orderedEvents.length > 0) {
                    this.placeEvents(orderedEvents);
                }
            }
        }

        if (allDayEventInRange) {
            let orderedAllDayEvents: IDisplayEvent[] = [];
            for (let day = 0; day < 7; day += 1) {
                if (dates[day].events) {
                    orderedAllDayEvents = orderedAllDayEvents.concat(
                        dates[day].events
                    );
                }
            }
            if (orderedAllDayEvents.length > 0) {
                this.placeAllDayEvents(orderedAllDayEvents);
            }
        }

        if (this.autoSelect) {
            let findSelected = false;
            let selectedDate;
            for (let r = 0; r < 7; r += 1) {
                if (dates[r].selected) {
                    selectedDate = dates[r];
                    findSelected = true;
                    break;
                }
            }

            if (findSelected) {
                let disabled = false;
                if (this.markDisabled) {
                    disabled = this.markDisabled(selectedDate.date);
                }

                this.onTimeSelected.emit({
                    selectedTime: selectedDate.date,
                    events: selectedDate.events.map(e => e.event),
                    disabled: disabled
                });
            }
        }
    }

    refreshView() {
        this.range = this.getRange(this.calendarService.currentDate);

        if (this.inited) {
            let title = this.getTitle();
            this.onTitleChanged.emit(title);
        }
        this.calendarService.populateAdjacentViews(this);
        this.updateCurrentView(
            this.range.startTime,
            this.views[this.currentViewIndex]
        );
        this.calendarService.rangeChanged(this);
    }

    getTitle(): string {
        let firstDayOfWeek = new Date(this.range.startTime.getTime());
        firstDayOfWeek.setHours(12, 0, 0, 0);
        return this.formatTitle(firstDayOfWeek);
    }

    getHighlightClass(date: IWeekViewDateRow): string {
        let className = "";

        if (date.hasEvent) {
            if (className) {
                className += " ";
            }
            className = "weekview-with-event";
        }

        if (date.selected) {
            if (className) {
                className += " ";
            }
            className += "weekview-selected";
        }

        if (date.current) {
            if (className) {
                className += " ";
            }
            className += "weekview-current";
        }

        return className;
    }

    private static compareEventByStartOffset(
        eventA: IDisplayEvent,
        eventB: IDisplayEvent
    ): number {
        return eventA.startOffset - eventB.startOffset;
    }

    select(selectedTime: Date, events: IDisplayEvent[]) {
        let disabled = false;
        if (this.markDisabled) {
            disabled = this.markDisabled(selectedTime);
        }

        this.onTimeSelected.emit({
            selectedTime: selectedTime,
            events: events.map(e => e.event),
            disabled: disabled
        });
    }

    placeEvents(orderedEvents: IDisplayEvent[]) {
        this.calculatePosition(orderedEvents);
        WeekViewComponent.calculateWidth(
            orderedEvents,
            this.hourRange,
            this.hourParts
        );
    }

    placeAllDayEvents(orderedEvents: IDisplayEvent[]) {
        this.calculatePosition(orderedEvents);
    }

    overlap(event1: IDisplayEvent, event2: IDisplayEvent): boolean {
        let earlyEvent = event1,
            lateEvent = event2;
        if (
            event1.startIndex > event2.startIndex ||
            (event1.startIndex === event2.startIndex &&
                event1.startOffset > event2.startOffset)
        ) {
            earlyEvent = event2;
            lateEvent = event1;
        }

        if (earlyEvent.endIndex <= lateEvent.startIndex) {
            return false;
        } else {
            return !(
                earlyEvent.endIndex - lateEvent.startIndex === 1 &&
                earlyEvent.endOffset + lateEvent.startOffset >= this.hourParts
            );
        }
    }

    calculatePosition(events: IDisplayEvent[]) {
        let len = events.length,
            maxColumn = 0,
            isForbidden = new Array(len);

        for (let i = 0; i < len; i += 1) {
            let col: number;
            for (col = 0; col < maxColumn; col += 1) {
                isForbidden[col] = false;
            }
            for (let j = 0; j < i; j += 1) {
                if (this.overlap(events[i], events[j])) {
                    isForbidden[events[j].position] = true;
                }
            }
            for (col = 0; col < maxColumn; col += 1) {
                if (!isForbidden[col]) {
                    break;
                }
            }
            if (col < maxColumn) {
                events[i].position = col;
            } else {
                events[i].position = maxColumn++;
            }
        }

        if (this.dir === "rtl") {
            for (let i = 0; i < len; i += 1) {
                events[i].position = maxColumn - 1 - events[i].position;
            }
        }
    }

    private static calculateWidth(
        orderedEvents: IDisplayEvent[],
        size: number,
        hourParts: number
    ) {
        let totalSize = size * hourParts,
            cells = new Array(totalSize);

        // sort by position in descending order, the right most columns should be calculated first
        orderedEvents.sort((eventA, eventB) => {
            return eventB.position - eventA.position;
        });
        for (let i = 0; i < totalSize; i += 1) {
            cells[i] = {
                calculated: false,
                events: []
            };
        }
        let len = orderedEvents.length;
        for (let i = 0; i < len; i += 1) {
            let event = orderedEvents[i];
            let index = event.startIndex * hourParts + event.startOffset;
            while (index < event.endIndex * hourParts - event.endOffset) {
                cells[index].events.push(event);
                index += 1;
            }
        }

        let i = 0;
        while (i < len) {
            let event = orderedEvents[i];
            if (!event.overlapNumber) {
                let overlapNumber = event.position + 1;
                event.overlapNumber = overlapNumber;
                let eventQueue = [event];
                while ((event = eventQueue.shift())) {
                    let index =
                        event.startIndex * hourParts + event.startOffset;
                    while (
                        index <
                        event.endIndex * hourParts - event.endOffset
                    ) {
                        if (!cells[index].calculated) {
                            cells[index].calculated = true;
                            if (cells[index].events) {
                                let eventCountInCell =
                                    cells[index].events.length;
                                for (let j = 0; j < eventCountInCell; j += 1) {
                                    let currentEventInCell =
                                        cells[index].events[j];
                                    if (!currentEventInCell.overlapNumber) {
                                        currentEventInCell.overlapNumber = overlapNumber;
                                        eventQueue.push(currentEventInCell);
                                    }
                                }
                            }
                        }
                        index += 1;
                    }
                }
            }
            i += 1;
        }
    }

    updateCurrentView(currentViewStartDate: Date, view: IWeekView) {
        let currentCalendarDate = this.calendarService.currentDate,
            today = new Date(),
            oneDay = 86400000,
            selectedDayDifference = Math.floor(
                (currentCalendarDate.getTime() -
                    currentViewStartDate.getTime() -
                    (currentCalendarDate.getTimezoneOffset() -
                        currentViewStartDate.getTimezoneOffset()) *
                        60000) /
                    oneDay
            ),
            currentDayDifference = Math.floor(
                (today.getTime() -
                    currentViewStartDate.getTime() -
                    (today.getTimezoneOffset() -
                        currentViewStartDate.getTimezoneOffset()) *
                        60000) /
                    oneDay
            );

        for (let r = 0; r < 7; r += 1) {
            view.dates[r].selected = false;
        }

        if (
            selectedDayDifference >= 0 &&
            selectedDayDifference < 7 &&
            this.autoSelect
        ) {
            view.dates[selectedDayDifference].selected = true;
        }

        if (currentDayDifference >= 0 && currentDayDifference < 7) {
            view.dates[currentDayDifference].current = true;
        }
    }

    daySelected(viewDate: IWeekViewDateRow) {
        let selectedDate = viewDate.date,
            dates = this.views[this.currentViewIndex].dates,
            currentViewStartDate = this.range.startTime,
            oneDay = 86400000,
            selectedDayDifference = Math.floor(
                (selectedDate.getTime() -
                    currentViewStartDate.getTime() -
                    (selectedDate.getTimezoneOffset() -
                        currentViewStartDate.getTimezoneOffset()) *
                        60000) /
                    oneDay
            );

        this.calendarService.setCurrentDate(selectedDate);

        for (let r = 0; r < 7; r += 1) {
            dates[r].selected = false;
        }

        if (selectedDayDifference >= 0 && selectedDayDifference < 7) {
            dates[selectedDayDifference].selected = true;
        }

        let disabled = false;
        if (this.markDisabled) {
            disabled = this.markDisabled(selectedDate);
        }

        this.onTimeSelected.emit({
            selectedTime: selectedDate,
            events: viewDate.events.map(e => e.event),
            disabled: disabled
        });
    }

    setScrollPosition(scrollPosition: number) {
        this.initScrollPosition = scrollPosition;
    }
}
