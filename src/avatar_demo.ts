import { readFile } from "node:fs/promises";

const imagePath = process.argv[2];
if (!imagePath) throw new Error("Run npm run demo -- path/to/avatar.jpg");

const imageBase64 = (await readFile(imagePath)).toString("base64");
const response = await fetch("http://localhost:3000/avatars", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ creatorId: "creator_42", filename: "portrait.jpg", imageBase64, aspect: "1:1" })
});
const result = await response.json();
console.log(JSON.stringify(result, null, 2));
