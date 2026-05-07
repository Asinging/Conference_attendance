import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentEventDay } from '../../../shared/eventConfig.js';

export function useEventDay() {
  const [params] = useSearchParams();
  return useMemo(() => {
    const override = params.get('day');
    if (override === '1') return 1;
    if (override === '2') return 2;
    return getCurrentEventDay();
  }, [params]);
}
