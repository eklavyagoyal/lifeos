import type { CSSProperties } from 'react';

interface TodayOrbitSculptureProps {
  tone: string;
  completedTaskCount: number;
  habitsDone: number;
  habitsTotal: number;
  signalCount: number;
}

const ORBIT_NODES = [
  { className: 'today-orbit-node-brass', angle: '-18deg', distance: '40%' },
  { className: 'today-orbit-node-moss', angle: '112deg', distance: '34%' },
  { className: 'today-orbit-node-sky', angle: '228deg', distance: '38%' },
  { className: 'today-orbit-node-clay', angle: '296deg', distance: '28%' },
] as const;

export function TodayOrbitSculpture({
  tone,
  completedTaskCount,
  habitsDone,
  habitsTotal,
  signalCount,
}: TodayOrbitSculptureProps) {
  const anchorCount = completedTaskCount + habitsDone + signalCount;
  const rhythmLabel = habitsTotal > 0 ? `${habitsDone}/${habitsTotal} rituals` : 'rituals open';

  return (
    <div className="today-orbit-stage" aria-hidden="true">
      <div className="today-orbit-sculpture">
        <div className="today-orbit-halo today-orbit-halo-brass" />
        <div className="today-orbit-halo today-orbit-halo-moss" />
        <div className="today-orbit-ring today-orbit-ring-outer" />
        <div className="today-orbit-ring today-orbit-ring-middle" />
        <div className="today-orbit-ring today-orbit-ring-inner" />

        {ORBIT_NODES.map((node) => (
          <span
            key={`${node.className}-${node.angle}`}
            className={`today-orbit-node ${node.className}`}
            style={
              {
                '--orbit-angle': node.angle,
                '--orbit-distance': node.distance,
              } as CSSProperties
            }
          />
        ))}

        <div className="today-orbit-core">
          <div className="today-orbit-core-kicker">Current tone</div>
          <div className="today-orbit-core-title">{tone}</div>
          <div className="today-orbit-core-meta">
            <span>{anchorCount} anchors active</span>
            <span>{rhythmLabel}</span>
            <span>{signalCount}/3 signals</span>
          </div>
        </div>
      </div>
    </div>
  );
}
