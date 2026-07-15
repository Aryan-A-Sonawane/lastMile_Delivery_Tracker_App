import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi, badRequest, conflict } from "@/lib/api/errors";
import { registerSchema } from "@/lib/validation/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Public signup. Creates a confirmed Supabase auth user with the CUSTOMER role
// embedded in app_metadata (so it lands in the JWT), then creates the matching
// Profile row. The client signs in afterwards.
export const POST = withApi(async (req: NextRequest) => {
  const { name, email, password, phone } = registerSchema.parse(await req.json());
  const supabase = createAdminClient();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { role: "CUSTOMER" },
  });

  if (error || !data.user) {
    const message = error?.message ?? "Could not create account";
    if (/already|exists|registered/i.test(message)) {
      throw conflict("An account with this email already exists");
    }
    throw badRequest(message);
  }

  await prisma.profile.upsert({
    where: { id: data.user.id },
    create: { id: data.user.id, email, name, phone: phone ?? null, role: "CUSTOMER" },
    update: { name, phone: phone ?? null },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
});
