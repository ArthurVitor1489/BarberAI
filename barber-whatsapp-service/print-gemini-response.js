const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
require('dotenv/config');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const client = await prisma.client.findFirst({
    where: { phone: '5511977777777' }
  });
  if (!client) {
    console.log('Client not found');
    return;
  }
  const messages = await prisma.message.findMany({
    where: { clientId: client.id },
    orderBy: { timestamp: 'desc' },
    take: 3
  });
  console.log(`Last 3 messages for ${client.name}:`);
  messages.reverse().forEach((m) => {
    const sender = m.fromMe ? 'AI/Staff' : 'Client';
    console.log(`[${sender}]: ${m.text}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
