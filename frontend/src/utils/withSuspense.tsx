import type { ReactNode } from 'react';
import { Suspense } from 'react';

export function withSuspense(node: ReactNode) {
    return <Suspense fallback={null}>{node}</Suspense>;
}
