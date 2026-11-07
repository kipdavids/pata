import MatchClient from "./MatchClient";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <MatchClient code={code} />;
}
