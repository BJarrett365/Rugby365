import { use } from "react";
import { MatchEditClient } from "./MatchEditClient";

export default function EditMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <MatchEditClient id={id} />;
}
