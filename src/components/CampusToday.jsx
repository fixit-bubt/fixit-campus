import React from "react";
import { useApp } from "../data/store.jsx";
import { navKeysForRole } from "./AppShell.jsx";
import { BusWidget } from "../screens/bus/Bus.jsx";
import { PrayerWidget } from "../screens/prayer/Prayer.jsx";
import { AnnouncementsWidget } from "../screens/announcements/Announcements.jsx";
import { EventsWidget } from "../screens/events/Events.jsx";
import { MedicalWidget } from "../screens/medical/Medical.jsx";
import { MarketplaceWidget } from "../screens/marketplace/Marketplace.jsx";
import { RideWidget } from "../screens/rides/Rides.jsx";
import { BloodWidget } from "../screens/blood/Blood.jsx";
import { ClubsWidget } from "../screens/clubs/Clubs.jsx";
import { JobsWidget } from "../screens/jobs/Jobs.jsx";

// Each card is paired with its sidebar nav key(s) so the grid can be filtered to
// the current role — a card shows only if the role's nav has any of its keys.
// `key`/`keys` match the item keys in AppShell's NAV_BY_ROLE. Clubs lists both
// the student `clubs` item and the admin `clubs-admin` item so the card shows for
// admins too (their nav uses a different key for the same feature).
const WIDGETS = [
  { keys: ["bus"], Widget: BusWidget },
  { keys: ["prayer"], Widget: PrayerWidget },
  { keys: ["announcements"], Widget: AnnouncementsWidget },
  { keys: ["events"], Widget: EventsWidget },
  { keys: ["medical"], Widget: MedicalWidget },
  { keys: ["marketplace"], Widget: MarketplaceWidget },
  { keys: ["rideshare"], Widget: RideWidget },
  { keys: ["blood"], Widget: BloodWidget },
  { keys: ["clubs", "clubs-admin"], Widget: ClubsWidget },
  { keys: ["jobs"], Widget: JobsWidget },
];

// ============================================================================
// CampusToday — at-a-glance hub of the campus-life features. Each widget is a
// self-contained card (reads the store, links into its feature). Shown on every
// role's dashboard, but filtered to the cards that role can open from its nav:
// Staff (maintenance workers) don't get an Events/Jobs/Clubs nav item, so they
// don't get those cards either — the grid mirrors the sidebar.
// ============================================================================
export function CampusToday({ className = "" }) {
  const { currentUser } = useApp();
  const navKeys = navKeysForRole(currentUser?.role);
  const widgets = WIDGETS.filter((w) => w.keys.some((k) => navKeys.has(k)));
  return (
    <div className={className}>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Campus today</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {widgets.map(({ keys, Widget }) => (
          <Widget key={keys[0]} />
        ))}
      </div>
    </div>
  );
}
