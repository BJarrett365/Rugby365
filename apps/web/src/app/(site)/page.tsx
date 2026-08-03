import { redirect } from "next/navigation";

/** Public landing — Live Centre (scores & fixtures). */
export default function Home() {
  redirect("/matches");
}
