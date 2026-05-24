import React, { useState, useRef } from 'react';
import type { Parameters, EvaluationType, EvaluationPoint } from './types';
import { evaluateObjective } from './utils/dummyBO';
import WebpagePreview from './components/WebpagePreview';
import SetParameters from './components/SetParameters';
import Evaluate from './components/Evaluate';
import CheckResults from './components/CheckResults';
import './App.css';

const DEFAULT_PARAMS: Parameters = {
  opacity: 0.5,
  distance: 0.5,
  iconSize: 0.5,
  boxSize: 0.5,
  textSize: 0.5,
};

const EVAL_DURATIONS: Record<EvaluationType, number> = {
  informal: 3000,
  formal: 20000,
};

let nextId = 1;

const App: React.FC = () => {
  const [params, setParams] = useState<Parameters>(DEFAULT_PARAMS);
  const [history, setHistory] = useState<EvaluationPoint[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalType, setEvalType] = useState<EvaluationType | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEvaluate = (type: EvaluationType) => {
    if (isEvaluating) return;
    setIsEvaluating(true);
    setEvalType(type);

    timerRef.current = setTimeout(() => {
      const { speed, accuracy } = evaluateObjective(params, type);

      setHistory((prev) => {
        const updated = prev.map((p) => ({ ...p, isLatent: false }));
        const newPoint: EvaluationPoint = {
          id: nextId++,
          type,
          speed,
          accuracy,
          parameters: { ...params },
          isLatent: true,
        };
        return [...updated, newPoint];
      });

      setIsEvaluating(false);
      setEvalType(null);
    }, EVAL_DURATIONS[type]);
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <span className="app-logo">◈ CoopDesignBO</span>
        <span className="app-subtitle">
          Cooperative Bayesian Optimization for UI Design
        </span>
      </header>

      <main className="app-panels">
        <div className="panel panel--preview">
          <div className="panel-label">
            <span className="panel-label-dot panel-label-dot--blue" />
            Webpage Preview
          </div>
          <div className="panel-content">
            <WebpagePreview params={params} />
          </div>
        </div>

        <div className="panel panel--params">
          <div className="panel-label">
            <span className="panel-label-dot panel-label-dot--purple" />
            Set Parameters
          </div>
          <div className="panel-content panel-content--padded">
            <SetParameters params={params} onParamsChange={setParams} evaluationHistory={history} />
          </div>
        </div>

        <div className="panel panel--evaluate">
          <div className="panel-label">
            <span className="panel-label-dot panel-label-dot--amber" />
            Evaluate
          </div>
          <div className="panel-content panel-content--padded">
            <Evaluate
              isEvaluating={isEvaluating}
              evaluatingType={evalType}
              onEvaluate={handleEvaluate}
            />
          </div>
        </div>

        <div className="panel panel--results">
          <div className="panel-label">
            <span className="panel-label-dot panel-label-dot--green" />
            Check &amp; Analyze Results
          </div>
          <div className="panel-content panel-content--padded">
            <CheckResults history={history} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
