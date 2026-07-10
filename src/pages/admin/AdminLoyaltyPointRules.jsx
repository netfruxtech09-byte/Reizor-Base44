import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Users, Globe, ClipboardList, Gift } from "lucide-react";
import DefaultPointsPanel from "@/components/admin/loyalty/DefaultPointsPanel";
import FanAccountsPanel from "@/components/admin/loyalty/FanAccountsPanel";
import ProgramsPanel from "@/components/admin/loyalty/ProgramsPanel";
import AuditLogPanel from "@/components/admin/loyalty/AuditLogPanel";
import LedgerClaimsPanel from "@/components/admin/loyalty/LedgerClaimsPanel";
import LoyaltyTabSelector from "@/components/loyalty/LoyaltyTabSelector";

export default function AdminLoyaltyPointRules() {
  const [activeTab, setActiveTab] = useState("points");
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">LOYALTY & REWARDS</h1>
        <p className="text-sm text-muted-foreground mt-1">Control default point values, fan accounts, and loyalty programs platform-wide.</p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <LoyaltyTabSelector
          value={activeTab}
          onValueChange={setActiveTab}
          options={[
            { value: "points", label: "Default Points", icon: Star },
            { value: "accounts", label: "Fan Accounts", icon: Users },
            { value: "programs", label: "Programs", icon: Globe },
            { value: "ledger", label: "Ledger & Claims", icon: Gift },
            { value: "audit", label: "Audit Log", icon: ClipboardList },
          ]}
        />
        <TabsContent value="points" className="mt-4"><DefaultPointsPanel /></TabsContent>
        <TabsContent value="accounts" className="mt-4"><FanAccountsPanel /></TabsContent>
        <TabsContent value="programs" className="mt-4"><ProgramsPanel /></TabsContent>
        <TabsContent value="ledger" className="mt-4"><LedgerClaimsPanel /></TabsContent>
        <TabsContent value="audit" className="mt-4"><AuditLogPanel /></TabsContent>
      </Tabs>
    </div>
  );
}