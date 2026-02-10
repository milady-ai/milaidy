/**
 * Admin view — logs and database management.
 *
 * Contains two sub-tabs:
 *   - Logs: agent runtime logs
 *   - Database: database explorer
 */

import { useState } from "react";
import { LogsView } from "./LogsView";
import { DatabaseView } from "./DatabaseView";

type AdminTab = "logs" | "database";

const ADMIN_TABS: { id: AdminTab; label: string }[] = [
  { id: "logs", label: "Logs" },
  { id: "database", label: "Database" },
];

export function AdminView() {
  const [activeTab, setActiveTab] = useState<AdminTab>("logs");

  return (
    <div>
      <h2 className="text-lg font-bold">Admin</h2>
      <p className="text-[13px] text-[var(--muted)] mb-4">Logs and database.</p>

      {/* Sub-tab bar */}
      <div className="flex gap-1 border-b border-[var(--border)] mb-5">
        {ADMIN_TABS.map((t) => (
          <button
            key={t.id}
            className={`px-4 py-2 text-[13px] bg-transparent border-0 border-b-2 cursor-pointer transition-colors ${
              activeTab === t.id
                ? "text-[var(--accent)] font-medium border-b-[var(--accent)]"
                : "text-[var(--muted)] border-b-transparent hover:text-[var(--txt)]"
            }`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {activeTab === "logs" && <LogsView />}
      {activeTab === "database" && <DatabaseView />}
    </div>
  );
}
