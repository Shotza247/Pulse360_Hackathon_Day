import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      service: "pulse360",
      database: "reachable",
    });
  } catch (error) {
    console.error("Health check failed", error);

    return NextResponse.json(
      {
        ok: false,
        service: "pulse360",
        database: "unreachable",
      },
      { status: 503 },
    );
  }
}
