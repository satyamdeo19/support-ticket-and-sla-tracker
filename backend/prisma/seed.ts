import { PrismaClient, Priority } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashPassword } from "../src/services/auth.service.ts";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting database seed...");

  // 1. Clear existing data
  console.log("Cleaning database...");
  await prisma.comment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create users
  console.log("Creating users...");
  const passwordHash = await hashPassword("password123");

  const reporter = await prisma.user.create({
    data: {
      name: "Demo Reporter",
      email: "reporter@example.com",
      passwordHash,
      role: "REPORTER",
    },
  });

  const agent = await prisma.user.create({
    data: {
      name: "Demo Agent",
      email: "agent@example.com",
      passwordHash,
      role: "AGENT",
    },
  });

  // 3. Create a holiday
  console.log("Creating holiday...");
  await prisma.holiday.create({
    data: {
      name: "Christmas Day",
      date: new Date("2026-12-25T00:00:00Z"),
    },
  });

  // 4. Create 4 Tickets for the Reporter
  console.log("Creating tickets...");
  const ticketsData = [
    {
      title: "System Outage - All Services Down",
      description: "Our entire production system is unresponsive. Customers cannot log in or make purchases. We need immediate assistance.",
      priority: Priority.URGENT,
    },
    {
      title: "Payment Gateway Integration Failing",
      description: "Stripe webhook events are not being processed correctly. About 10% of payments are failing silently.",
      priority: Priority.HIGH,
    },
    {
      title: "Update API Documentation",
      description: "The v2 endpoints for user management are missing from the Swagger documentation.",
      priority: Priority.MEDIUM,
    },
    {
      title: "Typo on landing page",
      description: "There is a minor typo in the third paragraph of the About Us page.",
      priority: Priority.LOW,
    },
  ];

  for (const t of ticketsData) {
    await prisma.ticket.create({
      data: {
        title: t.title,
        description: t.description,
        priority: t.priority,
        reporterId: reporter.id,
        status: "OPEN",
      },
    });
  }

  console.log("✅ Seeding complete!");
  console.log("Login with:");
  console.log(" - reporter@example.com / password123");
  console.log(" - agent@example.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
