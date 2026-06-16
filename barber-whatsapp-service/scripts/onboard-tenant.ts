import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

async function main() {
  const args = process.argv.slice(2);
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: DATABASE_URL is not defined in environment variables.');
    process.exit(1);
  }

  const name = args[0] || 'Barbearia Staging';
  const slug = args[1] || 'barbearia-staging';
  const email = args[2] || 'staging@barberai.com';
  const phone = args[3] || '5511988888888';
  const ownerName = args[4] || 'Admin Staging';
  const ownerEmail = args[5] || 'admin@barbeariastaging.com';
  const password = args[6] || 'senha123';

  console.log(`Onboarding new tenant: "${name}" (${slug})...`);

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Check if slug already exists
    const existing = await prisma.barbershop.findUnique({
      where: { slug },
    });

    if (existing) {
      console.error(`Error: Barbershop with slug "${slug}" already exists.`);
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Create Barbershop
    const barbershop = await prisma.barbershop.create({
      data: {
        name,
        slug,
        phone,
        email,
        address: 'Endereço Comercial de Teste, 100',
        workingHours: '09:00-18:00',
        timezone: 'America/Sao_Paulo',
      },
    });

    // 2. Create Active Subscription (PREMIUM_AI)
    await prisma.subscription.create({
      data: {
        barbershopId: barbershop.id,
        plan: 'PREMIUM_AI',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias de trial
      },
    });

    // 3. Create Default WhatsApp Instance
    await prisma.whatsAppInstance.create({
      data: {
        instanceName: `${slug}-wa`,
        status: 'DISCONNECTED',
        barbershopId: barbershop.id,
      },
    });

    // 4. Create Owner User
    const owner = await prisma.user.create({
      data: {
        name: ownerName,
        email: ownerEmail,
        password: hashedPassword,
        role: 'OWNER',
        barbershopId: barbershop.id,
      },
    });

    // 5. Create Default Barber
    const barber = await prisma.barber.create({
      data: {
        name: `${ownerName} (Barbeiro)`,
        specialty: 'Cabelo e Barba',
        barbershopId: barbershop.id,
      },
    });

    // Default working hours for barber
    for (let day = 1; day <= 6; day++) {
      await prisma.workingHours.create({
        data: { barberId: barber.id, dayOfWeek: day, startTime: '09:00', endTime: '18:00' },
      });
    }

    // 6. Create Default Services
    const serviceCorte = await prisma.service.create({
      data: {
        name: 'Corte Tradicional',
        description: 'Corte tesoura ou máquina convencional',
        price: 40.00,
        durationMinutes: 30,
        barbershopId: barbershop.id,
      },
    });

    const serviceBarba = await prisma.service.create({
      data: {
        name: 'Barba Alinhada',
        description: 'Alinhamento e corte simples de barba',
        price: 25.00,
        durationMinutes: 20,
        barbershopId: barbershop.id,
      },
    });

    console.log(`\n==================================================`);
    console.log(`🎉 TENANT ONBOARDED SUCCESSFULLY!`);
    console.log(`==================================================`);
    console.log(`- Barbershop ID: ${barbershop.id}`);
    console.log(`- Barbershop Slug: ${barbershop.slug}`);
    console.log(`- WhatsApp Instance: ${slug}-wa (DISCONNECTED)`);
    console.log(`- Owner Email: ${owner.email}`);
    console.log(`- Owner Password: ${password}`);
    console.log(`- Created Default Barber: ${barber.name}`);
    console.log(`- Created Services: Corte Tradicional (R$40), Barba Alinhada (R$25)`);
    console.log(`==================================================\n`);

  } catch (err: any) {
    console.error('Error during onboarding:', err.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
