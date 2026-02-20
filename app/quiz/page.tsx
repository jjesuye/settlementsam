/**
 * /quiz — Full 12-question intake funnel.
 * Minimal chrome wrapper; QuizFlow handles all state.
 */
import type { Metadata } from 'next';
import { QuizFlow } from '@/components/quiz/QuizFlow';

export const metadata: Metadata = {
  title: 'Case Evaluation — Settlement Sam',
  description: 'Answer 12 quick questions and find out what your injury case is really worth.',
};

export default function QuizPage() {
  return <QuizFlow />;
}
