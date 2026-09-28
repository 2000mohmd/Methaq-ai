import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const Route = createFileRoute("/app/hr")({
  component: () => <ModulePlaceholder titleKey="app.hr" />,
});
