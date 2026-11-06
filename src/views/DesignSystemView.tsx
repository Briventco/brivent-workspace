import React, { useState } from 'react';
import { Avatar } from '../components/ui/Avatar';
import { PriorityBadge, RoleBadge, StatusBadge, UserStatusBadge } from '../components/ui/badges';
import { Banner } from '../components/ui/Banner';
import { Button, IconButton } from '../components/ui/Button';
import { Card, CardBody, CardHeader, StatCard } from '../components/ui/Card';
import { Checkbox } from '../components/ui/Checkbox';
import { Chip } from '../components/ui/Chip';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Modal, ModalBody, ModalFooter } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { SidePanel } from '../components/ui/SidePanel';
import { Skeleton, SkeletonList } from '../components/ui/Skeleton';
import { Switch } from '../components/ui/Switch';
import { Table, TableRow } from '../components/ui/Table';
import { SegmentedControl, Tabs } from '../components/ui/Tabs';
import { Textarea } from '../components/ui/Textarea';
import { useToast } from '../context/ToastContext';
import { ROLES, TASK_PRIORITIES, TASK_STATUSES, USER_STATUSES } from '../api/types';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Card>
    <CardHeader>
      <h2 className="t-h2">{title}</h2>
    </CardHeader>
    <CardBody className="flex flex-col gap-4">{children}</CardBody>
  </Card>
);

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="row-wrap">{children}</div>
);

/** Every core component in one place. Only exists in development, and the e2e script drives it. */
const DesignSystemView: React.FC = () => {
  const toast = useToast();
  const [tab, setTab] = useState('mine');
  const [view, setView] = useState('list');
  const [isChipOn, setIsChipOn] = useState(true);
  const [isSwitchOn, setIsSwitchOn] = useState(true);
  const [selectedRow, setSelectedRow] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  return (
    <main className="bg-bg min-h-screen">
      <div className="content mx-auto">
        <div className="page-head">
          <div>
            <h1 className="t-display">Workspace design system</h1>
            <p className="lede">Core components, as the screens use them.</p>
          </div>
        </div>

        <Section title="Buttons">
          <Row>
            <Button icon="add">New task</Button>
            <Button variant="secondary">Cancel</Button>
            <Button variant="ghost">Clear filters</Button>
            <Button variant="danger">Deactivate</Button>
            <Button variant="danger-ghost">Remove</Button>
          </Row>
          <Row>
            <Button size="lg">Sign in</Button>
            <Button size="sm">Save</Button>
            <Button variant="secondary" size="sm" icon="filter_list">
              Filters
            </Button>
            <IconButton icon="more_horiz" label="More" variant="secondary" />
            <Button isLoading loadingLabel="Sending invite">
              Send the invite now
            </Button>
            <Button disabled>Submit check-in</Button>
          </Row>
        </Section>

        <Section title="Inputs and selects">
          <div className="grid-2">
            <Input label="Work email" defaultValue="chinedu@brivent.co" />
            <Select
              label="Role"
              options={[{ value: 'TEAM_MEMBER', label: 'Team Member' }]}
            />
            <Input label="Search people" icon="search" placeholder="Name or email" />
            <Input label="Deadline" icon="calendar_today" defaultValue="Mon, 9 Nov 2026" />
            <Input
              label="Password"
              type="password"
              icon="lock"
              defaultValue="short"
              error="Use at least 12 characters."
            />
            <Input label="WhatsApp number" helperText="We only send task alerts here." />
          </div>
          <Textarea label="Blockers" optional placeholder="Anything stopping you?" />
          <Row>
            <Checkbox label="Only overdue" defaultChecked />
            <Switch label="WhatsApp alerts" checked={isSwitchOn} onChange={setIsSwitchOn} />
            <Switch label="Email digest" checked={false} onChange={() => {}} disabled />
          </Row>
        </Section>

        <Section title="Badges and avatars">
          <Row>
            {TASK_STATUSES.map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </Row>
          <Row>
            {TASK_PRIORITIES.map((priority) => (
              <PriorityBadge key={priority} priority={priority} />
            ))}
          </Row>
          <Row>
            {ROLES.map((role) => (
              <RoleBadge key={role} role={role} />
            ))}
          </Row>
          <Row>
            {USER_STATUSES.map((status) => (
              <UserStatusBadge key={status} status={status} />
            ))}
          </Row>
          <Row>
            <Avatar name="Caleb Abisoye" size="xs" />
            <Avatar name="Tolu Bankole" size="sm" />
            <Avatar name="Chinedu Eze" />
            <Avatar name="Ifeoma Okafor" size="lg" />
            <Avatar name="Aisha Bello" size="xl" />
          </Row>
        </Section>

        <Section title="Tabs, view switch, filters">
          <Tabs
            label="Task views"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'mine', label: 'My tasks', count: 7 },
              { value: 'assigned', label: 'Tasks I assigned', count: 14 },
              { value: 'all', label: 'All tasks' },
            ]}
          />
          <Row>
            <SegmentedControl
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: 'list', label: 'List', icon: 'view_list' },
                { value: 'board', label: 'Board', icon: 'view_kanban' },
              ]}
            />
            <Chip on={isChipOn} onClick={() => setIsChipOn(!isChipOn)}>
              Overdue
            </Chip>
            <Chip hasMenu>Status</Chip>
          </Row>
        </Section>

        <Card>
          <CardHeader>
            <h2 className="t-h2">Table</h2>
          </CardHeader>
          <Table caption="Sample tasks">
            <thead>
              <tr>
                <th scope="col">Task</th>
                <th scope="col">Status</th>
                <th scope="col">Priority</th>
              </tr>
            </thead>
            <tbody>
              {['Fix order sync delay', 'Design the Friday post'].map((title) => (
                <TableRow
                  key={title}
                  selected={selectedRow === title}
                  onOpen={() => setSelectedRow(title)}
                >
                  <td className="font-semibold">{title}</td>
                  <td>
                    <StatusBadge status="BLOCKED" />
                  </td>
                  <td>
                    <PriorityBadge priority="URGENT" />
                  </td>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </Card>

        <div className="grid-4">
          <StatCard label="Open" value={42} icon="radio_button_unchecked" hint="Across the team" />
          <StatCard label="Overdue" value={4} icon="schedule" hint="Past its deadline" attention />
        </div>

        <Section title="Toasts and banners">
          <Row>
            <Button
              variant="secondary"
              onClick={() =>
                toast.success('Invite sent to Yusuf Garba', {
                  description: 'The link works for 48 hours.',
                })
              }
            >
              Show success toast
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast.error("Couldn't save your changes", {
                  description: 'Your text is still here.',
                  action: { label: 'Try again', onClick: () => toast.success('Saved') },
                })
              }
            >
              Show error toast
            </Button>
          </Row>
          <Banner tone="warn">3 people need your attention today.</Banner>
          <Banner tone="danger">We couldn't reach the server. Check your connection.</Banner>
          <Banner tone="info">Links work once.</Banner>
          <Banner tone="success">Password updated.</Banner>
        </Section>

        <Section title="Modal and side panel">
          <Row>
            <Button variant="secondary" onClick={() => setIsModalOpen(true)}>
              Open modal
            </Button>
            <Button variant="secondary" onClick={() => setIsPanelOpen(true)}>
              Open side panel
            </Button>
          </Row>
        </Section>

        <EmptyState
          icon="task_alt"
          title="You're all caught up"
          description="No open tasks right now. New work your lead assigns will show up here."
        >
          <Button variant="secondary">Clear filters</Button>
        </EmptyState>

        <Section title="Loading">
          <SkeletonList label="Loading sample" rows={3} />
          <Skeleton className="w-1/2" />
        </Section>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Deactivate Emeka Obi?"
        description="They'll be signed out and can't log in."
      >
        <ModalBody>
          <Input label="Reason" data-autofocus />
          <Banner tone="warn">They have 3 open tasks. Reassign them after this.</Banner>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger">Deactivate</Button>
        </ModalFooter>
      </Modal>

      <SidePanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        title="Task title sits here"
        footer={<Button>Comment</Button>}
      >
        <Row>
          <StatusBadge status="IN_PROGRESS" />
          <PriorityBadge priority="HIGH" />
        </Row>
      </SidePanel>
    </main>
  );
};

export default DesignSystemView;
