import { type NextRequest, NextResponse } from "next/server";
import { withApi } from "@/lib/api/errors";
import { registerSchema } from "@/lib/validation/auth";
import { registerAccount } from "@/lib/auth/register-account";

// Public signup for a customer or agent account. If the email already exists,
// the requested capability is added (after password verification), so one login
// can be both a customer and an agent.
export const POST = withApi(async (req: NextRequest) => {
  const input = registerSchema.parse(await req.json());
  const result = await registerAccount(input);
  return NextResponse.json({ data: result }, { status: 201 });
});
