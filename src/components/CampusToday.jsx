import React from "react";
import { BusWidget } from "../screens/bus/Bus.jsx";
import { PrayerWidget } from "../screens/prayer/Prayer.jsx";
import { AnnouncementsWidget } from "../screens/announcements/Announcements.jsx";
import { EventsWidget } from "../screens/events/Events.jsx";
import { MedicalWidget } from "../screens/medical/Medical.jsx";
import { MarketplaceWidget } from "../screens/marketplace/Marketplace.jsx";
import { RideWidget } from "../screens/rides/Rides.jsx";
import { BloodWidget } from "../screens/blood/Blood.jsx";

// ============================================================================
// CampusToday — at-a-glance hub of the campus-life features. Each widget is a
// self-contained card (reads the store, links into its feature). Shown on every
// role's dashboard. All features are open to all signed-in users.
// ============================================================================
export function CampusToday({ className = "" }) {
  return (
    <div className={className}>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Campus today</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <BusWidget />
        <PrayerWidget />
        <AnnouncementsWidget />
        <EventsWidget />
        <MedicalWidget />
        <MarketplaceWidget />
        <RideWidget />
        <BloodWidget />
      </div>
    </div>
  );
}
