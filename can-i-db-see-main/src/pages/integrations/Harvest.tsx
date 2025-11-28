import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";

function HarvestPage() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Harvest Integration</h1>
          <p className="text-muted-foreground mt-1">Connect your Harvest time tracking</p>
        </div>

        <Card className="p-6">
          <p className="text-muted-foreground">Harvest integration settings coming soon...</p>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default function Harvest() {
  return (
    <ProtectedRoute>
      <HarvestPage />
    </ProtectedRoute>
  );
}
