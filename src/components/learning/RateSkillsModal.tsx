import React, { useState } from 'react';
import { errorMessage } from '../../api/client';
import { addSkillRatings } from '../../api/learning';
import { RatingKind, SkillProgress } from '../../api/types';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal, ModalBody, ModalFooter } from '../ui/Modal';
import { ScorePicker } from './LearningParts';

interface RateSkillsModalProps {
  enrollmentId: string;
  kind: RatingKind;
  skills: SkillProgress[];
  onClose: () => void;
  onSaved: () => void;
}

export const RateSkillsModal: React.FC<RateSkillsModalProps> = ({
  enrollmentId,
  kind,
  skills,
  onClose,
  onSaved,
}) => {
  const toast = useToast();
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const chosen = skills.filter(({ skillId }) => scores[skillId]);

  const save = async () => {
    setIsSaving(true);
    try {
      await addSkillRatings(
        enrollmentId,
        kind,
        chosen.map(({ skillId }) => {
          const note = notes[skillId]?.trim();
          return { skillId, score: scores[skillId] as number, ...(note && { note }) };
        }),
      );
      toast.success('Ratings saved.');
      onSaved();
    } catch (error) {
      setIsSaving(false);
      toast.error(errorMessage(error));
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={kind === 'SELF' ? 'Rate myself' : 'Rate skills'}
      description="1 is just starting, 5 is confident without help. Rate as many as you like."
    >
      <ModalBody className="space-y-4">
        {skills.map(({ skillId, name }) => (
          <div key={skillId}>
            <p className="font-semibold mb-1">{name}</p>
            <ScorePicker
              label={name}
              value={scores[skillId] ?? null}
              onChange={(score) => setScores((all) => ({ ...all, [skillId]: score }))}
            />
            {scores[skillId] && (
              <div className="mt-2">
                <Input
                  label={`Note on ${name}`}
                  hideLabel
                  optional
                  placeholder="Add a note (optional)"
                  value={notes[skillId] ?? ''}
                  maxLength={2000}
                  onChange={(e) => setNotes((all) => ({ ...all, [skillId]: e.target.value }))}
                />
              </div>
            )}
          </div>
        ))}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={save} isLoading={isSaving} disabled={chosen.length === 0}>
          Save ratings
        </Button>
      </ModalFooter>
    </Modal>
  );
};
