import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const Route = createFileRoute("/app/library")({
  component: () => <ModulePlaceholder titleKey="app.library" />,
});
