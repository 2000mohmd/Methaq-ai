import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const Route = createFileRoute("/app/kyc")({
  component: () => <ModulePlaceholder titleKey="app.kyc" />,
});
