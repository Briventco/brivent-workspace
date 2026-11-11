import React, { useState } from 'react';
import { errorMessage } from '../../../api/client';
import { listCourses, listMyCourses, startCourse } from '../../../api/learning';
import { Course, CourseLevel, CourseProgress } from '../../../api/types';
import { useSession } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { LEVEL_LABELS } from '../../../lib/courses';
import { Link, navigate } from '../../../lib/router';
import { useApiQuery } from '../../../lib/useApiQuery';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import { AsyncState } from '../../ui/AsyncState';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { CourseFormModal } from './CourseFormModal';
import { CourseStatusBadge } from './CourseParts';

const LEVEL_FILTER = [
  { value: '', label: 'Any level' },
  ...(Object.keys(LEVEL_LABELS) as CourseLevel[]).map((value) => ({ value, label: LEVEL_LABELS[value] })),
];

const CourseCard: React.FC<{ course: Course; progress: CourseProgress | undefined; onStart: () => Promise<void> }> = ({
  course,
  progress,
  onStart,
}) => {
  const [isStarting, setIsStarting] = useState(false);
  return (
    <li className="card card-pad flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <Icon name={course.format === 'YOUTUBE' ? 'play_circle' : 'open_in_new'} className="text-brand shrink-0" />
        <Link to={`/learning/courses/${course.id}`} className="t-h3 text-text min-w-0 line-clamp-2">
          {course.title}
        </Link>
      </div>
      <p className="text-small text-text-2">
        {course.provider} · {LEVEL_LABELS[course.level]}
        {course.estimatedHours ? ` · ${course.estimatedHours} h` : ''}
        {course.isFree ? ' · Free' : ''}
      </p>
      {course.topics.length > 0 && (
        <p className="flex flex-wrap gap-1">
          {course.topics.slice(0, 4).map((topic) => (
            <span key={topic} className="chip pointer-events-none h-6 text-caption">
              {topic}
            </span>
          ))}
        </p>
      )}
      <div className="mt-auto pt-2 flex items-center gap-2">
        {progress ? (
          <>
            <CourseStatusBadge status={progress.status} />
            <Link to={`/learning/courses/${course.id}`} className="ml-auto font-semibold">
              Continue
            </Link>
          </>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            isLoading={isStarting}
            aria-label={`Start ${course.title}`}
            onClick={async () => {
              setIsStarting(true);
              await onStart().finally(() => setIsStarting(false));
            }}
          >
            Start
          </Button>
        )}
      </div>
    </li>
  );
};

/** Free courses anyone can start. Holders of learning.create add them, including YouTube ones. */
export const CourseLibrary: React.FC = () => {
  const { can } = useSession();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<CourseLevel | ''>('');
  const [isAdding, setIsAdding] = useState(false);
  const query = useDebouncedValue(search.trim());
  const topicQuery = useDebouncedValue(topic.trim().toLowerCase());
  const courses = useApiQuery(
    (signal) => listCourses({ search: query, topic: topicQuery, level }, signal),
    [query, topicQuery, level],
    `learning:courses:${query}:${topicQuery}:${level}`,
  );
  const mine = useApiQuery((signal) => listMyCourses(signal), [], 'learning:courses:mine');
  const isFiltered = Boolean(query || topicQuery || level);

  const start = async (course: Course) => {
    try {
      await startCourse(course.id);
      navigate(`/learning/courses/${course.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="grow basis-56 max-w-[20rem]">
          <Input label="Search courses" type="search" icon="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="basis-40">
          <Input label="Topic" value={topic} placeholder="react" onChange={(e) => setTopic(e.target.value)} />
        </div>
        <div className="basis-40">
          <Select label="Level" value={level} options={LEVEL_FILTER} onChange={(e) => setLevel(e.target.value as CourseLevel | '')} />
        </div>
        {can('createTrack') && (
          <Button icon="add" className="ml-auto" onClick={() => setIsAdding(true)}>
            Add a course
          </Button>
        )}
      </div>

      <AsyncState
        query={courses}
        loadingLabel="Loading courses…"
        errorTitle="Couldn't load the course library"
        isEmpty={(list) => list.length === 0}
        empty={
          isFiltered ? (
            <EmptyState icon="filter_list" title="No courses match" description="Try another search, topic or level.">
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setTopic('');
                  setLevel('');
                }}
              >
                Clear filters
              </Button>
            </EmptyState>
          ) : (
            <EmptyState icon="menu_book" title="No courses yet" description="Courses added to the library show up here." />
          )
        }
      >
        {(list) => (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Courses">
            {list.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                progress={mine.data?.find(({ course: started }) => started.id === course.id)}
                onStart={() => start(course)}
              />
            ))}
          </ul>
        )}
      </AsyncState>

      {isAdding && (
        <CourseFormModal
          onClose={() => setIsAdding(false)}
          onSaved={(course) => {
            setIsAdding(false);
            navigate(`/learning/courses/${course.id}`);
          }}
        />
      )}
    </>
  );
};

/** Under My learning: every course you've started, from a track or on your own. */
export const MyCourses: React.FC = () => {
  const mine = useApiQuery((signal) => listMyCourses(signal), [], 'learning:courses:mine');
  if (!mine.data?.length) return null;
  return (
    <section aria-label="My courses" className="mt-6">
      <h2 className="t-h3 mb-3">My courses</h2>
      <ul className="card divide-y divide-border">
        {mine.data.map((progress) => (
          <li key={progress.course.id}>
            <Link to={`/learning/courses/${progress.course.id}`} className="li text-text hover:no-underline">
              <Icon name={progress.course.format === 'YOUTUBE' ? 'play_circle' : 'open_in_new'} className="text-text-2" />
              <span className="min-w-0 grow">
                <span className="title block truncate">{progress.course.title}</span>
                <span className="block text-small text-text-2 truncate">{progress.course.provider}</span>
              </span>
              <CourseStatusBadge status={progress.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
