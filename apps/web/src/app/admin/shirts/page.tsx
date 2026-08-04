import { redirect } from "next/navigation";

/** Alias → standalone Shirt Library approval centre. */
export default function AdminShirtsAliasPage() {
  redirect("/admin/shirt-library");
}
