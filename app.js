"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const jsdom_1 = require("jsdom");
const fs_1 = __importDefault(require("fs"));
const cron_1 = require("cron");
const dayjs_1 = __importDefault(require("dayjs"));
const Id = {
    "1474170664": "CN",
    "1856086064": "AMERICAS",
    "0": "EMEA",
    "1819901194": "PACIFIC",
};
const id = ["1474170664", "1856086064", "1819901194", "0"];
function compareAndLogChanges(webData, localData) {
    const changeMessages = [];
    const localDataMap = new Map(localData.map((item) => [item.handle, item]));
    const webDataMap = new Map(webData.map((item) => [item.handle, item]));
    // Yeni eklenen verileri bulma
    for (const webItem of webData) {
        // Eğer handle, firstName veya lastName eksikse o kişiyi atla
        if (!webItem.handle || !webItem.firstName || !webItem.lastName) {
            continue;
        }
        if (!localDataMap.has(webItem.handle)) {
            changeMessages.push(`${webItem.firstName.toUpperCase()} "${webItem.handle}" ${webItem.lastName} has been added to ${webItem.team} with a ${webItem.contract} contract`);
        }
    }
    // Silinen verileri bulma
    for (const localItem of localData) {
        // Eğer handle, firstName veya lastName eksikse o kişiyi atla
        if (!localItem.handle || !localItem.firstName || !localItem.lastName) {
            continue;
        }
        if (!webDataMap.has(localItem.handle)) {
            changeMessages.push(`${localItem.firstName.toUpperCase()} "${localItem.handle}" ${localItem.lastName} has been removed from ${localItem.team}`);
        }
    }
    // Değiştirilen verileri bulma ve hangi değerlerin değiştiğini belirleme
    for (const webItem of webData) {
        const localItem = localDataMap.get(webItem.handle);
        // Eğer handle, firstName veya lastName eksikse o kişiyi atla
        if (!webItem.handle || !webItem.firstName || !webItem.lastName) {
            continue;
        }
        if (localItem) {
            const changedFields = {};
            // Alanları karşılaştırma ve boş olanları atlama
            Object.keys(webItem).forEach((key) => {
                const newValue = webItem[key];
                const oldValue = localItem[key];
                // Eski ve yeni değer boş veya anlamsız ise (örneğin sadece boş stringler), o değişikliği atla
                if (newValue && oldValue !== newValue) {
                    changedFields[key] = { old: oldValue, new: newValue };
                }
            });
            if (Object.keys(changedFields).length > 0) {
                const changes = Object.entries(changedFields)
                    .map(([key, { old, new: newValue }]) => `${key} was changed from ${old} to ${newValue}`)
                    .join(", ");
                changeMessages.push(`${webItem.firstName.toUpperCase()} "${webItem.handle}" ${webItem.lastName} (${webItem.team}) ${changes}`);
            }
        }
    }
    return changeMessages;
}
function scrapeUrlToJson(url, id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Fetch the HTML content from the URL
            const response = yield axios_1.default.get(url);
            const html = response.data;
            Logger("Fetched VCT Contract Database content successfully");
            // Parse the HTML
            const dom = new jsdom_1.JSDOM(html);
            const document = dom.window.document;
            // Find the div with id '1474170664'
            id.forEach((id) => {
                const targetDiv = document.getElementById(id);
                if (!targetDiv) {
                    throw new Error("Div with id '" + id + "' not found");
                }
                // Find the table within the target div
                const table = targetDiv.querySelector("table");
                if (!table) {
                    throw new Error("Table not found within the target div");
                }
                const teamMembers = [];
                // Select all rows from the tbody
                const rows = table.querySelectorAll("tbody tr");
                //   Logger(`Number of rows found ${rows.length} in ${Id[id]} Table`);
                const update = rows[0].querySelectorAll("td")[1].textContent;
                if (lastUpdate[Id[id]] === update) {
                    Logger(`No new data found in ${Id[id]}`);
                    return;
                }
                else {
                    lastUpdate[Id[id]] = update;
                    fs_1.default.writeFileSync("lastUpdate.json", JSON.stringify(lastUpdate, null, 2));
                }
                rows.forEach((row, index) => {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
                    const cells = row.querySelectorAll("td");
                    if (cells.length >= 11) {
                        const teamMember = {
                            league: ((_a = cells[0].textContent) === null || _a === void 0 ? void 0 : _a.trim()) || "",
                            team: ((_b = cells[1].textContent) === null || _b === void 0 ? void 0 : _b.trim()) || "",
                            handle: ((_c = cells[2].textContent) === null || _c === void 0 ? void 0 : _c.trim()) || "",
                            role: ((_d = cells[3].textContent) === null || _d === void 0 ? void 0 : _d.trim()) || "",
                            firstName: ((_e = cells[4].textContent) === null || _e === void 0 ? void 0 : _e.trim()) || "",
                            lastName: ((_f = cells[5].textContent) === null || _f === void 0 ? void 0 : _f.trim()) || "",
                            contract: ((_g = cells[6].textContent) === null || _g === void 0 ? void 0 : _g.trim()) || "",
                            status: ((_h = cells[7].textContent) === null || _h === void 0 ? void 0 : _h.trim()) || "",
                            activeStatus: ((_j = cells[8].textContent) === null || _j === void 0 ? void 0 : _j.trim()) || "",
                            teamCode: ((_k = cells[9].textContent) === null || _k === void 0 ? void 0 : _k.trim()) || "",
                            contactInfo: ((_l = cells[10].textContent) === null || _l === void 0 ? void 0 : _l.trim()) || "",
                        };
                        teamMembers.push(teamMember);
                    }
                    else {
                        // Logger(`Skipping row ${index + 1} due to insufficient cells (found ${cells.length})`);
                    }
                });
                Logger(`Total team members parsed: ${teamMembers.length} in ${Id[id]} Table`);
                compareAndLogChanges(teamMembers, JSON.parse(fs_1.default.readFileSync(`${Id[id]}.json`, "utf-8"))).forEach((message) => {
                    sendTweet(message);
                });
                fs_1.default.writeFileSync(`${Id[id]}.json`, JSON.stringify(teamMembers, null, 2));
            });
        }
        catch (error) {
            console.error("Error scraping URL:", error);
            if (error instanceof Error) {
                console.error("Error message:", error.message);
            }
            return [];
        }
    });
}
function sendTweet(changeMessages) {
    Logger(changeMessages);
}
function Logger(log) {
    console.log(`[${(0, dayjs_1.default)().format("HH:mm")}] - ${log}`);
}
// Example usage
const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRmmWiBmMMD43m5VtZq54nKlmj0ZtythsA1qCpegwx-iRptx2HEsG0T3cQlG1r2AIiKxBWnaurJZQ9Q/pubhtml#";
let lastUpdate = JSON.parse(fs_1.default.readFileSync("lastUpdate.json", "utf-8"));
const job = new cron_1.CronJob("*/5 * * * *", () => __awaiter(void 0, void 0, void 0, function* () {
    Logger(`Scraping data and checking for updates...`);
    try {
        lastUpdate = JSON.parse(fs_1.default.readFileSync("lastUpdate.json", "utf-8"));
        scrapeUrlToJson(url, id)
            .then(() => {
            Logger("Scraping completed");
        })
            .catch((error) => console.error("Error:", error));
    }
    catch (error) {
        console.error("Error scraping URL:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
        }
    }
}));
job.start();
