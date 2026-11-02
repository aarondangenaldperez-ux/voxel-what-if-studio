function format(value) {
  return Number(value || 0).toFixed(2);
}

export default function SimulationInsights({ report }) {
  if (!report) return null;
  return (
    <section className="simulation-results" aria-live="polite" aria-label="Computed simulation results">
      <div className="simulation-results-heading">
        <div>
          <span className="simulation-eyebrow">COMPUTED SIMULATION · {report.modelId.toUpperCase()}</span>
          <h3>What the model calculated</h3>
        </div>
        <span className="simulation-status">DETERMINISTIC MODEL</span>
      </div>
      <div className="simulation-metrics">
        <div><strong>{report.vehicleCount}</strong><span>vehicles modeled</span></div>
        <div><strong>{format(report.eventDurationSeconds)}s</strong><span>tire-loss interval</span></div>
        <div><strong>{format(report.stoppedVehicleSeconds)}</strong><span>stopped vehicle-seconds</span></div>
        <div><strong>{format(report.meanTravelDistanceShortfall)}</strong><span>mean travel gap · scene units</span></div>
      </div>
      <p className="simulation-comparison">
        Mean travel distance at {report.durationSeconds}s: <b>{format(report.scenarioMeanTravelDistance)}</b> scene units in the affected scenario, versus <b>{format(report.baselineMeanTravelDistance)}</b> in the unchanged baseline.
      </p>
      <details className="simulation-assumptions">
        <summary>Model assumptions and limits</summary>
        <ul>{report.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
        <p>{report.limitations}</p>
      </details>
    </section>
  );
}
