import axios from "axios";
import { JSDOM } from "jsdom";
import fs from "fs";
import { CronJob } from "cron";
import dayjs from "dayjs";

interface TeamMember {
  league: string;
  team: string;
  handle: string;
  role: string;
  firstName: string;
  lastName: string;
  contract: string;
  status: string;
  activeStatus: string;
  teamCode: string;
  contactInfo: string;
}
interface ChangeLog {
  type: "ADDED" | "UPDATED" | "REMOVED";
  team: string;
  handle: string;
  firstName: string;
  lastName: string;
  changes?: Record<string, { old: string; new: string }>; // UPDATED için değişen alanlar
}
const Id: any = {
  "1474170664": "CN",
  "1856086064": "AMERICAS",
  "0": "EMEA",
  "1819901194": "PACIFIC",
};
const id = ["1474170664", "1856086064", "1819901194", "0"];

function compareAndLogChanges(
  webData: TeamMember[],
  localData: TeamMember[]
): string[] {
  const changeMessages: string[] = [];

  const localDataMap = new Map(localData.map((item) => [item.handle, item]));
  const webDataMap = new Map(webData.map((item) => [item.handle, item]));

  // Yeni eklenen verileri bulma
  for (const webItem of webData) {
    // Eğer handle, firstName veya lastName eksikse o kişiyi atla
    if (!webItem.handle || !webItem.firstName || !webItem.lastName) {
      continue;
    }

    if (!localDataMap.has(webItem.handle)) {
      changeMessages.push(
        `${webItem.firstName.toUpperCase()} "${webItem.handle}" ${
          webItem.lastName
        } has been added to ${webItem.team} with a ${webItem.contract} contract`
      );
    }
  }

  // Silinen verileri bulma
  for (const localItem of localData) {
    // Eğer handle, firstName veya lastName eksikse o kişiyi atla
    if (!localItem.handle || !localItem.firstName || !localItem.lastName) {
      continue;
    }

    if (!webDataMap.has(localItem.handle)) {
      changeMessages.push(
        `${localItem.firstName.toUpperCase()} "${localItem.handle}" ${
          localItem.lastName
        } has been removed from ${localItem.team}`
      );
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
      const changedFields: Record<string, { old: string; new: string }> = {};

      // Alanları karşılaştırma ve boş olanları atlama
      Object.keys(webItem).forEach((key) => {
        const newValue = webItem[key as keyof TeamMember] as string;
        const oldValue = localItem[key as keyof TeamMember] as string;

        // Eski ve yeni değer boş veya anlamsız ise (örneğin sadece boş stringler), o değişikliği atla
        if (newValue && oldValue !== newValue) {
          changedFields[key] = { old: oldValue, new: newValue };
        }
      });

      if (Object.keys(changedFields).length > 0) {
        const changes = Object.entries(changedFields)
          .map(
            ([key, { old, new: newValue }]) =>
              `${key} was changed from ${old} to ${newValue}`
          )
          .join(", ");

        changeMessages.push(
          `${webItem.firstName.toUpperCase()} "${webItem.handle}" ${
            webItem.lastName
          } (${webItem.team}) ${changes}`
        );
      }
    }
  }

  return changeMessages;
}

async function scrapeUrlToJson(url: string, id: string[]) {
  try {
    // Fetch the HTML content from the URL
    const response = await axios.get(url);
    const html = response.data;

    Logger("Fetched VCT Contract Database content successfully");

    // Parse the HTML
    const dom = new JSDOM(html);
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

      const teamMembers: TeamMember[] = [];

      // Select all rows from the tbody
      const rows = table.querySelectorAll("tbody tr");
      //   Logger(`Number of rows found ${rows.length} in ${Id[id]} Table`);
      const update = rows[0].querySelectorAll("td")[1].textContent;
      if (lastUpdate[Id[id]] === update) {
        Logger(`No new data found in ${Id[id]}`);
        return;
      } else {
        lastUpdate[Id[id]] = update;
        fs.writeFileSync(
          "lastUpdate.json",
          JSON.stringify(lastUpdate, null, 2)
        );
      }

      rows.forEach((row, index) => {
        const cells = row.querySelectorAll("td");

        if (cells.length >= 11) {
          const teamMember: TeamMember = {
            league: cells[0].textContent?.trim() || "",
            team: cells[1].textContent?.trim() || "",
            handle: cells[2].textContent?.trim() || "",
            role: cells[3].textContent?.trim() || "",
            firstName: cells[4].textContent?.trim() || "",
            lastName: cells[5].textContent?.trim() || "",
            contract: cells[6].textContent?.trim() || "",
            status: cells[7].textContent?.trim() || "",
            activeStatus: cells[8].textContent?.trim() || "",
            teamCode: cells[9].textContent?.trim() || "",
            contactInfo: cells[10].textContent?.trim() || "",
          };

          teamMembers.push(teamMember);
        } else {
          // Logger(`Skipping row ${index + 1} due to insufficient cells (found ${cells.length})`);
        }
      });

      Logger(
        `Total team members parsed: ${teamMembers.length} in ${Id[id]} Table`
      );
      compareAndLogChanges(
        teamMembers,
        JSON.parse(fs.readFileSync(`${Id[id]}.json`, "utf-8"))
      ).forEach((message) => {
        sendTweet(message, id);
      });

      fs.writeFileSync(`${Id[id]}.json`, JSON.stringify(teamMembers, null, 2));
    });
  } catch (error) {
    console.error("Error scraping URL:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
    }
    return [];
  }
}

function sendTweet(changeMessages: string, regionIndex?: string) {
  try {
    const oldFile = fs.readFileSync("lastUpdate.json", "utf-8");
    const oldData = JSON.parse(oldFile);
    const teamName = changeMessages.split("(")[1]?.split(")")?.at(0) || null;
    
    // oldData'nın bir array olduğundan emin olun, değilse yeni bir array oluşturun
    const updatesList = Array.isArray(oldData) ? oldData : [];

    updatesList.push({
      date: Date.now(),
      message: changeMessages.replace(/\s*\([^)]*\)\s*/g, " "),
      team: teamName || "",
      region: `${regionIndex ? Id[regionIndex] : "ALL"}`,
    });
    
    fs.writeFileSync("lastUpdate.json", JSON.stringify(updatesList, null, 2));
    // ... rest of the function remains the same
  } catch (error: any) {
    handleError(error.message);
  }
}
function handleError(msg: string) {
  fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: "ExponentPushToken[2vH8aqNUGlIytRgV3MY9zM]",
      title: `Terminal 02: Error`,
      body: `Error Message: ${msg}`,
    }),
  });
}

function Logger(log: string) {
  console.log(`[${dayjs().format("D MMM YYYY HH:mm")}] - ${log}`);
}
// Example usage
const url =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRmmWiBmMMD43m5VtZq54nKlmj0ZtythsA1qCpegwx-iRptx2HEsG0T3cQlG1r2AIiKxBWnaurJZQ9Q/pubhtml#";

let lastUpdate = JSON.parse(fs.readFileSync("lastUpdate.json", "utf-8"));
const job = new CronJob("*/5 * * * *", async () => {
  Logger(`Scraping data and checking for updates...`);
  try {
    lastUpdate = JSON.parse(fs.readFileSync("lastUpdate.json", "utf-8"));

    scrapeUrlToJson(url, id)
      .then(() => {
        Logger("Scraping completed");
      })
      .catch((error) => console.error("Error:", error));
  } catch (error) {
    console.error("Error scraping URL:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
    }
  }
});
job.start();
