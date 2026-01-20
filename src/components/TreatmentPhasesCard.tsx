interface TreatmentPhase {
  label: string;
  value: number;
  color: string;
}

interface TreatmentPhasesCardProps {
  phases: TreatmentPhase[];
}

export default function TreatmentPhasesCard({ phases }: TreatmentPhasesCardProps) {
  const total = phases.reduce((acc, phase) => acc + phase.value, 0);

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">Patients’ treatment phases</h3>
          <p className="text-xs text-muted">You are a Couch to 44 active patients.</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted">
          {phases.map((phase) => (
            <div key={phase.label} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${phase.color}`} />
              {phase.label}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {phases.map((phase) => (
          <div key={phase.label}>
            <div className="mb-2 flex items-center justify-between text-xs text-muted">
              <span>{phase.value} patients</span>
            </div>
            <div className="h-3 w-full rounded-full bg-line">
              <div
                className={`h-full rounded-full ${phase.color}`}
                style={{ width: `${(phase.value / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
