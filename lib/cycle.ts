import * as crypt from "./crypt";
import * as fs from "fs";
import { DateTime, Interval } from "luxon";
import * as readlineSync from "readline-sync";

const colors = require("colors/safe");

export enum Flow {
    Unspecified = "u",
    Spotting = "s",
    Light = "l",
    Medium = "m",
    Heavy = "h",
}

export interface DayJSON {
    date: string;
    flow?: Flow;
    notes?: string;
}

interface DayInterface {
    date: DateTime;
    flow?: Flow;
    notes?: string;
}

interface parsedData {
    data: {
        days: Day[];
    };
}

export class Day implements DayInterface {
    date: DateTime;
    flow?: Flow;
    notes?: string;

    constructor(date: DateTime = DateTime.local(), flow?: Flow, notes?: string) {
        this.date = date;
        this.notes = notes;
        this.flow = flow;
    }

    toString(): string {
        return [this.date.toISODate(), this.flow ? "*" : "", this.flow, this.notes]
            .filter((x) => x)
            .join(" ");
    }
}

export class Data {
    json: parsedData;

    constructor(data: parsedData = { data: { days: [] } }) {
        this.json = data;
    }

    validate(): void {
        if (!this.json.data.days) {
            return;
        }

        // remove duplicates, overwriting with the last one
        this.json.data.days = this.json.data.days.filter(
            (day, index, self) =>
                index === self.findLastIndex((t) => t.date.toISODate() === day.date.toISODate())
        );

        // sort by date
        this.json.data.days.sort((a, b) => (a.date < b.date ? -1 : 1));
    }

    calendar(
        interval: Interval = Interval.fromDateTimes(
            DateTime.local().startOf("month"),
            DateTime.local().endOf("month")
        )
    ): string {
        const today = DateTime.local();
        const days = this.json.data.days.filter((day) => interval.contains(day.date));

        const weekHeader = "Mo Tu We Th Fr Sa Su";
        //@ts-ignore
        let day = interval.start.startOf("month").startOf("week");
        //@ts-ignore
        const lastDay = interval.end.endOf("month").endOf("week");
        //@ts-ignore
        const monthBounds = interval.start.startOf("month").until(interval.end.endOf("month"));

        let calendar: string[] = [];
        while (day <= lastDay) {
            let week: string[] = [];
            for (let i = 0; i < 7; i++) {
                let dayString = "";
                if (monthBounds.contains(day)) {
                    const dayData = days.find((d) => d.date.toISODate() == day.toISODate());
                    if (dayData) {
                        dayString = dayData.flow
                            ? colors.red(day.day.toString().padEnd(2, " "))
                            : colors.green(day.day.toString().padEnd(2, " "));
                    } else {
                        dayString = day.day.toString().padEnd(2, " ");
                    }

                    if (day.toISODate() == today.toISODate()) {
                        dayString = colors.underline(dayString);
                    }
                } else {
                    dayString = "  ";
                }
                week.push(dayString);
                day = day.plus({ days: 1 });
            }
            const startOfMonth = week.findIndex((day) => day.includes("1 "));
            if (startOfMonth != -1) {
                week[startOfMonth] = colors.italic.bold(week[startOfMonth]);
                week.push(colors.blue(day.monthLong));
                if (day.month == 1) {
                    week.push(colors.blue(day.year.toString()));
                }
            }
            calendar.push(week.join(" "));
        }
        return [weekHeader, ...calendar].join("\n");
    }

    daysSinceEnd(): string {
        return DateTime.local()
            .diff(this.flowDays().pop()?.date || DateTime.local())
            .toFormat("d");
    }

    flowDays(): Day[] {
        return this.json.data.days.filter((day) => day.flow);
    }

    cycles(): Day[][] {
        const cycles: Day[][] = [];
        let cycle: Day[] = [];
        this.flowDays().forEach((day) => {
            if (day.flow) {
                cycle.push(day);
            } else {
                cycles.push(cycle);
                cycle = [];
            }
        });
        cycles.push(cycle);
        return cycles;
    }

    toString(indent: string | number | undefined = undefined): string {
        return JSON.stringify(this.json, null, indent);
    }

    toList(): string {
        return this.json.data.days.map((day) => day.toString()).join("\n");
    }

    addDay(day: Day): void {
        this.json.data.days.push(day);
    }

    addRange(start: DateTime, end: DateTime, flow?: Flow, notes?: string): void {
        const interval = Interval.fromDateTimes(start, end.plus({ days: 1 }));
        const days = interval.splitBy({ days: 1 });
        days.forEach((day) => {
            this.addDay(new Day(day.start || DateTime.local(), flow, notes));
        });
    }

    write(key: Buffer): void {
        const encrypted = crypt.encrypt(key, Buffer.from(this.toString()));
        fs.writeFileSync("data/data.enc", encrypted);
        fs.writeFileSync("data/data.sha256", crypt.sha256(encrypted));
    }

    static read(key: Buffer): Data {
        const data = fs.readFileSync("data/data.enc");
        if (!crypt.checkIntegrity(data, fs.readFileSync("data/data.sha256"))) {
            switch (
                readlineSync.question(
                    "Data integrity check failed, possible corruption or tampering. Continue? (y/n)"
                )
            ) {
                case "y":
                    break;
                default:
                    process.exit(1);
            }
        }
        const decrypted = crypt.decrypt(key, data);
        const rawJson = JSON.parse(decrypted.toString());
        rawJson.data.days = rawJson.data.days.map(
            (day: DayJSON) => new Day(DateTime.fromISO(day.date), day.flow, day.notes)
        );
        const parsed = new Data(rawJson);
        parsed.validate();
        return parsed;
    }
}
