'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewEvaluationPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/evaluations');
  }, [router]);

  return (
    <div className="p-8 text-center text-slate-500 text-sm">
      Redirecting to Evaluation Wizard...
    </div>
  );
}
