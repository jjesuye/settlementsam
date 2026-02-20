'use client';
/**
 * lib/estimator/useEstimator.ts
 * React state hook for the Case Value Estimator widget.
 * Wraps the pure logic functions in a useReducer + useMemo pattern.
 */

import { useReducer, useMemo } from 'react';
import type { EstimatorInputs, EstimatorAction, EstimateRange, InjuryType } from './types';
import { calculateEstimate, buildSummaryText, isReadyToEstimate } from './logic';

const INITIAL_STATE: EstimatorInputs = {
  injuryType: null,
  hasSurgery: false,
  lostWages:  0,
};

function estimatorReducer(state: EstimatorInputs, action: EstimatorAction): EstimatorInputs {
  switch (action.type) {
    case 'SET_INJURY_TYPE': return { ...state, injuryType: action.payload };
    case 'SET_SURGERY':     return { ...state, hasSurgery: action.payload };
    case 'SET_LOST_WAGES':  return { ...state, lostWages: action.payload };
    case 'RESET':           return INITIAL_STATE;
    default:                return state;
  }
}

export interface UseEstimatorReturn {
  inputs:      EstimatorInputs;
  estimate:    EstimateRange | null;
  summaryText: string | null;
  isReady:     boolean;
  setInjuryType: (type: InjuryType) => void;
  setSurgery:    (hasSurgery: boolean) => void;
  setLostWages:  (amount: number) => void;
  reset:         () => void;
}

export function useEstimator(): UseEstimatorReturn {
  const [inputs, dispatch] = useReducer(estimatorReducer, INITIAL_STATE);

  const estimate    = useMemo(() => calculateEstimate(inputs), [inputs]);
  const summaryText = useMemo(() => buildSummaryText(inputs),  [inputs]);
  const isReady     = useMemo(() => isReadyToEstimate(inputs), [inputs]);

  return {
    inputs,
    estimate,
    summaryText,
    isReady,
    setInjuryType: (type)   => dispatch({ type: 'SET_INJURY_TYPE', payload: type }),
    setSurgery:    (val)    => dispatch({ type: 'SET_SURGERY',     payload: val  }),
    setLostWages:  (amount) => dispatch({ type: 'SET_LOST_WAGES',  payload: amount }),
    reset:         ()       => dispatch({ type: 'RESET' }),
  };
}
