import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import StorageDetailModal from "./StorageDetailModal";

const BYTES_PER_GB = 1_073_741_824;

function fmtBytes(b) {
  if (!b) return "0 B";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / BYTES_PER_GB).toFixed(3)} GB`;
}

function fmtGb(gb) {
  return `${gb.toFixed(4)} GB`;
}

export default function StorageUsersList({ users, userType, freeGb, pricePerGb, billingEnabled }) {
  const [selectedUser, setSelectedUser] = useState(null);

  if (users.length === 0) {
    return (
      <div className="text-center py-16 rounded-xl bg-card border border-border/40">
        <p className="text-muted-foreground text-sm font-mono">No {userType}s found.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {users.map(user => {
          const userGb = user.bytes / BYTES_PER_GB;
          const extraGb = Math.max(0, userGb - freeGb);
          const estCharge = billingEnabled ? extraGb * pricePerGb : 0;

          return (
            <button
              key={user.id}
              onClick={() => setSelectedUser(user)}
              className="w-full rounded-xl bg-card border border-border/40 overflow-hidden hover:border-border/60 hover:bg-secondary/20 transition-all text-left"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-bold truncate">{user.name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">{user.email} · {user.records.length} files</p>
                </div>
                <div className="flex items-center gap-4 sm:gap-3 justify-between sm:justify-end shrink-0">
                  <div className="text-left sm:text-right">
                    <p className="text-xs font-mono font-bold text-accent">{fmtBytes(user.bytes)}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{fmtGb(userGb)}</p>
                  </div>
                  <div className="text-left sm:text-right hidden sm:block">
                    <p className="text-xs font-mono font-bold text-muted-foreground">Extra: {fmtGb(extraGb)}</p>
                    {billingEnabled && estCharge > 0 && (
                      <p className="text-[10px] font-mono text-yellow-400">~${estCharge.toFixed(4)}</p>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground sm:ml-2" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedUser && (
        <StorageDetailModal
          user={selectedUser}
          records={selectedUser.records}
          userType={userType}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </>
  );
}