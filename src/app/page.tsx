import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default function Home() {
  return redirect("/dashboard");
}
