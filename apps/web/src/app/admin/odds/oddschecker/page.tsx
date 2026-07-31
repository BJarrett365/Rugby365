import { redirect } from "next/navigation";

/** Oddschecker admin tool replaced by BMbets Rugby Union importer. */
export default function OddscheckerScrapePageRedirect() {
  redirect("/admin/odds/bmbets");
}
