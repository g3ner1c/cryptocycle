import * as crypt from "../lib/crypt";
import * as cycle from "../lib/cycle";
import { Command, Option } from "commander";
import * as fs from "fs";
import { DateTime } from "luxon";
import * as readlineSync from "readline-sync";

const colors = require("colors/safe");

function initParser(key: Buffer) {
    const parser = new Command();

    // argument parsing for cli interface

    parser.name(">").description("argparser for cli");

    parser
        .command("view")
        .description("view data")
        .option("-l, --list", "view as list")
        .addOption(new Option("-j, --json", "view as json").conflicts("list"))
        .option("-s, --save <path>", "save data (unencrypted!!!)")
        .action((options) => {
            const data = cycle.Data.read(key);
            let text: string;
            if (!options.list && !options.json) {
                // view as calendar
                text = data.calendar(data.json.data.days[0].date.until(DateTime.local()));
            } else {
                text = options.json ? data.toString(2) : data.toList();
            }
            console.log(text);
            console.log("\ndays since last end:", colors.green(data.daysSinceMenses()));
            if (options.save) {
                fs.writeFileSync(options.save, text);
            }
        })
        .exitOverride();

    parser
        .command("add")
        .description("add a day")
        .argument("[date]", "date to add", DateTime.local().toISODate() as string)
        .option("-b, --bleeding", "bleeding")
        .option("-n, --notes <notes>", "notes")
        .action((date, options) => {
            const data = cycle.Data.read(key);
            const newDay = new cycle.Day(DateTime.fromISO(date), options.bleeding, options.notes);
            if (!newDay.date.isValid) {
                console.log("invalid date");
                return;
            }
            if (data.json.data.days.find((day) => day.date.toISODate() == date)) {
                console.log("day already exists");
                return;
            }
            data.addDay(newDay);
            data.validate();
            data.write(key);
            console.log("added entry:", newDay.toString());
        })
        .exitOverride();

    parser
        .command("remove")
        .description("remove a day")
        .argument("[date]", "date to remove", DateTime.local().toISODate() as string)
        .option("-a, --all", "remove all stored entries")
        .action((date, option) => {
            if (option.all) {
                switch (
                    readlineSync.question("Are you sure you want to remove all entries? (y/n)")
                ) {
                    case "y":
                        const newData = new cycle.Data();
                        newData.write(key);
                        console.log("removed all entries");
                        return;
                    default:
                        console.log("aborting");
                        return;
                }
            }
            const data = cycle.Data.read(key);
            const day = data.json.data.days.find((day) => day.date.toISODate() == date);
            if (!day) {
                console.log("day does not exist");
                return;
            }
            data.json.data.days = data.json.data.days.filter(
                (day) => day.date.toISODate() != date
            );
            data.write(key);
            console.log("removed entry:", day.toString());
        });

    parser
        .command("clear")
        .description("clear previous commands")
        .action(() => {
            console.clear();
        })
        .exitOverride();

    parser
        .command("exit")
        .description("exit")
        .action(() => {
            process.exit(0);
        });

    return parser;
}

function main() {
    const key = crypt.login();
    if (!key) {
        return;
    }

    while (true) {
        const parser = initParser(key);
        const input = readlineSync.question("> ");
        parser.exitOverride();
        try {
            parser.parse(input.split(" "), { from: "user" });
        } catch (e) {}
    }
}

main();
