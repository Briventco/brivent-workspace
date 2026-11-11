import React, { useState } from 'react';
import { ApiError, errorMessage } from '../../../api/client';
import { createCourse, CourseFields, updateCourse } from '../../../api/learning';
import { Course, CourseFormat, CourseLevel, ProofType } from '../../../api/types';
import { useToast } from '../../../context/ToastContext';
import { isHttps, LEVEL_LABELS, PROOF_LABELS, youtubeId } from '../../../lib/courses';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Input } from '../../ui/Input';
import { Modal, ModalBody, ModalFooter } from '../../ui/Modal';
import { Select } from '../../ui/Select';
import { Textarea } from '../../ui/Textarea';

const FORMATS = [
  { value: 'EXTERNAL', label: 'External: learned elsewhere, then proven' },
  { value: 'YOUTUBE', label: 'YouTube: watched here, done as it plays' },
];
const LEVELS = (Object.keys(LEVEL_LABELS) as CourseLevel[]).map((value) => ({ value, label: LEVEL_LABELS[value] }));
const PROOFS = (Object.keys(PROOF_LABELS) as ProofType[]).map((value) => ({ value, label: PROOF_LABELS[value] }));

interface CourseFormModalProps {
  /** Left out when adding. */
  course?: Course;
  onClose: () => void;
  onSaved: (course: Course) => void;
}

export const CourseFormModal: React.FC<CourseFormModalProps> = ({ course, onClose, onSaved }) => {
  const toast = useToast();
  const [format, setFormat] = useState<CourseFormat>(course?.format ?? 'EXTERNAL');
  const [title, setTitle] = useState(course?.title ?? '');
  const [provider, setProvider] = useState(course?.provider ?? '');
  const [url, setUrl] = useState(course?.url ?? '');
  const [description, setDescription] = useState(course?.description ?? '');
  const [topics, setTopics] = useState(course?.topics.join(', ') ?? '');
  const [level, setLevel] = useState<CourseLevel>(course?.level ?? 'BEGINNER');
  const [hours, setHours] = useState(course?.estimatedHours?.toString() ?? '');
  const [isFree, setIsFree] = useState(course?.isFree ?? true);
  const [proofType, setProofType] = useState<ProofType>(course?.proofType ?? 'LINK_OR_SCREENSHOT');
  const [videos, setVideos] = useState(
    course?.youtubeVideoIds.map((id) => `https://www.youtube.com/watch?v=${id}`).join('\n') ?? '',
  );
  const [playlist, setPlaylist] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isYouTube = format === 'YOUTUBE';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const links = videos.split('\n').map((line) => line.trim()).filter(Boolean);
    const problems: Record<string, string> = {};
    if (!title.trim()) problems.title = 'Give the course a title.';
    if (!provider.trim()) problems.provider = 'Say who runs it, such as freeCodeCamp or YouTube.';
    if (!isYouTube && !isHttps(url.trim())) problems.url = 'Use a full https link to the course.';
    if (isYouTube) {
      const bad = links.filter((link) => !youtubeId(link));
      if (bad.length) problems.videos = `These aren't YouTube video links: ${bad.join(', ')}`;
      if (!links.length && !playlist.trim()) problems.videos = 'Add at least one video link, or a playlist.';
    }
    setErrors(problems);
    setFailure(null);
    if (Object.keys(problems).length) return;

    // A YouTube course still needs a course link: its playlist, or its first video.
    const courseUrl = isYouTube ? (url.trim() || playlist.trim() || links[0]) : url.trim();
    const fields: CourseFields = {
      title: title.trim(),
      provider: provider.trim(),
      url: courseUrl,
      description: description.trim(),
      topics: topics.split(',').map((topic) => topic.trim().toLowerCase()).filter(Boolean),
      level,
      estimatedHours: hours ? Number(hours) : null,
      isFree,
      ...(isYouTube
        ? { youtubeUrls: links, ...(playlist.trim() && { youtubePlaylistUrl: playlist.trim() }) }
        : { proofType }),
    };

    setIsSaving(true);
    try {
      onSaved(course ? await updateCourse(course.id, fields) : await createCourse({ ...fields, format }));
      toast.success(course ? 'Course saved.' : 'Course added to the library.');
    } catch (error) {
      setIsSaving(false);
      if (error instanceof ApiError && (error.code === 'INVALID_YOUTUBE_LINK' || error.code === 'VIDEOS_REQUIRED')) {
        setErrors({ videos: error.message });
      } else {
        // Includes YOUTUBE_PLAYLISTS_UNAVAILABLE, whose message says to add the videos one by one.
        setFailure(errorMessage(error));
      }
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={course ? 'Edit course' : 'Add a course'}>
      <form onSubmit={submit} noValidate className="contents">
        <ModalBody className="space-y-4">
          {failure && <Banner>{failure}</Banner>}
          {!course && (
            <Select
              label="Kind of course"
              value={format}
              options={FORMATS}
              onChange={(e) => setFormat(e.target.value as CourseFormat)}
            />
          )}
          <Input label="Title" value={title} error={errors.title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            label="Provider"
            value={provider}
            error={errors.provider}
            placeholder={isYouTube ? 'YouTube channel' : 'freeCodeCamp, Vercel, Google…'}
            onChange={(e) => setProvider(e.target.value)}
          />
          {isYouTube ? (
            <>
              <Textarea
                label="Video links"
                rows={4}
                value={videos}
                error={errors.videos}
                helperText="One per line, in the order to watch them."
                onChange={(e) => setVideos(e.target.value)}
              />
              <Input
                label="Playlist link"
                optional
                type="url"
                value={playlist}
                helperText="Only works if the server has a YouTube key. Otherwise add the videos above."
                onChange={(e) => setPlaylist(e.target.value)}
              />
            </>
          ) : (
            <>
              <Input
                label="Course link"
                type="url"
                placeholder="https://"
                value={url}
                error={errors.url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Select
                label="Proof of finishing"
                value={proofType}
                options={PROOFS}
                onChange={(e) => setProofType(e.target.value as ProofType)}
              />
            </>
          )}
          <Textarea
            label="Description"
            optional
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            label="Topics"
            optional
            value={topics}
            helperText="Separated by commas, such as react, nextjs."
            onChange={(e) => setTopics(e.target.value)}
          />
          <div className="grid gap-4 grid-cols-2">
            <Select label="Level" value={level} options={LEVELS} onChange={(e) => setLevel(e.target.value as CourseLevel)} />
            <Input
              label="Hours"
              optional
              type="number"
              min={0}
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <Checkbox label="Free to take" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {course ? 'Save course' : 'Add course'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};
