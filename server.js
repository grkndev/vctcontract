const dayjs = require("dayjs");
const express = require("express");
const fs = require("fs");
const app = express();

app.get("/", (req, res) => {
  res.json({ message: "Hello, world!" });
});
app.get("/region", (req, res) => {
  const code = req.query.code?.toUpperCase();
  if (!code) {
    return res.status(400).json({ error: "Region code is required" });
  }
  // Check if code is valid
  const validCodes = ["CN", "AMERICAS", "EMEA", "PACIFIC"];
  if (!validCodes.includes(code)) {
    return res.status(400).json({ error: "Invalid region code" });
  }

  // Read and parse the JSON file
  let rawData;
  try {
    rawData = fs.readFileSync(`./${code}.json`, "utf8");
  } catch (err) {
    return res.status(404).json({ error: "Region not found" });
  }

  const data = JSON.parse(rawData);

  // Filter out empty entries and group by team
  const teamMap = new Map();

  data.forEach((member) => {
    // Skip if team or required fields are empty
    if (
      !member.team ||
      !member.handle ||
      !member.firstName ||
      !member.lastName ||
      member.team === "Team"
    ) {
      return;
    }

    if (!teamMap.has(member.team)) {
      teamMap.set(member.team, {
        team: member.team,
        players: [],
      });
    }

    teamMap.get(member.team).players.push({
      handle: member.handle,
      role: member.role,
      firstName: member.firstName,
      lastName: member.lastName,
      contract: member.contract,
      status: member.status,
      activeStatus: member.activeStatus,
      contactInfo: member.contactInfo,
    });
  });

  // Convert Map to array for response
  const response = Array.from(teamMap.values());

  // Return the formatted team data
  return res.json({
    region: code,
    teams: response,
  });
});
app.get("/updates", (req, res) => {
  //retrun the local file updates.json
  let rawData;
  try {
    rawData = fs.readFileSync(`./updates.json`, "utf8");
  } catch (err) {
    return res.status(404).json({ error: "Updates not found" });
  }
  const data = JSON.parse(rawData);
  return res.json(data);
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
