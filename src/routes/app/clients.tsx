import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const Route = createFileRoute("/app/clients")({
  component: () => <ModulePlaceholder titleKey="app.clients" />,
});
