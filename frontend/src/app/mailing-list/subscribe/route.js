import { promises as fs } from "fs";
import path from "path";

export async function POST(request) {
  const { email, name, phone, comments } = await request.json();
  if (!email || !email.includes("@")) {
    return new Response("Invalid email", { status: 400 });
  }

  const filePath = path.join(process.cwd(), "subscribers.json");
  let data = [];
  try {
    const file = await fs.readFile(filePath, "utf8");
    data = JSON.parse(file);
  } catch {
    data = [];
  }
  if (!data.includes(email)) {
    data.push({ email, name, phone, comments });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }
  return new Response("OK", { status: 200 });
}
