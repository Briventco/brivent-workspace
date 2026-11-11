import React, { useEffect, useState } from 'react';
import { ApiError, errorMessage } from '../api/client';
import {
  addItem,
  addModule,
  addSkill,
  getTrack,
  ItemFields,
  listCourses,
  renameModule,
  renameSkill,
  reorderTrack,
  updateItem,
  updateTrack,
} from '../api/learning';
import {
  MAX_TRACK_SKILLS,
  MIN_TRACK_SKILLS,
  Track,
  TrackItem,
  TrackItemType,
  TrackModule,
  TrackStatus,
  SubmissionMode,
} from '../api/types';
import { MODES, useProjectOptions } from '../components/learning/programs/ProgramForms';
import { EnrollDialog } from '../components/learning/EnrollDialog';
import { ErrorState, LoadingState, NoAccess } from '../components/ui/AsyncState';
import { Banner } from '../components/ui/Banner';
import { Button, IconButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Checkbox } from '../components/ui/Checkbox';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { SidePanel } from '../components/ui/SidePanel';
import { Textarea } from '../components/ui/Textarea';
import { PlacementFields, PlacementValue } from '../components/users/PlacementFields';
import { useSession } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ITEM_TYPE_ICONS, ITEM_TYPE_LABELS, moveModule, nudgeItem, OrderedModule, orderOf, placeItem } from '../lib/learning';
import { Link } from '../lib/router';
import { useDetailTitle } from '../lib/pageTitle';
import { useApiQuery } from '../lib/useApiQuery';

const STATUS_LABEL: Record<TrackStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

const TYPE_OPTIONS = [
  { value: 'RESOURCE', label: 'Resource: read or watch, then mark as done' },
  { value: 'ASSIGNMENT', label: 'Assignment: submit work for review' },
  { value: 'COURSE', label: 'Course: one from the course library' },
  { value: 'BUILD', label: 'Build: a project, reviewed with code and live links' },
];

const isHttps = (url: string) => {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
};

const DetailsCard: React.FC<{
  track: Track;
  canEdit: boolean;
  onSaved: (track: Track) => void;
}> = ({ track, canEdit, onSaved }) => {
  const toast = useToast();
  const [title, setTitle] = useState(track.title);
  const [description, setDescription] = useState(track.description);
  const [placement, setPlacement] = useState<PlacementValue>({
    departmentId: track.department?.id ?? '',
    positionId: track.position?.id ?? '',
  });
  const [lockBuild, setLockBuild] = useState(track.lockBuildUntilLearningDone);
  const [titleError, setTitleError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const hasBuild = track.modules.some(({ items }) => items.some(({ type }) => type === 'BUILD'));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError('Give the track a title.');
      return;
    }
    setTitleError(undefined);
    setIsSaving(true);
    try {
      onSaved(
        await updateTrack(track.id, {
          title: title.trim(),
          description: description.trim(),
          departmentId: placement.departmentId || null,
          positionId: placement.positionId || null,
          lockBuildUntilLearningDone: lockBuild,
        }),
      );
      toast.success('Track saved.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="card-pad">
      <form onSubmit={save} noValidate className="space-y-4">
        <h2 className="t-h3">Details</h2>
        <fieldset disabled={!canEdit} className="space-y-4 border-0 p-0 m-0">
          <Input
            label="Title"
            value={title}
            error={titleError}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            label="Description"
            optional
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <PlacementFields value={placement} onChange={setPlacement} user={track} />
          {hasBuild && (
            <Checkbox
              label="Lock builds until the learning before them is done"
              checked={lockBuild}
              onChange={(e) => setLockBuild(e.target.checked)}
            />
          )}
        </fieldset>
        {canEdit && (
          <Button type="submit" variant="secondary" isLoading={isSaving}>
            Save details
          </Button>
        )}
      </form>
    </Card>
  );
};

const AddField: React.FC<{
  label: string;
  buttonLabel: string;
  onAdd: (name: string) => Promise<void>;
}> = ({ label, buttonLabel, onAdd }) => {
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await onAdd(name.trim());
      setName('');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex items-end gap-2">
      <div className="grow min-w-0">
        <Input label={label} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </div>
      <Button type="submit" variant="secondary" icon="add" isLoading={isSaving}>
        {buttonLabel}
      </Button>
    </form>
  );
};

const RenamableText: React.FC<{
  value: string;
  label: string;
  canEdit: boolean;
  onSave: (next: string) => Promise<void>;
  className?: string;
}> = ({ value, label, canEdit, onSave, className = '' }) => {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <span className={`inline-flex items-center gap-1 min-w-0 ${className}`}>
        <span className="truncate">{value}</span>
        {canEdit && (
          <IconButton icon="edit" size="sm" label={`Rename ${value}`} onClick={() => setDraft(value)} />
        )}
      </span>
    );
  }

  const commit = async () => {
    const next = draft.trim();
    if (next && next !== value) await onSave(next);
    setDraft(null);
  };

  return (
    <Input
      label={label}
      hideLabel
      value={draft}
      autoFocus
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          e.stopPropagation();
          setDraft(null);
        }
      }}
    />
  );
};

interface ItemPanelState {
  moduleId: string;
  item: TrackItem | null;
}

const ItemFormPanel: React.FC<{
  track: Track;
  state: ItemPanelState;
  onClose: () => void;
  onSaved: () => void;
}> = ({ track, state, onClose, onSaved }) => {
  const toast = useToast();
  const { item } = state;
  const [type, setType] = useState<TrackItemType>(item?.type ?? 'RESOURCE');
  const [title, setTitle] = useState(item?.title ?? '');
  const [instructions, setInstructions] = useState(item?.instructions ?? '');
  const [resourceUrl, setResourceUrl] = useState(item?.resourceUrl ?? '');
  const [minutes, setMinutes] = useState(item?.estimatedMinutes?.toString() ?? '');
  const [dueDay, setDueDay] = useState(item?.dueDay?.toString() ?? '');
  const [skillIds, setSkillIds] = useState(item?.skillIds ?? []);
  const [courseId, setCourseId] = useState(item?.courseId ?? '');
  const [projectId, setProjectId] = useState(item?.projectId ?? '');
  const [brief, setBrief] = useState(item?.brief ?? '');
  const [deliverables, setDeliverables] = useState(item?.deliverables ?? '');
  const [mode, setMode] = useState<SubmissionMode>(item?.submissionMode ?? 'INDIVIDUAL');
  const [errors, setErrors] = useState<{ title?: string; url?: string; course?: string }>({});
  const isCourse = type === 'COURSE';
  const isBuild = type === 'BUILD';
  const courses = useApiQuery((signal) => listCourses({}, signal), [], 'courses:all');
  const projectOptions = useProjectOptions();
  const courseOptions = [
    { value: '', label: 'Choose a course' },
    ...(courses.data ?? []).map(({ id, title }) => ({ value: id, label: title })),
  ];
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = resourceUrl.trim();
    const course = courses.data?.find(({ id }) => id === courseId);
    const problems = {
      // A course item takes the course's title unless it's given another.
      title: title.trim() || (isCourse && course) ? undefined : 'Give it a title.',
      url: url && !isHttps(url) ? 'Use a full https link.' : undefined,
      course: isCourse && !courseId ? 'Choose a course.' : undefined,
    };
    setErrors(problems);
    if (problems.title || problems.url || problems.course) return;

    const fields: ItemFields = {
      title: title.trim() || course!.title,
      instructions: instructions.trim(),
      resourceUrl: url || null,
      estimatedMinutes: minutes ? Number(minutes) : null,
      dueDay: dueDay ? Number(dueDay) : null,
      skillIds,
      ...(isCourse && { courseId }),
      ...(isBuild && {
        projectId: projectId || null,
        brief: brief.trim(),
        deliverables: deliverables.trim(),
        submissionMode: mode,
      }),
    };
    setIsSaving(true);
    try {
      if (item) await updateItem(item.id, fields);
      else await addItem(state.moduleId, { ...fields, type });
      onSaved();
    } catch (error) {
      setIsSaving(false);
      toast.error(errorMessage(error));
    }
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={item ? 'Edit item' : 'New item'}
      footer={
        <Button type="submit" form="track-item-form" isLoading={isSaving}>
          {item ? 'Save item' : 'Add item'}
        </Button>
      }
    >
      <form id="track-item-form" onSubmit={submit} noValidate className="space-y-4">
        {!item && (
          <Select
            label="Type"
            value={type}
            options={TYPE_OPTIONS}
            onChange={(e) => setType(e.target.value as TrackItemType)}
          />
        )}
        {isCourse && (
          <Select
            label="Course"
            value={courseId}
            options={courseOptions}
            error={errors.course}
            helperText="Learners finish it once and it counts on every track that has it."
            onChange={(e) => setCourseId(e.target.value)}
          />
        )}
        <Input
          label="Title"
          optional={isCourse}
          helperText={isCourse ? "Leave it empty to use the course's title." : undefined}
          value={title}
          error={errors.title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {isBuild && (
          <>
            <Textarea label="What to build" optional rows={4} value={brief} onChange={(e) => setBrief(e.target.value)} />
            <Textarea
              label="Deliverables"
              optional
              rows={3}
              value={deliverables}
              onChange={(e) => setDeliverables(e.target.value)}
            />
            <Select label="Project" optional value={projectId} options={projectOptions} onChange={(e) => setProjectId(e.target.value)} />
            <Select label="Builds" value={mode} options={MODES} onChange={(e) => setMode(e.target.value as SubmissionMode)} />
          </>
        )}
        <Textarea
          label="Instructions"
          optional
          rows={4}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
        <Input
          label="Link"
          optional
          type="url"
          placeholder="https://"
          value={resourceUrl}
          error={errors.url}
          onChange={(e) => setResourceUrl(e.target.value)}
        />
        <div className="grid gap-4 grid-cols-2">
          <Input
            label="Due day"
            optional
            type="number"
            min={0}
            helperText="Days after the start date."
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
          />
          <Input
            label="Minutes"
            optional
            type="number"
            min={1}
            helperText="Rough estimate."
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
        {track.skills.length > 0 && (
          <fieldset className="border-0 p-0 m-0 space-y-2">
            <legend className="label">Skills it builds</legend>
            {track.skills.map(({ id, name }) => (
              <Checkbox
                key={id}
                label={name}
                checked={skillIds.includes(id)}
                onChange={(e) =>
                  setSkillIds((ids) =>
                    e.target.checked ? [...ids, id] : ids.filter((other) => other !== id),
                  )
                }
              />
            ))}
          </fieldset>
        )}
      </form>
    </SidePanel>
  );
};

interface ModuleCardProps {
  module: TrackModule;
  canEdit: boolean;
  position: { isFirst: boolean; isLast: boolean };
  dragging: string | null;
  onDragChange: (itemId: string | null) => void;
  onDrop: (moduleId: string, beforeId: string | null) => void;
  onNudge: (itemId: string, step: -1 | 1) => void;
  onMoveModule: (step: -1 | 1) => void;
  onRename: (title: string) => Promise<void>;
  onAddItem: () => void;
  onEditItem: (item: TrackItem) => void;
  onArchiveItem: (item: TrackItem) => void;
}

const ModuleCard: React.FC<ModuleCardProps> = ({
  module,
  canEdit,
  position,
  dragging,
  onDragChange,
  onDrop,
  onNudge,
  onMoveModule,
  onRename,
  onAddItem,
  onEditItem,
  onArchiveItem,
}) => {
  const [targetId, setTargetId] = useState<string | null>(null);

  const dropTarget = (beforeId: string | null, key: string) =>
    canEdit && dragging
      ? {
          onDragOver: (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setTargetId(key);
          },
          onDragLeave: () => setTargetId(null),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setTargetId(null);
            onDrop(module.id, beforeId);
          },
        }
      : {};

  return (
    <Card>
      <div className="flex items-center gap-1 px-5 pt-3 pb-2">
        <RenamableText
          value={module.title}
          label="Module title"
          canEdit={canEdit}
          onSave={onRename}
          className="t-h3 grow"
        />
        {canEdit && (
          <>
            <IconButton
              icon="keyboard_arrow_up"
              size="sm"
              label={`Move ${module.title} up`}
              disabled={position.isFirst}
              onClick={() => onMoveModule(-1)}
            />
            <IconButton
              icon="keyboard_arrow_down"
              size="sm"
              label={`Move ${module.title} down`}
              disabled={position.isLast}
              onClick={() => onMoveModule(1)}
            />
          </>
        )}
      </div>

      <ul className="border-t border-border divide-y divide-border">
        {module.items.map((item) => (
          <li
            key={item.id}
            draggable={canEdit}
            onDragStart={() => onDragChange(item.id)}
            onDragEnd={() => onDragChange(null)}
            {...dropTarget(item.id, item.id)}
            className={`track-item flex flex-wrap md:flex-nowrap items-center gap-x-2 px-4 py-2 ${
              dragging === item.id ? 'is-dragging' : ''
            } ${targetId === item.id ? 'is-target' : ''} ${canEdit ? 'cursor-grab' : ''}`}
          >
            <Icon
              name={ITEM_TYPE_ICONS[item.type]}
              size="sm"
              className="text-text-2"
            />
            {/* A full line on phones, where the buttons would otherwise leave it a few letters. */}
            <span className="min-w-0 grow basis-[calc(100%-2rem)] md:basis-0">
              <span className={`block md:truncate ${item.isArchived ? 'text-text-3 line-through' : ''}`}>
                {item.title}
              </span>
              <span className="block text-small text-text-2">
                {ITEM_TYPE_LABELS[item.type]}
                {item.dueDay !== null && ` · Day ${item.dueDay}`}
                {item.isArchived && ' · Archived'}
              </span>
            </span>
            {canEdit && (
              <span className="flex items-center gap-1 ml-auto max-md:mt-1">
                <IconButton
                  icon="keyboard_arrow_up"
                  size="sm"
                  label={`Move ${item.title} up`}
                  onClick={() => onNudge(item.id, -1)}
                />
                <IconButton
                  icon="keyboard_arrow_down"
                  size="sm"
                  label={`Move ${item.title} down`}
                  onClick={() => onNudge(item.id, 1)}
                />
                <IconButton
                  icon="edit"
                  size="sm"
                  label={`Edit ${item.title}`}
                  onClick={() => onEditItem(item)}
                />
                <IconButton
                  icon={item.isArchived ? 'refresh' : 'cancel'}
                  size="sm"
                  label={`${item.isArchived ? 'Restore' : 'Archive'} ${item.title}`}
                  onClick={() => onArchiveItem(item)}
                />
              </span>
            )}
          </li>
        ))}
        {module.items.length === 0 && (
          <li {...dropTarget(null, 'end')} className="px-5 py-3 text-text-2">
            No items yet.
          </li>
        )}
      </ul>

      {canEdit && (
        <div {...dropTarget(null, 'end')} className="px-4 py-2 border-t border-border">
          <Button variant="ghost" size="sm" icon="add" onClick={onAddItem}>
            Add item
          </Button>
        </div>
      )}
    </Card>
  );
};

export const TrackBuilderView: React.FC<{ trackId: string }> = ({ trackId }) => {
  const { user, can } = useSession();
  const toast = useToast();
  const query = useApiQuery((signal) => getTrack(trackId, signal), [trackId]);
  const [track, setTrack] = useState<Track>();
  const [itemPanel, setItemPanel] = useState<ItemPanelState | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [statusError, setStatusError] = useState<string>();
  useDetailTitle(track?.title);

  useEffect(() => {
    if (query.data) setTrack(query.data);
  }, [query.data]);

  if (query.error instanceof ApiError && query.error.status === 404) {
    return (
      <NoAccess
        title="This track isn't available"
        description="It may have been removed, or you don't have access to it."
        backTo="/learning?tab=tracks"
        backLabel="Back to tracks"
      />
    );
  }
  if (query.error) {
    return (
      <ErrorState
        title="Couldn't load this track"
        message={errorMessage(query.error)}
        onRetry={query.reload}
      />
    );
  }
  if (!track) return <LoadingState label="Loading the track…" />;

  const canEdit = can('manageAllLearning') || track.createdBy.id === user.id;
  const canEnroll = canEdit && track.status === 'PUBLISHED';
  const skillCount = track.skills.length;
  const canPublish = skillCount >= MIN_TRACK_SKILLS && skillCount <= MAX_TRACK_SKILLS;

  const attempt = async (work: () => Promise<unknown>) => {
    try {
      await work();
      query.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const applyOrder = async (order: OrderedModule[]) => {
    try {
      setTrack(await reorderTrack(track.id, order));
    } catch (error) {
      toast.error(errorMessage(error));
      query.reload();
    }
  };

  const changeStatus = async (status: TrackStatus) => {
    setIsChangingStatus(true);
    setStatusError(undefined);
    try {
      setTrack(await updateTrack(track.id, { status }));
    } catch (error) {
      setStatusError(errorMessage(error));
    } finally {
      setIsChangingStatus(false);
      setConfirmingArchive(false);
    }
  };

  return (
    <>
      <Link
        to="/learning?tab=tracks"
        className="inline-flex items-center gap-1 text-small font-semibold mb-3"
      >
        <Icon name="arrow_back" size="sm" />
        Tracks
      </Link>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="min-w-0 grow basis-52">
          <h1 className="t-h1 truncate">{track.title}</h1>
          <p className="text-text-2">
            {STATUS_LABEL[track.status]} · Created by {track.createdBy.name}
          </p>
        </div>
        {canEnroll && (
          <Button variant="secondary" onClick={() => setIsEnrolling(true)}>
            Enroll learners
          </Button>
        )}
        {canEdit && track.status === 'PUBLISHED' && (
          <>
            <Button
              variant="secondary"
              onClick={() => changeStatus('DRAFT')}
              isLoading={isChangingStatus}
            >
              Back to draft
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingArchive(true)}>
              Archive
            </Button>
          </>
        )}
        {canEdit && track.status !== 'PUBLISHED' && (
          <Button
            onClick={() => changeStatus('PUBLISHED')}
            isLoading={isChangingStatus}
            disabled={!canPublish}
            title={canPublish ? undefined : `A track needs ${MIN_TRACK_SKILLS} to ${MAX_TRACK_SKILLS} skills.`}
          >
            Publish
          </Button>
        )}
      </div>

      {statusError && (
        <div className="mb-4">
          <Banner>{statusError}</Banner>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)] items-start">
        <div className="space-y-5 min-w-0">
          <DetailsCard key={track.id} track={track} canEdit={canEdit} onSaved={setTrack} />

          <Card className="card-pad">
            <h2 className="t-h3">Skills</h2>
            <p className="text-small text-text-2 mb-3">
              {skillCount} of {MAX_TRACK_SKILLS}. A track needs at least {MIN_TRACK_SKILLS} to publish.
            </p>
            {skillCount > 0 && (
              <ul className="space-y-1 mb-3">
                {track.skills.map((skill) => (
                  <li key={skill.id}>
                    <RenamableText
                      value={skill.name}
                      label="Skill name"
                      canEdit={canEdit}
                      onSave={(name) => attempt(() => renameSkill(skill.id, name))}
                    />
                  </li>
                ))}
              </ul>
            )}
            {canEdit && skillCount < MAX_TRACK_SKILLS && (
              <AddField
                label="New skill"
                buttonLabel="Add"
                onAdd={(name) => attempt(() => addSkill(track.id, name))}
              />
            )}
          </Card>
        </div>

        <div className="space-y-5 min-w-0">
          {track.modules.length === 0 && (
            <EmptyState
              icon="folder_open"
              title="No modules yet"
              description={canEdit ? 'Add a module, like Week 1, then fill it with items.' : 'Nothing here yet.'}
            />
          )}
          {track.modules.map((module, index) => (
            <ModuleCard
              key={module.id}
              module={module}
              canEdit={canEdit}
              position={{ isFirst: index === 0, isLast: index === track.modules.length - 1 }}
              dragging={dragging}
              onDragChange={setDragging}
              onDrop={(moduleId, beforeId) => {
                if (dragging && dragging !== beforeId) {
                  applyOrder(placeItem(orderOf(track), dragging, moduleId, beforeId));
                }
                setDragging(null);
              }}
              onNudge={(itemId, step) => applyOrder(nudgeItem(orderOf(track), itemId, step))}
              onMoveModule={(step) => applyOrder(moveModule(orderOf(track), module.id, step))}
              onRename={(title) => attempt(() => renameModule(module.id, title))}
              onAddItem={() => setItemPanel({ moduleId: module.id, item: null })}
              onEditItem={(item) => setItemPanel({ moduleId: module.id, item })}
              onArchiveItem={(item) =>
                attempt(() => updateItem(item.id, { isArchived: !item.isArchived }))
              }
            />
          ))}
          {canEdit && (
            <Card className="card-pad">
              <AddField
                label="New module"
                buttonLabel="Add module"
                onAdd={(title) => attempt(() => addModule(track.id, title))}
              />
            </Card>
          )}
        </div>
      </div>

      {itemPanel && (
        <ItemFormPanel
          track={track}
          state={itemPanel}
          onClose={() => setItemPanel(null)}
          onSaved={() => {
            setItemPanel(null);
            query.reload();
          }}
        />
      )}

      {isEnrolling && (
        <EnrollDialog
          trackId={track.id}
          onClose={() => setIsEnrolling(false)}
          onEnrolled={() => setIsEnrolling(false)}
        />
      )}

      <ConfirmDialog
        isOpen={confirmingArchive}
        title="Archive this track?"
        description="Nobody new can be enrolled. People already on it keep going."
        confirmLabel="Archive"
        confirmVariant="danger"
        isLoading={isChangingStatus}
        onConfirm={() => changeStatus('ARCHIVED')}
        onClose={() => setConfirmingArchive(false)}
      />
    </>
  );
};
