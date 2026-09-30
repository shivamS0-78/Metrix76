import { redirect } from 'next/navigation';

export default async function EvaluationRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/evaluations/${id}/review`);
}
