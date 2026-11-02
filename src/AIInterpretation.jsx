export default function AIInterpretation({ plan, error, busy }) {
  if (busy) return <div className="ai-analysis-state" role="status">AI is interpreting the scenario and checking registered simulation capabilities…</div>;
  if (error) return <div className="ai-analysis-error" role="alert">{error}</div>;
  if (!plan) return <div className="ai-analysis-hint">AI reasoning requires the separately hosted server service. No model key is stored in this browser.</div>;

  return (
    <section className="ai-analysis-result" aria-live="polite">
      <div className="ai-analysis-heading">
        <span>AI SCENARIO INTERPRETATION</span>
        <b className={plan.classification === "supported" ? "supported" : "unsupported"}>
          {plan.classification === "supported" ? "MODEL AVAILABLE" : "NO REGISTERED MODEL"}
        </b>
      </div>
      <h3>{plan.title}</h3>
      <p>{plan.summary}</p>
      {plan.entities.length > 0 && <div className="ai-plan-section"><strong>Identified entities</strong><span>{plan.entities.map((entity) => entity.label).join(" · ")}</span></div>}
      {plan.relationships.length > 0 && <div className="ai-plan-section"><strong>Cause-and-effect relationships</strong><ul>{plan.relationships.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {plan.variables.length > 0 && <div className="ai-plan-section"><strong>Variables</strong><span>{plan.variables.map((item) => item.name + ": " + item.value + " " + item.unit).join(" · ")}</span></div>}
      {plan.requiredSystems.length > 0 && <div className="ai-plan-section"><strong>Required simulation systems</strong><ul>{plan.requiredSystems.map((item) => <li key={item.id}>{item.id} — {item.available ? "registered and available" : "not implemented yet"}: {item.reason}</li>)}</ul></div>}
      {plan.missingInformation.length > 0 && <div className="ai-plan-section"><strong>Missing information</strong><ul>{plan.missingInformation.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {plan.conflicts.length > 0 && <div className="ai-plan-section ai-plan-limitations"><strong>Conflicting assumptions</strong><ul>{plan.conflicts.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {plan.assumptions.length > 0 && <div className="ai-plan-section"><strong>Assumptions</strong><ul>{plan.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {plan.facts.length > 0 && <div className="ai-plan-section"><strong>Context identified in the prompt</strong><ul>{plan.facts.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {plan.limitations.length > 0 && <div className="ai-plan-section ai-plan-limitations"><strong>Limitations</strong><ul>{plan.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      <p className="ai-analysis-disclaimer">This is an AI-generated interpretation, not independent scientific verification. Only the registered model is executable.</p>
    </section>
  );
}
