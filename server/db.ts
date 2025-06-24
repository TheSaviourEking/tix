import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import dotenv from "dotenv";
import * as schema from "@shared/schema";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

async function testConnection() {
  try {
    const result = await db.execute("SELECT 1");
    console.log("✅ Connected to DB:", result);
  } catch (err) {
    console.error("❌ DB connection failed:", err.message);
  }
}

testConnection();