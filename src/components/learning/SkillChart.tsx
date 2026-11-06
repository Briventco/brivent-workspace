import React, { useMemo, useState } from 'react';
import { RatingKind, SkillProgress, SkillRating } from '../../api/types';
import { formatDateTime, formatDayMonth } from '../../lib/wat';

const WIDTH = 320;
const HEIGHT = 150;
const PAD = { top: 12, right: 14, bottom: 22, left: 22 };
/** Keeps the first and last markers clear of the score labels and the edge. */
const INSET = 10;
const SCORES = [1, 2, 3, 4, 5];
const KIND_LABEL: Record<RatingKind, string> = { MENTOR: 'Mentor', SELF: 'Self' };

const yOf = (score: number) =>
  PAD.top + ((5 - score) / 4) * (HEIGHT - PAD.top - PAD.bottom);

interface Point {
  rating: SkillRating;
  x: number;
  y: number;
}

const SkillPlot: React.FC<{ name: string; ratings: SkillRating[] }> = ({ name, ratings }) => {
  const [hovered, setHovered] = useState<Point | null>(null);

  const times = ratings.map(({ createdAt }) => Date.parse(createdAt));
  const first = Math.min(...times);
  const last = Math.max(...times);
  const xOf = (time: number) =>
    last === first
      ? WIDTH / 2
      : PAD.left +
        INSET +
        ((time - first) / (last - first)) * (WIDTH - PAD.left - PAD.right - INSET * 2);

  const firstDay = formatDayMonth(new Date(first), false);
  const lastDay = formatDayMonth(new Date(last), false);

  const seriesOf = (kind: RatingKind): Point[] =>
    ratings
      .filter((rating) => rating.kind === kind)
      .map((rating) => ({
        rating,
        x: xOf(Date.parse(rating.createdAt)),
        y: yOf(rating.score),
      }));

  const series = (['MENTOR', 'SELF'] as const).map((kind) => ({ kind, points: seriesOf(kind) }));

  return (
    <figure className="relative min-w-0">
      <figcaption className="font-semibold mb-1 truncate">{name}</figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="skill-chart w-full h-auto"
        role="img"
        aria-label={`${name}: ${ratings.length} ratings over time, mentor and self. The table below has the values.`}
        onMouseLeave={() => setHovered(null)}
      >
        {SCORES.map((score) => (
          <g key={score}>
            <line className="grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={yOf(score)} y2={yOf(score)} />
            <text x={PAD.left - 8} y={yOf(score) + 4} textAnchor="end">
              {score}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={HEIGHT - 6}>
          {firstDay}
        </text>
        {lastDay !== firstDay && (
          <text x={WIDTH - PAD.right} y={HEIGHT - 6} textAnchor="end">
            {lastDay}
          </text>
        )}

        {series.map(({ kind, points }) => {
          const className = kind === 'MENTOR' ? 'is-mentor' : 'is-self';
          return (
            <g key={kind} className={className}>
              {points.length > 1 && (
                <polyline
                  points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
                  fill="none"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {points.map((point) =>
                kind === 'MENTOR' ? (
                  <circle key={point.rating.id} cx={point.x} cy={point.y} r="4" stroke="none" />
                ) : (
                  <rect
                    key={point.rating.id}
                    x={point.x - 3.5}
                    y={point.y - 3.5}
                    width="7"
                    height="7"
                    rx="1"
                    stroke="none"
                  />
                ),
              )}
              {points.map((point) => (
                <circle
                  key={`hit-${point.rating.id}`}
                  cx={point.x}
                  cy={point.y}
                  r="14"
                  fill="transparent"
                  stroke="none"
                  onMouseEnter={() => setHovered(point)}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div
          role="status"
          className="popover absolute z-10 p-2 text-small pointer-events-none max-w-[14rem]"
          style={{
            left: `min(${(hovered.x / WIDTH) * 100}%, calc(100% - 14rem))`,
            top: 24,
          }}
        >
          <p className="font-semibold">
            {KIND_LABEL[hovered.rating.kind]}: {hovered.rating.score} of 5
          </p>
          <p className="text-text-2">{formatDateTime(new Date(hovered.rating.createdAt))}</p>
          {hovered.rating.note && <p className="break-words">{hovered.rating.note}</p>}
        </div>
      )}
    </figure>
  );
};

interface SkillChartsProps {
  skills: SkillProgress[];
  ratings: SkillRating[];
}

/** One small chart per skill, so eight skills' lines never tangle on one plot. */
export const SkillCharts: React.FC<SkillChartsProps> = ({ skills, ratings }) => {
  const rated = useMemo(
    () =>
      skills
        .map(({ skillId, name }) => ({
          skillId,
          name,
          ratings: ratings.filter((rating) => rating.skillId === skillId),
        }))
        .filter((skill) => skill.ratings.length > 0),
    [skills, ratings],
  );

  if (rated.length === 0) {
    return <p className="text-text-2">No ratings yet. They'll chart here over time.</p>;
  }

  return (
    <>
      <p className="flex items-center gap-4 text-small text-text-2 mb-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="chart-key" /> Mentor
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="chart-key is-self" /> Self
        </span>
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        {rated.map(({ skillId, name, ratings: own }) => (
          <SkillPlot key={skillId} name={name} ratings={own} />
        ))}
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-small font-semibold">View as a table</summary>
        <div className="table-wrap mt-2">
          <table className="table">
            <caption className="sr-only">Every skill rating</caption>
            <thead>
              <tr>
                <th scope="col">Skill</th>
                <th scope="col">From</th>
                <th scope="col">Score</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              {rated.flatMap(({ skillId, name, ratings: own }) =>
                own.map((rating) => (
                  <tr key={`${skillId}-${rating.id}`}>
                    <td>{name}</td>
                    <td>{KIND_LABEL[rating.kind]}</td>
                    <td>{rating.score}</td>
                    <td className="whitespace-nowrap">{formatDateTime(new Date(rating.createdAt))}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
};
