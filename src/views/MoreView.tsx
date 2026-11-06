import React from 'react';
import { Avatar } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { RoleBadge } from '../components/ui/badges';
import { BOTTOM_BAR_PATHS, useNavSections } from '../components/layout/navItems';
import { useAuth, useSession } from '../context/AuthContext';
import { Link } from '../lib/router';

const ROW = 'flex items-center gap-3 w-full min-h-[52px] px-4 text-text bg-transparent border-0';

/** The phone's way to reach everything that isn't on the bottom bar. */
export const MoreView: React.FC = () => {
  const { signOut } = useAuth();
  const { user } = useSession();
  const sections = useNavSections()
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !BOTTOM_BAR_PATHS.includes(item.to)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      <h1 className="t-h1 mb-4">More</h1>

      <div className="flex items-center gap-3 mb-2">
        <Avatar name={user.fullName} id={user.id} />
        <div className="min-w-0 grow">
          <p className="font-semibold text-text truncate">{user.fullName}</p>
          <p className="text-small text-text-2 truncate">{user.email}</p>
        </div>
        <RoleBadge role={user.role} />
      </div>

      {sections.map((section) => (
        <section key={section.title} className="mt-5">
          <h2 className="t-over text-text-2 mb-2">{section.title}</h2>
          <Card>
            <ul className="divide-y divide-border">
              {section.items.map(({ to, label, icon }) => (
                <li key={to}>
                  <Link to={to} className={`${ROW} hover:no-underline`}>
                    <Icon name={icon} />
                    <span className="grow">{label}</span>
                    <Icon name="chevron_right" className="text-text-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}

      <Card className="mt-5">
        <button type="button" onClick={signOut} className={`${ROW} text-danger cursor-pointer`}>
          <Icon name="logout" />
          Sign out
        </button>
      </Card>
    </>
  );
};
