import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const templateCount = await prisma.template.count();
    const templates = await prisma.template.findMany({
        select: { id: true, name: true, projectId: true, isTemplate: true, deletedAt: true }
    });
    const projects = await prisma.project.findMany({
        select: { id: true, name: true, slug: true }
    });

    console.log('Templates Count:', templateCount);
    console.log('Templates:', JSON.stringify(templates, null, 2));
    console.log('Projects:', JSON.stringify(projects, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
