import { redirect } from "next/navigation";

/** Legacy path — World Coach Rankings live at /rankings/coaches. */
export default function CoachRankingsRedirectPage() {
  redirect("/rankings/coaches");
}
