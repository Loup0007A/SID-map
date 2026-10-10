'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readGuideState, writeGuideState, type Audience, type GuideFacts, type GuideState, type TourStep } from '@/lib/guide';
import GuideTour from './GuideTour';
import HelpCenter from './HelpCenter';

type TourKind = Audience | 'full';

interface GuideContextValue {
  ready: boolean;
  state: GuideState;
  /** étape de visite en cours (la carte s'en sert pour déplier ses panneaux) */
  activeStep: TourStep | null;
  tourRunning: boolean;
  startTour: (kind: TourKind) => void;
  openHelp: (tab?: 'start' | 'topics') => void;
  dismiss: (id: string) => void;
  facts: GuideFacts | null;
  setFacts: (f: GuideFacts | null) => void;
}

const GuideContext = createContext<GuideContextValue | null>(null);

export function GuideProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<GuideState>({ seenPlayer: false, seenAdmin: false, dismissed: [] });
  const [tour, setTour] = useState<TourKind | null>(null);
  const [activeStep, setActiveStep] = useState<TourStep | null>(null);
  const [help, setHelp] = useState<'start' | 'topics' | null>(null);
  const [facts, setFacts] = useState<GuideFacts | null>(null);

  useEffect(() => {
    setState(readGuideState());
    setReady(true);
  }, []);

  const update = useCallback((fn: (s: GuideState) => GuideState) => {
    setState((prev) => {
      const next = fn(prev);
      writeGuideState(next);
      return next;
    });
  }, []);

  const startTour = useCallback((kind: TourKind) => {
    setHelp(null);
    setTour(kind);
  }, []);

  const endTour = useCallback(() => {
    // Terminée ou passée : dans les deux cas on ne la repropose pas d'office.
    update((s) => ({
      ...s,
      seenPlayer: s.seenPlayer || tour === 'player' || tour === 'full',
      seenAdmin: s.seenAdmin || tour === 'admin' || tour === 'full'
    }));
    setTour(null);
    setActiveStep(null);
  }, [tour, update]);

  const dismiss = useCallback(
    (id: string) => update((s) => (s.dismissed.includes(id) ? s : { ...s, dismissed: [...s.dismissed, id] })),
    [update]
  );

  const openHelp = useCallback((tab: 'start' | 'topics' = 'start') => setHelp(tab), []);

  const value = useMemo(
    () => ({ ready, state, activeStep, tourRunning: tour !== null, startTour, openHelp, dismiss, facts, setFacts }),
    [ready, state, activeStep, tour, startTour, openHelp, dismiss, facts]
  );

  return (
    <GuideContext.Provider value={value}>
      {children}
      {help && <HelpCenter initialTab={help} facts={facts} onStartTour={startTour} onClose={() => setHelp(null)} />}
      {tour && <GuideTour kind={tour} onStep={setActiveStep} onEnd={endTour} />}
    </GuideContext.Provider>
  );
}

export function useGuide() {
  const ctx = useContext(GuideContext);
  if (!ctx) throw new Error('useGuide doit être utilisé sous <GuideProvider>');
  return ctx;
}
