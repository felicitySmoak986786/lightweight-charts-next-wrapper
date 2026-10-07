'use client';

import type { IndicatorDefinition, IndicatorInstance } from '@/lib/chart';

export interface IndicatorPanelProps {
  open: boolean;
  onClose: () => void;
  definitions: IndicatorDefinition[];
  instances: IndicatorInstance[];
  onAdd: (definitionId: string) => void;
  onRemove: (instanceId: string) => void;
  onLoadTsDemo: () => void;
  onCompileCsharp: () => void;
  status: string | null;
  busy: boolean;
}

export function IndicatorPanel({
  open,
  onClose,
  definitions,
  instances,
  onAdd,
  onRemove,
  onLoadTsDemo,
  onCompileCsharp,
  status,
  busy,
}: IndicatorPanelProps) {
  if (!open) return null;

  return (
    <div className="ao-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="ao-modal" onClick={(event) => event.stopPropagation()}>
        <div className="ao-modal-header">
          <h2>Indicators &amp; Studies</h2>
          <button type="button" className="ao-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="ao-modal-body">
          <h3>Available</h3>
          <div className="ao-chips">
            {definitions.map((definition) => (
              <button
                key={definition.id}
                type="button"
                className="ao-chip"
                title={definition.description}
                onClick={() => onAdd(definition.id)}
              >
                + {definition.name}
              </button>
            ))}
          </div>

          <h3>Active ({instances.length})</h3>
          <ul className="ao-list">
            {instances.length === 0 && <li className="ao-muted">No indicators applied</li>}
            {instances.map((instance) => (
              <li key={instance.instanceId}>
                <span>
                  {instance.name}
                  <span className="ao-muted"> {Object.values(instance.params).join(', ')}</span>
                  {!instance.overlay && <span className="ao-muted"> · pane {instance.paneIndex}</span>}
                </span>
                <button type="button" className="ao-link" onClick={() => onRemove(instance.instanceId)}>
                  remove
                </button>
              </li>
            ))}
          </ul>

          <h3>Custom modules</h3>
          <div className="ao-chips">
            <button type="button" className="ao-chip" onClick={onLoadTsDemo} disabled={busy}>
              Load TypeScript (Donchian)
            </button>
            <button type="button" className="ao-chip" onClick={onCompileCsharp} disabled={busy}>
              Compile C# sample
            </button>
          </div>

          {status && <p className="ao-status">{status}</p>}
        </div>
      </div>
    </div>
  );
}
